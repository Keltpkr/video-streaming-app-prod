require('dotenv').config();

const { execSync } = require('child_process');
const express = require('express');
const fs = require('fs');
const chokidar = require('chokidar');
const chardet = require('chardet');
const iconv = require('iconv-lite')
const path = require('path');

const { Worker } = require('worker_threads');
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '10', 10) * 1024 * 1024; // Par défaut : 10 Mo

const app = express();

const IP = process.env.IP || '0.0.0.0';
const PORT = process.env.PORT || 8001;

const VIDEO_DIR = '/mnt/usbdrive/Films';

// Fonction pour vérifier si le montage existe
const isMounted = (mountPoint) => {
    try {
        const result = execSync(`mount | grep "${mountPoint}"`).toString();
        return result.includes(mountPoint);
    } catch (error) {
        return false;
    }
};

// Fonction pour monter le partage réseau sans identifiant
const mountNetworkShare = () => {
    try {
        const videoDir = process.env.VIDEO_DIR || '//192.168.1.46/USBDrive';
        const mountPoint = '/mnt/usbdrive';

        if (isMounted(mountPoint)) {
            console.log(`[Info] Le partage réseau est déjà monté sur ${mountPoint}.`);
            return;
        }

        console.log(`[Info] Montage du partage réseau depuis ${videoDir} vers ${mountPoint}...`);
        execSync(`sudo mount -t cifs ${videoDir} ${mountPoint} -o guest,uid=1000,gid=1000`);
        console.log('[Info] Montage réussi.');
    } catch (error) {
        console.error(`[Erreur] Échec du montage : ${error.message}`);
        if (!error.message.includes('Device or resource busy'))
            process.exit(1);
    }
};

// Fonction pour démonter le partage réseau
const unmountNetworkShare = () => {
    try {
        console.log('[Info] Démontage du partage réseau...');
        execSync('sudo umount /mnt/usbdrive');
        console.log('[Info] Démontage réussi.');
    } catch (error) {
        console.error(`[Erreur] Échec du démontage : ${error.message}`);
    }
};

// Monter le partage uniquement en développement
if (process.env.NODE_ENV === 'development') {
    mountNetworkShare();
}

// Chemin vers le fichier JSON des utilisateurs
const USERS_FILE = path.join(__dirname, 'users.json');


// Fonction pour charger les utilisateurs dynamiquement
const loadUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data); // Retourne les utilisateurs avec leurs propriétés
    } catch (error) {
        console.error(`[Erreur] Impossible de charger le fichier utilisateurs : ${error.message}`);
        return {};
    }
};

// Fonction pour lancer la conversion SRT en VTT dans un Worker Thread
const convertSRTtoVTT = (srtFile) => {
    const worker = new Worker(path.join(__dirname, 'convertWorker.js'), { workerData: srtFile });

    worker.on('message', (message) => {
        console.log(message);
    });

    worker.on('error', (error) => {
        console.error(`[Erreur Worker] ${error.message}`);
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`[Erreur] Worker exited with code ${code}`);
        }
    });
};

