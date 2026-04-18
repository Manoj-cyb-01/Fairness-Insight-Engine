"""
Storage utility - manages in-memory session state for uploaded datasets
"""
import pandas as pd
from typing import Optional, Dict, Any

# Global session store (in production, use Redis or DB)
_session: Dict[str, Any] = {
    "dataframe": None,
    "filename": None,
    "analysis_results": None,
}


def store_dataframe(df: pd.DataFrame, filename: str):
    _session["dataframe"] = df
    _session["filename"] = filename
    _session["analysis_results"] = None


def get_dataframe() -> Optional[pd.DataFrame]:
    return _session.get("dataframe")


def get_filename() -> Optional[str]:
    return _session.get("filename")


def store_analysis(results: Dict[str, Any]):
    _session["analysis_results"] = results


def get_analysis() -> Optional[Dict[str, Any]]:
    return _session.get("analysis_results")


def clear_session():
    _session["dataframe"] = None
    _session["filename"] = None
    _session["analysis_results"] = None
