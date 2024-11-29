require('dotenv').config();
const PORT = process.env.PORT;
const express = require('express');
const fs = require('fs');
const path = require('path');
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '10', 10) * 1024 * 1024; // Par défaut : 10 Mo

const app = express();

// Dossier des vidéos
const VIDEO_DIR = '/mnt/usbdrive/Films';

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

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route principale pour servir `index.html`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware pour authentification et récupération des propriétés utilisateur
app.use((req, res, next) => {
    const publicPaths = ['/style.css', '/script.js', '/favicon.ico'];

    // Si le chemin correspond à une ressource publique, passer sans authentification
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    const users = loadUsers(); // Charger les utilisateurs depuis users.json
    const username = req.query.username; // Récupérer l'utilisateur depuis l'URL
    const password = req.query.password; // Récupérer le mot de passe depuis l'URL

    if (username && password) {
        console.log(`[Info] Tentative de connexion avec : username=${username}, password=${password}`);

        // Vérifiez que l'utilisateur existe et que le mot de passe correspond
        if (users[username] && users[username].password === password) {
            console.log(`[Info] Authentification réussie pour : ${username}`);
            req.user = { username, ...users[username] }; // Ajoutez les informations de l'utilisateur à la requête
            return next();
        } else {
            console.error(`[Erreur] Authentification échouée pour : ${username}`);
            return res.status(401).send('Authentification échouée.');
        }
    } else {
        // Si les paramètres d'authentification ne sont pas dans l'URL, afficher le formulaire
        console.log('[Info] Aucun identifiant fourni, formulaire d\'authentification nécessaire.');
        return res.status(401).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
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

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        console.log(`[Info] Transfert complet : ${videoPath}`);
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };

        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

