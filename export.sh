#!/bin/bash

# Nom du fichier de sortie
output_file="export4chatgpt.txt"

# Liste des fichiers et répertoires à exclure
exclude_patterns=(
    "./.git"
    "./node_modules"
    "./export4chatgpt.txt"
    "./export.sh"
    "./notes.txt"
    "./prompt.md"
    "./favicon.png"
    "./exclude_files.tmp"
    "./package-lock.json"
    "./public/favicon.png"
    "./coverage"
    "./LICENSE"
    "./users.json"
)

# Filtre pour le mode "style"
style_mode=false
if [[ "$1" == "style" ]]; then
    style_mode=true
fi

# Affiche le chemin du répertoire actuel pour débogage
echo "Répertoire actuel : $(pwd)"

# Vider le fichier de sortie s'il existe déjà
> "$output_file"

# Générer une liste des fichiers et répertoires exclus en utilisant git check-ignore
generate_exclude_list() {
    find . | git check-ignore --stdin > exclude_files.tmp

    # Ajouter les exclusions spécifiques à exclude_files.tmp
    for pattern in "${exclude_patterns[@]}"; do
        echo "$pattern" >> exclude_files.tmp
    done

    # Supprimer le fichier .env de la liste des exclusions s'il est présent
    grep -v "^./.env$" exclude_files.tmp > exclude_files_filtered.tmp
    mv exclude_files_filtered.tmp exclude_files.tmp
}

# Fonction pour générer le plan de l'application en arborescence avec les dossiers
generate_structure() {
    echo "Plan de l'application :" >> "$output_file"
    echo "" >> "$output_file"

    # Filtrer les fichiers autorisés, enlever le premier niveau "./", et afficher l'arborescence complète triée
    find . -type f | grep -v -F -f exclude_files.tmp | sed 's|^\./||' | sort | awk -F'/' '
    {
        path=""
        for (i=1; i<NF; i++) {
            path = path $i "/"
            if (!(path in seen)) {
                indent = ""
                for (j=1; j<i; j++) {
                    indent = indent "│   "
                }
                print indent "├── " $i
                seen[path]=1
            }
        }
        indent = ""
        for (i=1; i<NF; i++) {
            indent = indent "│   "
        }
        print indent "├── " $NF
    }
    ' >> "$output_file"
    echo -e "\n" >> "$output_file"
}

# Fonction pour ajouter le contenu d'un fichier au fichier de sortie
add_content() {
    local file_name="$1"
    
    if [[ -f "$file_name" ]]; then
        echo "Vérification de $file_name" Ok # Débogage
        echo "----- Début de $file_name -----" >> "$output_file"
        cat "$file_name" >> "$output_file"
        echo -e "\n----- Fin de $file_name -----\n" >> "$output_file"
    fi
}

# Générer la liste des fichiers et dossiers exclus
generate_exclude_list

# Générer le plan de l'application
generate_structure

# Parcours récursif des fichiers, en excluant ceux mentionnés dans exclude_files.tmp
find . -type f | grep -v -F -f exclude_files.tmp | \
{
    if $style_mode; then
        grep -E '\.html$|\.css$|/script\.js$'
    else
        cat
    fi
} | while read -r file; do
    add_content "$file"
done

# Nettoyer le fichier temporaire
rm -f exclude_files.tmp

echo "Le contenu des fichiers a été exporté vers $output_file"
