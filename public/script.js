// Références aux éléments HTML
const fileList = document.getElementById('file-list');
const backButton = document.getElementById('back-button');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');

let currentPath = ''; // Chemin courant dans l'arborescence

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
    console.log(`[Debug] Chargement des fichiers pour le chemin : ${path}`);
    console.log(`[Debug] Utilisateur : ${username}, Mot de passe : ${password}`);

    fetch(`/videos?path=${encodeURIComponent(path)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Authentification échouée ou erreur serveur.');
            }
            return response.json();
        })
        .then(files => {
            console.log(`[Debug] Fichiers reçus :`, files);

            // Réinitialiser la liste des fichiers
            fileList.innerHTML = '';
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
		        li.addEventListener('click', () => loadFiles(file.path));
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
    const source = videoPlayer.querySelector('source');
    source.src = `/stream/${encodeURIComponent(path)}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    videoPlayer.load(); // Charger la nouvelle vidéo
    videoPlayer.play();
}

// Remonter dans l'arborescence
backButton.addEventListener('click', () => {
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

// Charger la liste des fichiers au démarrage
loadFiles();

// Si les identifiants ne sont pas encore définis, affichez le formulaire
if (!username || !password) {
    authModal.style.display = 'flex';
}
if (queryParams.title) {
    searchAndPlay(queryParams.title);
}
