const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const iconv = require('iconv-lite');
const chardet = require('chardet');

// Extraire le chemin du fichier SRT depuis les données du Worker
const srtFile = workerData;
const vttFile = srtFile.replace(/\.srt$/, '.vtt');

// Fonction pour convertir SRT en VTT
const convertSRTtoVTT = () => {
    if (fs.existsSync(vttFile)) {
        parentPort.postMessage(`[Info] Le fichier VTT existe déjà : ${vttFile}, conversion ignorée.`);
        return;
    }

    // Détecter l'encodage du fichier SRT
    const encoding = chardet.detectFileSync(srtFile) || 'utf-8';
    console.log(`[Info] Encodage détecté pour ${srtFile} : ${encoding}`);

    // Lire le fichier SRT avec l'encodage détecté en utilisant iconv-lite
    fs.readFile(srtFile, null, (err, data) => {
        if (err) {
            parentPort.postMessage(`[Erreur] Échec de la lecture du fichier : ${err.message}`);
            return;
        }

        try {
            const decodedData = iconv.decode(data, encoding);

            // Convertir le contenu SRT en VTT
            let vttContent = 'WEBVTT\n\n' + decodedData
                .replace(/\r\n|\r|\n/g, '\n')
                .replace(/(\d{2}:\d{2}:\d{2}),/g, '$1.')
                .replace(/\n{2,}/g, '\n\n');

            // Écrire le fichier VTT avec encodage UTF-8
            fs.writeFile(vttFile, vttContent, 'utf8', (err) => {
                if (err) {
                    parentPort.postMessage(`[Erreur] Échec de l'écriture du fichier VTT : ${err.message}`);
                    return;
                }
                parentPort.postMessage(`[Info] Conversion réussie : ${srtFile} -> ${vttFile}`);
            });
        } catch (decodeError) {
            parentPort.postMessage(`[Erreur] Échec du décodage du fichier : ${decodeError.message}`);
        }
    });
};

convertSRTtoVTT();
