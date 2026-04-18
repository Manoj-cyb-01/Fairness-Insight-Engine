#!/bin/bash
# ⚖ Unbiased AI Decision System — Quick Start
#
# AI provider priority:
#   1. Gemini (google-genai) — set GEMINI_API_KEY or paste key in the UI header
#   2. Groq   (groq)         — set GROQ_API_KEY as a fallback
#   3. Template fallback      — works offline with no keys at all

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ⚖  UNBIASED AI DECISION SYSTEM  v1.1  ║"
echo "║   Bias Detection & Mitigation Platform   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

command -v python3 >/dev/null || { echo "❌ Python 3 not found"; exit 1; }
command -v node    >/dev/null || { echo "❌ Node.js not found";  exit 1; }

echo "✅ Python: $(python3 --version)"
echo "✅ Node:   $(node --version)"
echo ""

# ── Backend ────────────────────────────────────────────────────────────────
echo "📦 Installing backend dependencies..."
cd backend
pip install -r requirements.txt -q

echo "🚀 Starting backend on http://localhost:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Register cleanup BEFORE starting the foreground frontend process
trap "echo ''; echo 'Shutting down…'; kill $BACKEND_PID 2>/dev/null" EXIT INT TERM

sleep 3

# ── Frontend ───────────────────────────────────────────────────────────────
cd ../frontend
[ ! -d "node_modules" ] && { echo "📦 Installing frontend deps (first run ~60s)..."; npm install; }

echo ""
echo "══════════════════════════════════════════════"
echo "  🌐 App:      http://localhost:3000"
echo "  📚 API docs: http://localhost:8000/docs"
echo "  📁 Sample:   sample_data/hiring_dataset.csv"
echo "  🔑 AI key:   paste Gemini key in the UI header (optional)"
echo "  🔄 Fallback: Groq (GROQ_API_KEY) → template (offline)"
echo "══════════════════════════════════════════════"
echo ""

REACT_APP_API_URL=http://localhost:8000 npm start
