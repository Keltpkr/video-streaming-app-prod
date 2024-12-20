// Références aux éléments HTML
const fileList = document.getElementById('file-list');
const backButton = document.getElementById('back-button');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');

let currentPath = ''; // Chemin courant dans l'arborescence
let scrollPositions = {}; // Pour stocker les positions de scroll par chemin

// Gestion de la soumission du formulaire d'authentification
authForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Empêcher le rechargement de la page
    username = document.getElementById('username').value;
    password = document.getElementById('password').value;

    // Mettre à jour l'URL du navigateur avec les identifiants
    const newUrl = `${window.location.origin}${window.location.pathname}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    window.history.pushState({}, '', newUrl); // Met à jour l'URL sans recharger la page

    authModal.style.display = 'none'; // Masquer la fenêtre d'authentification
    loadFiles(); // Charger les fichiers après connexion
});

// Fonction pour extraire les paramètres de l'URL
function getQueryParams() {
    const params = {};
    const queryString = window.location.search.slice(1); // Supprimer le '?'
    queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
}

// Initialisation des variables username et password
const queryParams = getQueryParams();

let username = queryParams.username || ''; // Récupérer le username depuis l'URL
let password = queryParams.password || ''; // Récupérer le password depuis l'URL

// Charger les fichiers disponibles
function loadFiles(path = '') {
    fetch(`/videos?path=${encodeURIComponent(path)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Authentification échouée ou erreur serveur.');
            }
            return response.json();
        })
        .then(files => {
            //console.log(`[Debug] Fichiers reçus :`, files);

            // Réinitialiser la liste des fichiers
            while (fileList.firstChild) {
                fileList.removeChild(fileList.firstChild);
            }
            currentPath = path;

            // Afficher ou masquer le bouton "Remonter"
            backButton.style.display = path ? 'block' : 'none';

            // Afficher les fichiers et dossiers dans la liste
            files.forEach(file => {
                const li = document.createElement('li');
                const icon = document.createElement('span'); // Icône visuelle

                if (file.isDirectory) {
                    // Icône pour les dossiers
                    icon.className = 'fas fa-folder'; // Icône de dossier
                    icon.classList.add('folder', 'icon');
                    li.addEventListener('click', () => {
                        // Sauvegarder la position de scroll avant de changer de dossier
                        scrollPositions[currentPath] = fileList.scrollTop;
                        console.log(`[Debug] Position de scroll sauvegardée pour ${path} : ${fileList.scrollTop}`);
                        loadFiles(file.path);
                    });
                } else {
                    icon.className = 'fas fa-film'; // Icône de film
                    icon.classList.add('video', 'icon');
                    li.addEventListener('click', () => playVideo(file.path));
                }

                li.appendChild(icon);
                li.appendChild(document.createTextNode(file.name)); // Ajouter le nom du fichier/dossier
                fileList.appendChild(li);
            });
        })
        .then(() => {
            // Restaurer la position de scroll après que le DOM est mis à jour
            const savedScroll = scrollPositions[path] || 0;
            fileList.scrollTop = savedScroll;
            console.log(`[Debug] Position de scroll restaurée pour ${path} : ${savedScroll}`);
        })
        .catch(err => {
            console.error(`[Erreur] Impossible de charger les fichiers :`, err);
            //alert('Impossible de charger les fichiers. Vérifiez vos identifiants ou le serveur.');
            authModal.style.display = 'flex'; // Afficher à nouveau la fenêtre d'authentification
        });
}


