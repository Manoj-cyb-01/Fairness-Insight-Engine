@echo off
echo.
echo ╔══════════════════════════════════════════╗
echo ║   ⚖  UNBIASED AI DECISION SYSTEM  v1.1  ║
echo ║   Bias Detection ^& Mitigation Platform   ║
echo ╚══════════════════════════════════════════╝
echo.
echo AI provider priority:
echo   1. Gemini  -- set GEMINI_API_KEY or paste key in the UI header
echo   2. Groq    -- set GROQ_API_KEY as a fallback
echo   3. Template -- works offline with no keys
echo.

echo Installing backend dependencies...
cd backend
pip install -r requirements.txt
if ERRORLEVEL 1 ( echo Backend install failed && pause && exit /b 1 )
echo.

echo Starting backend on http://localhost:8000 ...
start "Unbiased-AI Backend" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

cd ..\frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
)

echo.
echo ══════════════════════════════════════════
echo   App:      http://localhost:3000
echo   API docs: http://localhost:8000/docs
echo   Sample:   sample_data\hiring_dataset.csv
echo   AI key:   paste Gemini key in the UI header (optional)
echo   Fallback: Groq (GROQ_API_KEY) -^> template (offline)
echo ══════════════════════════════════════════
echo.

set REACT_APP_API_URL=http://localhost:8000
npm start