// Surveiller récursivement les fichiers SRT dans les sous-dossiers
chokidar.watch(VIDEO_DIR, { persistent: true, ignored: /.*\.vtt$/, depth: 99 }).on('add', (filePath) => {
    if (filePath.endsWith('.srt')) {
        console.log(`[Info] Nouveau fichier SRT détecté : ${filePath}`);
        convertSRTtoVTT(filePath);
    }
});

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour servir les sous-titres VTT
app.get('/subtitles/:filename', (req, res) => {
    const filename = req.params.filename;
    const subtitlePath = path.join(VIDEO_DIR, filename);

    if (fs.existsSync(subtitlePath)) {
        res.sendFile(subtitlePath);
    } else {
        res.status(404).send('Sous-titres introuvables.');
    }
});

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route principale pour servir `index.html`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware pour authentification et récupération des propriétés utilisateur
const authMiddleware = (req, res, next) => {
    const publicPaths = ['/style.css', '/script.js', '/favicon.ico', '/stream'];

    // Si le chemin correspond à une ressource publique ou au streaming, passer sans authentification
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    const users = loadUsers(); // Charger les utilisateurs depuis users.json
    const username = req.query.username;
    const password = req.query.password;

    if (username && password) {
        console.log(`[Info] Tentative de connexion avec : username=${username}, password=${password}`);

        if (users[username] && users[username].password === password) {
            console.log(`[Info] Authentification réussie pour : ${username}`);
            req.user = { username, ...users[username] };
            return next();
        } else {
            console.error(`[Erreur] Authentification échouée pour : ${username}`);
            return res.status(401).send('Authentification échouée.');
        }
    } else {
        console.log('[Info] Aucun identifiant fourni, formulaire d\'authentification nécessaire.');
        return res.status(401).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
};

// Appliquer le middleware uniquement aux routes nécessitant une authentification
app.use(['/videos', '/info'], authMiddleware);

// Exemple de route pour tester
app.get('/info', (req, res) => {
    res.json({ IP, PORT, VIDEO_DIR });
});

// Route pour lister les fichiers et dossiers
app.get('/videos', (req, res) => {
    console.log(`[Info] Requête reçue pour /videos avec path="${req.query.path || ''}" par l'utilisateur ${req.user ? req.user.username : 'inconnu'}`);

    const requestedPath = req.query.path || '';
    const fullPath = path.join(VIDEO_DIR, requestedPath);

    if (!fs.existsSync(fullPath)) {
        console.error(`[Erreur] Chemin introuvable : ${fullPath}`);
        return res.status(404).json({ error: 'Chemin introuvable' });
    }

    const canViewHidden = req.user.hide || false;

    const files = fs.readdirSync(fullPath)
        .map(file => {
            const filePath = path.join(fullPath, file);
            const isDirectory = fs.statSync(filePath).isDirectory();

            if (isDirectory) {
                const hasHideFile = fs.existsSync(path.join(filePath, '.hide'));
                if (hasHideFile && !canViewHidden) {
                    console.log(`[Info] Dossier masqué ignoré : ${file}`);
                    return null; // Ignorer les dossiers cachés
                }
            } else if (!file.endsWith('.mp4') && !file.endsWith('.mkv') && !file.endsWith('.avi')) {
                return null; // Ignorer les fichiers non vidéos
            }

            return {
                name: file,
                path: path.join(requestedPath, file),
                isDirectory
            };
        })
        .filter(item => item !== null);

    //    console.log(`[Info] Fichiers retournés : ${JSON.stringify(files)}`);
    res.json(files);
});

// Route pour streamer une vidéo
app.get('/stream/:filename', (req, res) => {
    const filename = req.params.filename;
    const videoPath = path.join(VIDEO_DIR, filename);

    // Vérifiez si l'extension est valide
    const validExtensions = ['.mp4', '.mkv', '.avi'];
    if (!validExtensions.includes(path.extname(videoPath).toLowerCase())) {
        console.error(`[Erreur] Requête non vidéo : ${filename}`);
        return res.status(400).send('Fichier non valide');
    }

    // Vérifiez si le fichier existe
    if (!fs.existsSync(videoPath)) {
        console.error(`[Erreur] Fichier introuvable : ${videoPath}`);
        return res.status(404).send('Fichier non trouvé');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;

    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

        console.log(`[Info] Transfert partiel : bytes ${start}-${end}/${fileSize}`);

        const chunkSize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        // **Ajoutez ce code ici** pour envoyer les en-têtes HTTP
        const head = {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`
        };
        res.writeHead(206, head);

        file.pipe(res); // Envoyer les données vidéo en streaming
    } else {
        console.log(`[Info] Transfert complet : ${videoPath}`);
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4'
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

// Recherche récursive d'un fichier vidéo par nom (partiel ou complet)
app.get('/search-and-play', (req, res) => {
    const query = req.query.title || '';
    if (!query) {
        return res.status(400).json({ error: 'Le paramètre "title" est requis.' });
    }

    const findVideoFile = (dir, searchQuery) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                const result = findVideoFile(filePath, searchQuery);
                if (result) return result;
            } else if (file.toLowerCase().includes(searchQuery.toLowerCase())) {
                return path.relative(VIDEO_DIR, filePath);
            }
        }
        return null;
    };

    const videoPath = findVideoFile(VIDEO_DIR, query);

    if (videoPath) {
        console.log(`[Info] Fichier trouvé : ${videoPath}`);
        return res.json({ path: videoPath });
    } else {
        console.error(`[Erreur] Aucun fichier trouvé pour : ${query}`);
        return res.status(404).json({ error: 'Fichier introuvable.' });
    }
});

// Démarrer le serveur
app.listen(PORT, IP, () => {
    console.log(`Serveur démarré sur http://${IP}:${PORT}`);
});

// Assurer le démontage à l'arrêt de l'application en développement
process.on('SIGINT', () => {
    if (process.env.NODE_ENV === 'development') {
        unmountNetworkShare();
    }
    process.exit();
});