// Lire une vidéo
function playVideo(path) {
    console.log(`[Debug] Lecture de la vidéo : ${path}`);
    const videoPlayer = document.getElementById('video-player');
    const videoSource = document.getElementById('video-source');
    const subtitleTrack = document.getElementById('subtitle-track');

    if (!videoSource || !subtitleTrack) {
        console.error('[Erreur] Élément video-source ou subtitle-track introuvable.');
        return;
    }

    // Définir la source de la vidéo
    videoSource.src = `/stream/${encodeURIComponent(path)}`;
    videoPlayer.load();

    // Charger automatiquement le fichier de sous-titres correspondant
    const subtitlePath = path.replace(/\.[^.]+$/, '.vtt'); // Remplace l'extension par .vtt
    console.log(`[Debug] Chemin des sous-titres : /subtitles/${subtitlePath}`);

    fetch(`/subtitles/${encodeURIComponent(subtitlePath)}`)
        .then(response => {
            if (response.ok) {
                subtitleTrack.src = `/subtitles/${encodeURIComponent(subtitlePath)}`;
                console.log(`[Info] Sous-titres chargés : ${subtitlePath}`);
            } else {
                subtitleTrack.src = '';
                console.log('[Info] Aucun sous-titre trouvé.');
            }
        })
        .catch(err => {
            console.error(`[Erreur] Impossible de charger les sous-titres : ${err}`);
            subtitleTrack.src = '';
        });
    
    // Lancer la lecture après une interaction utilisateur
    videoPlayer.addEventListener('canplay', () => {
        videoPlayer.play().catch(error => {
            console.error('[Erreur] Impossible de lire la vidéo :', error);
        });
    });
}

// Remonter dans l'arborescence
backButton.addEventListener('click', () => {
    console.log(`[Debug] Position de scroll : ${fileList.scrollTop}`);
    if (!currentPath) return; // Si on est déjà à la racine, ne rien faire
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    loadFiles(parentPath);
});

// Fonction pour rechercher et lire une vidéo par son titre
function searchAndPlay(title) {
    console.log(`[Debug] Recherche du fichier contenant : ${title}`);
    fetch(`/search-and-play?title=${encodeURIComponent(title)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Aucun fichier trouvé ou erreur serveur.');
            }
            return response.json();
        })
        .then(data => {
            console.log(`[Debug] Fichier trouvé : ${data.path}`);
            playVideo(data.path); // Lire la vidéo automatiquement
        })
        .catch(err => {
            console.error(`[Erreur] Recherche échouée :`, err);
            alert('Impossible de trouver un fichier correspondant.');
        });
}

// Fonction pour changer l'image de fond périodiquement avec fondu et zoom vers une position aléatoire
function changeBackgroundWithFade() {
    let counter = 2; // Compteur pour générer une nouvelle image
    const bg1 = document.getElementById('bg1');
    const bg2 = document.getElementById('bg2');
    let currentActive = bg1;
    let currentInactive = bg2;
    randomZoom();

    setInterval(() => {


        // Mettre à jour l'image et la position de la couche inactive
        currentInactive.style.backgroundImage = `url('https://picsum.photos/1920/1080?random=${counter}')`;
        counter++;

        // Appliquer le fondu
        currentActive.classList.remove('active');
        currentActive.classList.add('inactive');
        currentInactive.classList.remove('inactive');
        currentInactive.classList.add('active');

        // Inverser les rôles des couches
        [currentActive, currentInactive] = [currentInactive, currentActive];

        // Générer une nouvelle position de zoom vers aléatoire
        randomZoom();
    }, 60000); // Change l'image toutes les 60 secondes
}

function randomZoom() {
    const background = document.getElementsByClassName('active')[0];

    // Génère des valeurs aléatoires pour transform-origin
    const randomX = Math.floor(Math.random() * 100); // Entre 0% et 100%
    const randomY = Math.floor(Math.random() * 100); // Entre 0% et 100%

    // Applique le transform avec des origines aléatoires
    background.style.transformOrigin = `${randomX}% ${randomY}%`;
    //background.style.transform = 'scale(1.1)';

}

// Ajouter un écouteur global pour une interaction utilisateur
document.body.addEventListener('click', () => {
    const videoPlayer = document.getElementById('video-player');

    // Vérifiez si la vidéo est prête à jouer
    if (videoPlayer.paused) {
        videoPlayer.play().catch(error => {
            console.error('[Erreur] Impossible de lire la vidéo :', error);
        });
    }
}, { once: true }); // Exécuter uniquement une fois

// Appeler la fonction pour démarrer
changeBackgroundWithFade();

// Charger la liste des fichiers au démarrage
loadFiles();

// Si les identifiants ne sont pas encore définis, affichez le formulaire
if (!username || !password) {
    authModal.style.display = 'flex';
}
if (queryParams.title) {
    searchAndPlay(queryParams.title);
}
