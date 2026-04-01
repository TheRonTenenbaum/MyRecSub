#!/bin/bash
set -e

echo "=========================================="
echo "  MyRecSub - Setup"
echo "=========================================="
echo ""

echo "[1/4] Installing backend dependencies..."
cd backend
npm install
cd ..

echo ""
echo "[2/4] Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "[3/4] Generating Prisma client..."
cd backend
npx prisma generate
cd ..

echo ""
echo "[4/4] Creating database..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env from .env.example"
  echo "   IMPORTANT: Edit .env and add your Google Client ID and Secret!"
fi

cd backend
set -a && source ../.env && set +a
npx prisma db push
cd ..

echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env and fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
echo "     (See README.md for Google Cloud setup instructions)"
echo "  2. Run: ./start.sh"
echo ""
