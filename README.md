# ⚖ Unbiased AI Decision System  v1.1

A production-ready bias detection, analysis, and mitigation platform for AI decision pipelines.

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.9+**
- **Node.js 18+**
- A Gemini or Groq API key *(optional — the system works offline with built-in fallback responses)*

### One-command launch

```bash
# macOS / Linux
chmod +x start.sh && ./start.sh

# Windows
start.bat
```

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000        |
| API docs | http://localhost:8000/docs   |

### Manual launch (recommended for development)

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 npm start
```

---

## 🤖 AI Provider Architecture

The system uses a **three-tier fallback** for all AI-generated narrative:

| Priority | Provider | Configuration |
|----------|----------|---------------|
| 1 — Primary  | **Google Gemini** (`gemini-2.0-flash`) | UI header bar **or** `GEMINI_API_KEY` env var |
| 2 — Backup   | **Groq** (`llama-3.1-8b-instant`)      | `GROQ_API_KEY` env var |
| 3 — Fallback | **Built-in template**                  | Always available, no keys needed |

The bias detection, statistical analysis, visualisation, and report generation all work
without any API keys. AI keys only enhance the natural-language narrative sections.

---

## 🔑 Setting API Keys

### Option A — UI header (Gemini only, per-session)

Paste your Gemini key into the **header bar** of the app.  
It is sent as the `X-Gemini-Key` **request header** — never in the URL.

Get a free Gemini key: https://aistudio.google.com/app/apikey

### Option B — Environment variables (recommended for self-hosting)

Create a `backend/.env` file (never commit this file — it is in `.gitignore`):

```env
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
```

Or export them in your shell before running:

```bash
export GEMINI_API_KEY=AIza...
export GROQ_API_KEY=gsk_...
./start.sh
```

Get a free Groq key: https://console.groq.com

---

## 📁 Project Structure

```
unbiased-ai/
├── backend/
│   ├── main.py                   # FastAPI entry-point (uvicorn)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── routers/
│   │   ├── analysis.py           # Upload + full pipeline
│   │   ├── simulation.py         # What-If simulator
│   │   └── report.py             # HTML report generator
│   ├── models/
│   │   ├── bias_detector.py      # Core metrics engine
│   │   └── bias_corrector.py     # Auto-fix / corrections
│   └── utils/
│       ├── gemini_client.py      # Gemini → Groq → template fallback
│       ├── visualizer.py         # Plotly charts (safe_layout)
│       └── storage.py            # In-memory session store
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── src/components/
│       ├── Header.js             # App shell + Gemini key input
│       ├── UploadSection.js      # CSV drop-zone + progress
│       ├── DataOverview.js       # Schema & preview
│       ├── BiasAnalysis.js       # Metrics tabs
│       ├── VisualizationPanel.js # Interactive charts
│       ├── AIInsights.js         # AI narrative display
│       ├── WhatIfSimulator.js    # Scenario simulator
│       └── ReportSection.js      # Download + auto-fix
├── sample_data/
│   └── hiring_dataset.csv        # Demo: 40-row hiring dataset
├── docker-compose.yml
├── start.sh
├── start.bat
└── .gitignore
```

---

## 🐳 Docker

```bash
# Set keys in your shell (or a root .env file — see docker-compose.yml)
export GEMINI_API_KEY=AIza...
export GROQ_API_KEY=gsk_...

docker compose up --build
```

Both keys are passed as environment variables. The backend `.env` file is excluded from
the Docker image via `backend/.dockerignore`.

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/analysis/upload` | `X-Gemini-Key` header (opt.) | Upload CSV → full pipeline |
| `GET`  | `/api/analysis/results` | — | Cached analysis results |
| `POST` | `/api/analysis/auto-fix` | `X-Gemini-Key` header (opt.) | Apply auto bias correction |
| `POST` | `/api/simulation/what-if` | — | Run What-If simulation |
| `GET`  | `/api/simulation/scenarios` | — | Preset scenario list |
| `GET`  | `/api/report/generate` | `X-Gemini-Key` header (opt.) | Generate + download HTML report |

---

## 🧪 Sample Dataset

Upload `sample_data/hiring_dataset.csv` for a live demo:

- 40 hiring decisions
- Sensitive: `gender`, `race`, `age`
- Targets: `hired`, `loan_approved`
- Demonstrates measurable gender & race bias in outcomes

---

## ✅ v1.1 Bug Fixes

| # | File | Fix |
|---|------|-----|
| 1 | `utils/visualizer.py` | **TypeError crash** — `safe_layout()` helper prevents duplicate `xaxis`/`yaxis` kwargs |
| 2 | `models/bias_detector.py` | `_binarize_target()` — robust dtype check prevents median reduction error on strings |
| 3 | `models/bias_detector.py` | `auto_detect_columns()` — overlap removal, detection warnings surfaced in response |
| 4 | `models/bias_detector.py` | `feature_importance_bias()` — constant-column guard before RandomForest |
| 5 | `models/bias_detector.py` | `full_correlation_matrix()` — `fillna(0)` before `.corr()` prevents NaN propagation |
| 6 | `models/bias_corrector.py` | `apply_auto_fix()` — one-pass oversampling prevents exponential row growth |
| 7 | `models/bias_corrector.py` | NaN-safe noise injection: `col_std == 0` guard + `rng.integers` bootstrap |
| 8 | `routers/simulation.py` | Multi-class rebalancing (>2 groups) — previously only handled binary sensitive columns |
| 9 | `routers/report.py` | Cross-platform report path via `pathlib.Path(tempfile.gettempdir())` |
| 10 | `routers/analysis.py` | `gemini_api_key` removed from query params → `X-Gemini-Key` request header |
| 11 | All routers | Structured `{"detail": "..."}` JSON error responses |
| 12 | `start.sh` / `start.bat` | `uvicorn main:app --reload`; trap registered before frontend process |
| 13 | `UploadSection.js` | `noClick: true` on dropzone + dedicated `ref` — file picker button reliable |
| 14 | `UploadSection.js` | Real backend error messages displayed |
| 15 | `VisualizationPanel.js` | Dark layout merged per-chart without overwriting axis settings |
| 16 | `ReportSection.js` | API key sent as header; real error messages; `revokeObjectURL()` cleanup |
| 17 | `App.css` | Upload success state, responsive breakpoints, improved contrast |
| 18 | `utils/gemini_client.py` | `get_client()` accepts explicit `api_key` arg — UI-supplied key now honoured |
| 19 | `utils/gemini_client.py` | Raw API key values no longer printed to logs |
| 20 | `requirements.txt` | Added `python-dotenv`, `groq`; removed unused `matplotlib`, `seaborn`, `reportlab`, `jinja2`, `aiofiles`, `kaleido` |

---

## ⚠️ Disclaimer

Informational only. Does not constitute legal advice. Consult qualified experts before
making deployment decisions that affect individuals.
