#!/bin/sh
# Script de démarrage production sulungukutu API
# 1. Applique les migrations de base de données
# 2. Lance le serveur

set -e

echo "🔄 Application des migrations..."
npx drizzle-kit migrate || {
  echo "⚠️  Migrations échouées — tentative db:push..."
  npx drizzle-kit push
}

echo "🚀 Démarrage du serveur sulungukutu API..."
exec node dist/index.js

