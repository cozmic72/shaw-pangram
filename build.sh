#!/bin/bash
set -e

echo "Building site..."

# Initialize and update submodules
echo "Updating readlex submodule..."
git submodule update --init --recursive

# Extract word lists from readlex
echo "Extracting word lists from readlex..."
mkdir -p site/readlex
python3 tools/extract-wordlists.py readlex/readlex.json site/readlex

# Compress word lists with gzip
echo "Compressing word lists..."
gzip -9 -k -f site/readlex/shavian-words.txt
gzip -9 -k -f site/readlex/roman-words.txt

echo "Build complete!"
echo "Word list sizes:"
ls -lh site/readlex/*.txt site/readlex/*.gz
