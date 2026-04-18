"""
Unbiased AI Decision System — FastAPI backend
Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
load_dotenv()
from routers import analysis, report, simulation

app = FastAPI(
    title="Unbiased AI Decision System",
    description="Detect, analyse, visualise, and mitigate bias in AI decision pipelines.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(analysis.router,   prefix="/api/analysis",   tags=["Analysis"])
app.include_router(report.router,     prefix="/api/report",     tags=["Report"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])


@app.get("/")
async def root():
    return {"message": "Unbiased AI Decision System", "status": "running", "version": "1.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
