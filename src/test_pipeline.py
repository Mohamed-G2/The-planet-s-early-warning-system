"""
End-to-end verification suite (`src/test_pipeline.py`) for Eagles of Horus:
- Verifies `data/global_5regions_harmonized.parquet`, `.pkl` models, and `data/telemetry_summary.json`
- Exercises FastAPI routes (`/health`, `/api/telemetry`, `POST /api/analyze-aoi`, `POST /api/watchdog/subscribe`)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from src.api_server import (
    AnalyzeAOIRequest,
    WatchdogSubscribeRequest,
    analyze_aoi,
    app,
    get_telemetry,
    health_check,
    subscribe_watchdog,
)
from src.clean_pipeline import REGION_SPECS


def run_tests() -> None:
    project_root = Path(__file__).resolve().parent.parent
    data_dir = project_root / "data"

    parquet_path = data_dir / "global_5regions_harmonized.parquet"
    telemetry_path = data_dir / "telemetry_summary.json"

    assert parquet_path.exists(), f"Missing {parquet_path}"
    assert telemetry_path.exists(), f"Missing {telemetry_path}"

    df = pd.read_parquet(parquet_path)
    print(f"[test] Loaded {parquet_path.name}: {len(df):,} rows, columns={list(df.columns)}")

    for country, spec in REGION_SPECS.items():
        c_df = df.loc[df["country"] == country]
        actual_years = sorted(c_df["year"].unique().tolist())
        assert actual_years == spec["years"], (
            f"Year mismatch for {country}: {actual_years} vs {spec['years']}"
        )
        assert (c_df["harmonized_low"] <= c_df["harmonized"] + 1e-6).all()
        assert (c_df["harmonized"] <= c_df["harmonized_high"] + 1e-6).all()

    with open(telemetry_path, "r", encoding="utf-8") as fp:
        tel = json.load(fp)

    print("\n=== Harmonizer Cross-Validation Metrics ===")
    print(json.dumps(tel["harmonizer_model_metrics"], indent=2))

    print("\n=== Regional Telemetry Summary ===")
    for country, cdata in tel["countries"].items():
        top_shap = list(cdata["shap_drivers"].items())[:3]
        print(
            f"- {country:10s} | Years: {cdata['benchmark_years']} | "
            f"MODIS: {cdata['totals']['raw_modis']:,} | "
            f"VIIRS: {cdata['totals']['raw_viirs']:,} | "
            f"Harmonized: {cdata['totals']['harmonized']:,.1f} "
            f"[{cdata['totals']['harmonized_low']:,.1f} - {cdata['totals']['harmonized_high']:,.1f}] | "
            f"FRP(MW): {cdata['totals']['frp_mw']:,.1f} | "
            f"Anom Months: {cdata['totals']['total_anomaly_months']} | "
            f"Top SHAP: {top_shap}"
        )

    routes = {getattr(r, "path", "") for r in app.routes}
    assert "/health" in routes
    assert "/api/analyze-aoi" in routes
    assert "/api/watchdog/subscribe" in routes

    h_res = health_check()
    assert h_res["status"] == "healthy"
    print("\n=== GET /health ===")
    print(json.dumps(h_res, indent=2))

    aoi_res = analyze_aoi(
        AnalyzeAOIRequest(
            country="USA",
            years=[2005, 2010, 2021, 2025],
            top_k_hotspots=3,
        )
    )
    assert aoi_res["status"] == "ok"
    print("\n=== POST /api/analyze-aoi (USA) ===")
    print(json.dumps(aoi_res["summary"], indent=2))
    print("Top Hotspot:", json.dumps(aoi_res["top_active_hotspots"][0], indent=2))

    wd_res = subscribe_watchdog(
        WatchdogSubscribeRequest(
            email="ops@eagles-of-horus.org",
            country="Greece",
            frp_threshold_mw=250.0,
            anomaly_severity_threshold=0.60,
        )
    )
    assert wd_res["status"] == "subscribed"
    print("\n=== POST /api/watchdog/subscribe (Greece) ===")
    print(json.dumps(wd_res, indent=2))

    tel_slice = get_telemetry(country="Canada")
    assert tel_slice["country"] == "Canada"
    print("\n[test] ALL ASSERTIONS PASSED!")


if __name__ == "__main__":
    run_tests()
