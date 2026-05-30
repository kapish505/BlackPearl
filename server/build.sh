#!/usr/bin/env bash
set -e

echo "Installing Node dependencies..."
npm install

echo "Creating bin directory for Coral..."
mkdir -p bin

echo "Downloading Coral CLI (Linux x86_64)..."
curl -sL https://github.com/withcoral/coral/releases/download/v0.4.1/coral-x86_64-unknown-linux-gnu.tar.gz -o coral.tar.gz

echo "Extracting Coral CLI..."
tar -xzf coral.tar.gz
mv coral bin/coral
chmod +x bin/coral
rm coral.tar.gz

echo "Build complete! Coral installed at ./bin/coral"
