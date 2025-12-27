#!/bin/bash
set -e

echo "Building site..."

# Initialize and update submodules
echo "Updating readlex submodule..."
git submodule update --init --recursive

# Copy readlex dictionary to site
echo "Copying readlex dictionary..."
mkdir -p site/readlex
cp readlex/readlex.json site/readlex/

echo "Build complete!"
