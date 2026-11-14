"""
Step 2 & 3a: LightGBM Quantile Harmonizer, Isolation Forest Anomaly Detector & SHAP XAI Pipeline
(`src/train_models.py`) for "Eagles of Horus".

Responsibilities:
1. Using overlapping MODIS+VIIRS years (`2012`, `2021–2025` across the 5 target regions), train
   `LightGBM` quantile regressors (`alpha=0.10, 0.50, 0.90`) with `TimeSeriesSplit` to map MODIS
   physical features to VIIRS scale.
2. Reconstruct harmonized fire counts with 80% confidence intervals (`harmonized_low`,
   `harmonized`, `harmonized_high`) for the pre-VIIRS benchmark years (`2005`, `2010`, and `2012`
   where VIIRS JPSS-1 is absent) in USA and Canada, and unify all 5 countries (`USA`, `Canada`,
   `Brazil`, `Greece`, `Australia`).
3. Train `IsolationForest` on climatology-normalized harmonized metrics to detect anomalies
   (`is_anomaly`, `anomaly_severity`) and compute `shap.TreeExplainer` feature attribution
   percentages per country/month.
4. Export `data/global_5regions_harmonized.parquet`, trained `.pkl` models under `models/`, and
   `data/telemetry_summary.json`.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import IsolationForest
from sklearn.metrics import mean_absolute_error, mean_pinball_loss, r2_score
from sklearn.model_selection import TimeSeriesSplit

from src.clean_pipeline import REGION_SPECS, run_clean_pipeline

HARMONIZER_FEATURES: List[str] = [
    "raw_modis",
    "modis_frp_sum",
    "modis_frp_p90",
    "modis_night_fire_ratio",
    "modis_brightness_mean",
    "lat_bin",
    "lon_bin",
    "sin_month",
    "cos_month",
]

FEATURE_LABELS: Dict[str, str] = {
    "raw_modis": "MODIS Hotspot Count",
    "modis_frp_sum": "Total Radiative Power (FRP Sum)",
    "modis_frp_p90": "Extreme Fire Intensity (FRP P90)",
    "modis_night_fire_ratio": "Nocturnal Fire Ratio (Day/Night='N')",
    "modis_brightness_mean": "Thermal Brightness Temp (Kelvin)",
    "lat_bin": "Latitude Grid (0.5° Bin)",
    "lon_bin": "Longitude Grid (0.5° Bin)",
    "sin_month": "Seasonality Phase (sin_month)",
    "cos_month": "Seasonality Amplitude (cos_month)",
}

ANOMALY_FEATURES: List[str] = [
    "harmonized_z",
    "frp_sum_z",
    "frp_p90_z",
    "night_ratio_anom",
]


def train_quantile_harmonizer(
    paired_df: pd.DataFrame,
    n_splits: int = 5,
) -> Tuple[Dict[str, lgb.LGBMRegressor], Dict[str, object]]:
    """
    Train LightGBM quantile regressors (`alpha=0.10, 0.50, 0.90`) on overlapping
    MODIS+VIIRS benchmark years (`2012`, `2021–2025` where both sensors have coverage)
    using `TimeSeriesSplit`.
    """
    # Identify country-years that have both MODIS and VIIRS observations
    cy_totals = (
        paired_df.groupby(["country", "year"], as_index=False)
        .agg(modis_total=("raw_modis", "sum"), viirs_total=("raw_viirs", "sum"))
    )
    overlap_pairs = cy_totals.loc[
        (cy_totals["year"].isin([2012, 2021, 2022, 2023, 2024, 2025]))
        & (cy_totals["modis_total"] > 0)
        & (cy_totals["viirs_total"] > 0),
        ["country", "year"],
    ]

    train_df = paired_df.merge(overlap_pairs, on=["country", "year"], how="inner")
    # Focus training on cells where MODIS detected fire (plus a sample of MODIS=0 cells)
    modis_pos = train_df.loc[train_df["raw_modis"] > 0].copy()
    modis_zero = train_df.loc[train_df["raw_modis"] == 0].sample(
        n=min(len(modis_pos) // 5, len(train_df.loc[train_df["raw_modis"] == 0])),
        random_state=42,
    )
    train_subset = (
        pd.concat([modis_pos, modis_zero], ignore_index=True)
        .sort_values(["year", "month", "country", "lat_bin", "lon_bin"])
        .reset_index(drop=True)
    )

    X = train_subset[HARMONIZER_FEATURES].astype(float)
    y = train_subset["raw_viirs"].astype(float)

    tscv = TimeSeriesSplit(n_splits=n_splits)
    cv_metrics: List[Dict[str, float]] = []

    lgb_base_params = {
        "n_estimators": 250,
        "learning_rate": 0.06,
        "num_leaves": 63,
        "min_child_samples": 30,
        "subsample": 0.85,
        "colsample_bytree": 0.85,
        "random_state": 42,
        "n_jobs": -1,
        "verbose": -1,
    }

    for fold_idx, (tr_idx, va_idx) in enumerate(tscv.split(X), start=1):
        X_tr, y_tr = X.iloc[tr_idx], y.iloc[tr_idx]
        X_va, y_va = X.iloc[va_idx], y.iloc[va_idx]

        m10 = lgb.LGBMRegressor(objective="quantile", alpha=0.10, **lgb_base_params)
        m50 = lgb.LGBMRegressor(objective="quantile", alpha=0.50, **lgb_base_params)
        m90 = lgb.LGBMRegressor(objective="quantile", alpha=0.90, **lgb_base_params)

        m10.fit(X_tr, y_tr)
        m50.fit(X_tr, y_tr)
        m90.fit(X_tr, y_tr)

        p10 = np.maximum(0.0, m10.predict(X_va))
        p50 = np.maximum(p10, m50.predict(X_va))
        p90 = np.maximum(p50, m90.predict(X_va))

        coverage_80 = float(np.mean((y_va >= p10) & (y_va <= p90)))
        cv_metrics.append(
            {
                "fold": fold_idx,
                "train_size": int(len(tr_idx)),
                "val_size": int(len(va_idx)),
                "pinball_q10": round(float(mean_pinball_loss(y_va, p10, alpha=0.10)), 4),
                "pinball_q50": round(float(mean_pinball_loss(y_va, p50, alpha=0.50)), 4),
                "pinball_q90": round(float(mean_pinball_loss(y_va, p90, alpha=0.90)), 4),
                "mae_q50": round(float(mean_absolute_error(y_va, p50)), 4),
                "r2_q50": round(float(r2_score(y_va, p50)), 4),
                "interval_80_coverage": round(coverage_80, 4),
            }
        )

    # Fit final production quantile models on full overlapping dataset
    models: Dict[str, lgb.LGBMRegressor] = {}
    for label, alpha in [("q10", 0.10), ("q50", 0.50), ("q90", 0.90)]:
        reg = lgb.LGBMRegressor(objective="quantile", alpha=alpha, **lgb_base_params)
        reg.fit(X, y)
        models[label] = reg

    summary = {
        "overlapping_years_used": sorted(overlap_pairs["year"].unique().tolist()),
        "overlapping_country_year_pairs": int(len(overlap_pairs)),
        "training_rows": int(len(train_subset)),
        "features": HARMONIZER_FEATURES,
        "cv_folds": cv_metrics,
        "mean_pinball_q50": round(
            float(np.mean([m["pinball_q50"] for m in cv_metrics])), 4
        ),
        "mean_mae_q50": round(float(np.mean([m["mae_q50"] for m in cv_metrics])), 4),
        "mean_r2_q50": round(float(np.mean([m["r2_q50"] for m in cv_metrics])), 4),
    }
    return models, summary


def reconstruct_harmonized_series(
    paired_df: pd.DataFrame,
    models: Dict[str, lgb.LGBMRegressor],
) -> pd.DataFrame:
    """
    Apply the trained quantile models (`q10`, `q50`, `q90`) to reconstruct harmonized
    VIIRS-scale fire counts (`harmonized_low`, `harmonized`, `harmonized_high`) across
    all 5 countries and all benchmark years (including 2005, 2010, 2012 pre-VIIRS years).
    """
    df = paired_df.copy()
    X_all = df[HARMONIZER_FEATURES].astype(float)

    raw_q10 = np.maximum(0.0, models["q10"].predict(X_all))
    raw_q50 = np.maximum(0.0, models["q50"].predict(X_all))
    raw_q90 = np.maximum(0.0, models["q90"].predict(X_all))

    # Enforce strict quantile monotonicity: q10 <= q50 <= q90
    q_stack = np.sort(np.vstack([raw_q10, raw_q50, raw_q90]), axis=0)
    pred_low = q_stack[0]
    pred_mid = q_stack[1]
    pred_high = q_stack[2]

    # Physical constraint: VIIRS (375m) resolution is finer than MODIS (1km),
    # so when MODIS > 0, harmonized median count should be at least raw_modis
    modis_arr = df["raw_modis"].to_numpy(dtype=float)
    viirs_arr = df["raw_viirs"].to_numpy(dtype=float)

    pred_mid = np.where(modis_arr > 0, np.maximum(pred_mid, modis_arr), pred_mid)
    pred_low = np.where(modis_arr > 0, np.maximum(pred_low, modis_arr * 0.85), pred_low)
    pred_high = np.maximum(pred_high, pred_mid * 1.15)
    pred_low = np.minimum(pred_low, pred_mid)

    # Identify which (country, year) pairs have VIIRS coverage
    cy_viirs = df.groupby(["country", "year"])["raw_viirs"].transform("sum") > 0
    has_viirs = cy_viirs.to_numpy()

    # For pre-VIIRS years (2005, 2010, and 2012 where VIIRS JPSS-1 is absent),
    # use the LightGBM quantile harmonized predictions directly.
    # For overlapping years (2021-2025), unify observed VIIRS and MODIS-reconstructed
    # quantile estimates so every cell has a calibrated harmonized count and 80% CI.
    harm_mid = np.where(
        ~has_viirs,
        pred_mid,
        np.where(
            (viirs_arr > 0) & (modis_arr > 0),
            0.70 * viirs_arr + 0.30 * pred_mid,
            np.where(viirs_arr > 0, viirs_arr, pred_mid),
        ),
    )
    harm_low = np.where(
        ~has_viirs,
        pred_low,
        np.minimum(harm_mid * 0.85, np.where(modis_arr > 0, pred_low, harm_mid * 0.85)),
    )
    harm_high = np.where(
        ~has_viirs,
        pred_high,
        np.maximum(harm_mid * 1.15, np.where(modis_arr > 0, pred_high, harm_mid * 1.15)),
    )

    df["harmonized_low"] = np.round(harm_low, 2)
    df["harmonized"] = np.round(harm_mid, 2)
    df["harmonized_high"] = np.round(harm_high, 2)

    # Harmonize FRP (MW) so pre-VIIRS and VIIRS eras are on unified radiative power scale
    df["frp_mw"] = np.round(
        np.where(
            df["viirs_frp_sum"] > 0,
            df["viirs_frp_sum"],
            df["modis_frp_sum"],
        ),
        2,
    )
    df["frp_sum"] = df["frp_mw"]
    return df


def detect_climatology_anomalies(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, IsolationForest]:
    """
    Compute climatology-normalized harmonized metrics per `(country, month)` and train
    an `IsolationForest` to flag wildfire anomalies (`is_anomaly`, `anomaly_severity`).
    """
    df = df.copy()
    clim = (
        df.groupby(["country", "month"], as_index=False)
        .agg(
            clim_harm_mean=("harmonized", "mean"),
            clim_harm_std=("harmonized", "std"),
            clim_frp_mean=("frp_sum", "mean"),
            clim_frp_std=("frp_sum", "std"),
            clim_p90_mean=("frp_p90", "mean"),
            clim_p90_std=("frp_p90", "std"),
            clim_night_mean=("night_fire_ratio", "mean"),
        )
    )
    clim["clim_harm_std"] = clim["clim_harm_std"].fillna(1.0).replace(0.0, 1.0)
    clim["clim_frp_std"] = clim["clim_frp_std"].fillna(1.0).replace(0.0, 1.0)
    clim["clim_p90_std"] = clim["clim_p90_std"].fillna(1.0).replace(0.0, 1.0)

    df = df.merge(clim, on=["country", "month"], how="left")
    df["harmonized_z"] = (df["harmonized"] - df["clim_harm_mean"]) / (
        df["clim_harm_std"] + 1.0
    )
    df["frp_sum_z"] = (df["frp_sum"] - df["clim_frp_mean"]) / (
        df["clim_frp_std"] + 1.0
    )
    df["frp_p90_z"] = (df["frp_p90"] - df["clim_p90_mean"]) / (
        df["clim_p90_std"] + 1.0
    )
    df["night_ratio_anom"] = df["night_fire_ratio"] - df["clim_night_mean"]

    X_anom = df[ANOMALY_FEATURES].fillna(0.0).to_numpy(dtype=float)

    iso_forest = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )
    iso_preds = iso_forest.fit_predict(X_anom)
    raw_scores = -iso_forest.decision_function(X_anom)

    # Normalize anomaly severity to [0.0, 1.0]
    s_min, s_max = float(np.percentile(raw_scores, 1)), float(np.percentile(raw_scores, 99.5))
    severity = np.clip((raw_scores - s_min) / max(s_max - s_min, 1e-6), 0.0, 1.0)

    # Flag as wildfire anomaly only when IsolationForest predicts -1 AND activity is above baseline
    is_anom = (iso_preds == -1) & (
        (df["harmonized_z"] > 0.5) | (df["frp_sum_z"] > 0.5)
    )

    df["is_anomaly"] = is_anom.astype(bool)
    df["anomaly_severity"] = np.round(severity, 4)

    drop_clim_cols = [
        "clim_harm_mean",
        "clim_harm_std",
        "clim_frp_mean",
        "clim_frp_std",
        "clim_p90_mean",
        "clim_p90_std",
        "clim_night_mean",
    ]
    df = df.drop(columns=drop_clim_cols)
    return df, iso_forest


def compute_shap_attributions(
    df: pd.DataFrame,
    model_q50: lgb.LGBMRegressor,
) -> Tuple[Dict[str, Dict[str, float]], Dict[Tuple[str, int], Dict[str, float]]]:
    """
    Use `shap.TreeExplainer` on the median quantile LightGBM model (`q50`) to compute
    feature attribution percentages (`sum = 100%`) per country overall and per `(country, month)`.
    """
    explainer = shap.TreeExplainer(model_q50)

    country_overall_shap: Dict[str, Dict[str, float]] = {}
    country_month_shap: Dict[Tuple[str, int], Dict[str, float]] = {}

    for country in REGION_SPECS.keys():
        c_df = df.loc[df["country"] == country]
        if c_df.empty:
            continue

        # Sample up to 200 rows per (country, month) for fast, exact TreeSHAP attribution
        sampled_parts: List[pd.DataFrame] = []
        for month, m_df in c_df.groupby("month"):
            active_m = m_df.loc[m_df["raw_modis"] > 0]
            source_m = active_m if len(active_m) >= 10 else m_df
            sample_m = source_m.sample(
                n=min(200, len(source_m)), random_state=42
            ).copy()
            sampled_parts.append(sample_m)

            X_m = sample_m[HARMONIZER_FEATURES].astype(float)
            sv_m = np.abs(explainer.shap_values(X_m))
            mean_sv_m = np.mean(sv_m, axis=0)
            total_sv_m = float(np.sum(mean_sv_m)) or 1.0
            pct_m = {
                feat: round(100.0 * float(val) / total_sv_m, 2)
                for feat, val in zip(HARMONIZER_FEATURES, mean_sv_m)
            }
            country_month_shap[(country, int(month))] = dict(
                sorted(pct_m.items(), key=lambda kv: kv[1], reverse=True)
            )

        c_sample = pd.concat(sampled_parts, ignore_index=True)
        X_c = c_sample[HARMONIZER_FEATURES].astype(float)
        sv_c = np.abs(explainer.shap_values(X_c))
        mean_sv_c = np.mean(sv_c, axis=0)
        total_sv_c = float(np.sum(mean_sv_c)) or 1.0
        pct_c = {
            feat: round(100.0 * float(val) / total_sv_c, 2)
            for feat, val in zip(HARMONIZER_FEATURES, mean_sv_c)
        }
        country_overall_shap[country] = dict(
            sorted(pct_c.items(), key=lambda kv: kv[1], reverse=True)
        )

    return country_overall_shap, country_month_shap


def build_telemetry_summary(
    df: pd.DataFrame,
    country_overall_shap: Dict[str, Dict[str, float]],
    country_month_shap: Dict[Tuple[str, int], Dict[str, float]],
    model_metrics: Dict[str, object],
    cleaning_stats: Dict[str, object],
) -> Dict[str, object]:
    """
    Construct `data/telemetry_summary.json` structured by country (`USA`, `Canada`,
    `Brazil`, `Greece`, `Australia`) with each country's exact benchmark years, monthly
    `raw_modis`, `raw_viirs`, `harmonized`, `frp_mw`, `is_anomaly`, top active hotspots,
    and SHAP drivers.
    """
    # Fit a country-month level IsolationForest so monthly time-series anomaly flags
    # reflect regional wildfire surges (e.g. Canada 2023 summer, Greece 2023 August, etc.)
    monthly_agg = (
        df.groupby(["country", "year", "month"], as_index=False)
        .agg(
            raw_modis=("raw_modis", "sum"),
            raw_viirs=("raw_viirs", "sum"),
            harmonized_low=("harmonized_low", "sum"),
            harmonized=("harmonized", "sum"),
            harmonized_high=("harmonized_high", "sum"),
            frp_mw=("frp_mw", "sum"),
            frp_p90=("frp_p90", "mean"),
            night_fire_ratio=("night_fire_ratio", "mean"),
            grid_anomalies=("is_anomaly", "sum"),
            max_grid_severity=("anomaly_severity", "max"),
        )
        .sort_values(["country", "year", "month"])
        .reset_index(drop=True)
    )

    m_clim = (
        monthly_agg.groupby(["country", "month"], as_index=False)
        .agg(
            c_harm_mean=("harmonized", "mean"),
            c_harm_std=("harmonized", "std"),
            c_frp_mean=("frp_mw", "mean"),
            c_frp_std=("frp_mw", "std"),
        )
    )
    m_clim["c_harm_std"] = m_clim["c_harm_std"].fillna(1.0).replace(0.0, 1.0)
    m_clim["c_frp_std"] = m_clim["c_frp_std"].fillna(1.0).replace(0.0, 1.0)
    monthly_agg = monthly_agg.merge(m_clim, on=["country", "month"], how="left")
    monthly_agg["m_harm_z"] = (
        monthly_agg["harmonized"] - monthly_agg["c_harm_mean"]
    ) / (monthly_agg["c_harm_std"] + 1.0)
    monthly_agg["m_frp_z"] = (monthly_agg["frp_mw"] - monthly_agg["c_frp_mean"]) / (
        monthly_agg["c_frp_std"] + 1.0
    )

    m_iso = IsolationForest(n_estimators=200, contamination=0.10, random_state=42)
    X_m_anom = monthly_agg[["m_harm_z", "m_frp_z", "frp_p90", "night_fire_ratio"]].fillna(0.0)
    m_preds = m_iso.fit_predict(X_m_anom)
    m_scores = -m_iso.decision_function(X_m_anom)
    ms_min, ms_max = float(np.min(m_scores)), float(np.max(m_scores))
    monthly_agg["monthly_severity"] = np.clip(
        (m_scores - ms_min) / max(ms_max - ms_min, 1e-6), 0.0, 1.0
    )
    monthly_agg["is_anomaly"] = (
        ((m_preds == -1) & ((monthly_agg["m_harm_z"] > 0.35) | (monthly_agg["m_frp_z"] > 0.35)))
        | (monthly_agg["m_harm_z"] > 1.1)
    ).astype(bool)

    countries_payload: Dict[str, object] = {}
    for country, spec in REGION_SPECS.items():
        c_grid = df.loc[df["country"] == country]
        c_monthly = monthly_agg.loc[monthly_agg["country"] == country].sort_values(
            ["year", "month"]
        )

        # Monthly telemetry entries
        monthly_records: List[Dict[str, object]] = []
        for _, row in c_monthly.iterrows():
            yr = int(row["year"])
            mo = int(row["month"])
            m_shap = country_month_shap.get(
                (country, mo), country_overall_shap.get(country, {})
            )
            monthly_records.append(
                {
                    "year": yr,
                    "month": mo,
                    "period": f"{yr}-{mo:02d}",
                    "raw_modis": int(row["raw_modis"]),
                    "raw_viirs": int(row["raw_viirs"]),
                    "harmonized_low": round(float(row["harmonized_low"]), 1),
                    "harmonized": round(float(row["harmonized"]), 1),
                    "harmonized_high": round(float(row["harmonized_high"]), 1),
                    "frp_mw": round(float(row["frp_mw"]), 2),
                    "frp_p90": round(float(row["frp_p90"]), 2),
                    "night_fire_ratio": round(float(row["night_fire_ratio"]), 4),
                    "is_anomaly": bool(row["is_anomaly"]),
                    "anomaly_severity": round(float(row["monthly_severity"]), 4),
                    "grid_anomaly_cells": int(row["grid_anomalies"]),
                    "shap_drivers": m_shap,
                }
            )

        # Yearly summary series across the exact target benchmark years
        yearly_records: List[Dict[str, object]] = []
        for yr in spec["years"]:
            y_rows = c_monthly.loc[c_monthly["year"] == yr]
            yearly_records.append(
                {
                    "year": int(yr),
                    "raw_modis": int(y_rows["raw_modis"].sum()),
                    "raw_viirs": int(y_rows["raw_viirs"].sum()),
                    "harmonized_low": round(float(y_rows["harmonized_low"].sum()), 1),
                    "harmonized": round(float(y_rows["harmonized"].sum()), 1),
                    "harmonized_high": round(float(y_rows["harmonized_high"].sum()), 1),
                    "frp_mw": round(float(y_rows["frp_mw"].sum()), 2),
                    "night_fire_ratio": round(
                        float(y_rows["night_fire_ratio"].mean()) if len(y_rows) else 0.0,
                        4,
                    ),
                    "is_anomaly": bool(y_rows["is_anomaly"].any()),
                    "anomaly_months": int(y_rows["is_anomaly"].sum()),
                }
            )

        # Top active 0.5° x 0.5° hotspots in this country
        hotspot_rank = (
            c_grid.groupby(["lat_bin", "lon_bin"], as_index=False)
            .agg(
                raw_modis=("raw_modis", "sum"),
                raw_viirs=("raw_viirs", "sum"),
                harmonized=("harmonized", "sum"),
                frp_mw=("frp_mw", "sum"),
                frp_p90=("frp_p90", "max"),
                night_fire_ratio=("night_fire_ratio", "mean"),
                anomaly_months=("is_anomaly", "sum"),
                max_anomaly_severity=("anomaly_severity", "max"),
            )
            .sort_values("harmonized", ascending=False)
            .head(15)
        )
        top_hotspots: List[Dict[str, object]] = []
        for _, hrow in hotspot_rank.iterrows():
            top_hotspots.append(
                {
                    "lat_bin": float(hrow["lat_bin"]),
                    "lon_bin": float(hrow["lon_bin"]),
                    "raw_modis": int(hrow["raw_modis"]),
                    "raw_viirs": int(hrow["raw_viirs"]),
                    "harmonized": round(float(hrow["harmonized"]), 1),
                    "frp_mw": round(float(hrow["frp_mw"]), 2),
                    "frp_p90": round(float(hrow["frp_p90"]), 2),
                    "night_fire_ratio": round(float(hrow["night_fire_ratio"]), 4),
                    "is_anomaly": bool(hrow["anomaly_months"] > 0),
                    "anomaly_months": int(hrow["anomaly_months"]),
                    "anomaly_severity": round(float(hrow["max_anomaly_severity"]), 4),
                }
            )

        overall_shap = country_overall_shap.get(country, {})
        shap_driver_list = [
            {
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "attribution_pct": pct,
            }
            for feat, pct in overall_shap.items()
        ]

        countries_payload[country] = {
            "country": country,
            "benchmark_years": spec["years"],
            "bbox": {
                "lat_min": spec["lat_min"],
                "lat_max": spec["lat_max"],
                "lon_min": spec["lon_min"],
                "lon_max": spec["lon_max"],
            },
            "totals": {
                "raw_modis": int(c_monthly["raw_modis"].sum()),
                "raw_viirs": int(c_monthly["raw_viirs"].sum()),
                "harmonized_low": round(float(c_monthly["harmonized_low"].sum()), 1),
                "harmonized": round(float(c_monthly["harmonized"].sum()), 1),
                "harmonized_high": round(float(c_monthly["harmonized_high"].sum()), 1),
                "frp_mw": round(float(c_monthly["frp_mw"].sum()), 2),
                "total_anomaly_months": int(c_monthly["is_anomaly"].sum()),
                "total_grid_anomaly_cells": int(c_grid["is_anomaly"].sum()),
            },
            "yearly": yearly_records,
            "monthly": monthly_records,
            "top_active_hotspots": top_hotspots,
            "shap_drivers": overall_shap,
            "shap_drivers_ranked": shap_driver_list,
            "monthly_shap_drivers": {
                f"{mo:02d}": country_month_shap.get((country, mo), overall_shap)
                for mo in range(1, 13)
            },
        }

    return {
        "project": "Eagles of Horus — Cross-Sensor Wildfire Intelligence & Harmonization",
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "spatial_resolution_deg": 0.5,
        "target_regions": list(REGION_SPECS.keys()),
        "cleaning_audit": {
            "total_files_processed": cleaning_stats.get("total_files_processed", 44),
            "total_raw_rows": cleaning_stats.get("total_raw_rows", 0),
            "total_cleaned_rows": cleaning_stats.get("total_cleaned_rows", 0),
            "retention_rate_pct": cleaning_stats.get("retention_rate_pct", 0.0),
            "paired_grid_cells": int(len(df)),
        },
        "harmonizer_model_metrics": model_metrics,
        "countries": countries_payload,
    }


def run_training_pipeline(
    project_root: Path,
) -> Tuple[pd.DataFrame, Dict[str, object]]:
    """
    End-to-end execution of Step 1 (if not already cached) + Step 2 + Step 3a artifact export.
    """
    t0 = time.time()
    data_dir = project_root / "data"
    models_dir = project_root / "models"
    raw_dir = project_root / "raw_data"
    if not raw_dir.exists():
        raw_dir = Path(r"C:\Users\Mohamed Gabr\Desktop\NASA")

    data_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)

    paired_cache = data_dir / "cleaned_paired_grid.parquet"
    audit_cache = data_dir / "cleaning_audit.json"

    if paired_cache.exists() and audit_cache.exists():
        print("[train_models] Loading cached cleaned paired grid...")
        paired_df = pd.read_parquet(paired_cache)
        with open(audit_cache, "r", encoding="utf-8") as fp:
            cleaning_stats = json.load(fp)
    else:
        print("[train_models] Running clean_pipeline first...")
        _, paired_df, cleaning_stats = run_clean_pipeline(raw_dir, data_dir)

    print("[train_models] Training LightGBM Quantile Harmonizers (alpha=0.10, 0.50, 0.90)...")
    models, model_metrics = train_quantile_harmonizer(paired_df, n_splits=5)

    print("[train_models] Reconstructing harmonized fire counts & 80% confidence intervals...")
    harmonized_df = reconstruct_harmonized_series(paired_df, models)

    print("[train_models] Training IsolationForest on climatology-normalized metrics...")
    harmonized_df, iso_forest = detect_climatology_anomalies(harmonized_df)

    print("[train_models] Computing SHAP TreeExplainer feature attributions per country/month...")
    country_overall_shap, country_month_shap = compute_shap_attributions(
        harmonized_df, models["q50"]
    )

    # Save parquet artifact
    parquet_path = data_dir / "global_5regions_harmonized.parquet"
    harmonized_df.to_parquet(parquet_path, index=False)
    print(f"[train_models] Saved harmonized grid dataset: {parquet_path} ({len(harmonized_df):,} rows)")

    # Save .pkl models
    joblib.dump(models["q10"], models_dir / "lgbm_harmonizer_q10.pkl")
    joblib.dump(models["q50"], models_dir / "lgbm_harmonizer_q50.pkl")
    joblib.dump(models["q90"], models_dir / "lgbm_harmonizer_q90.pkl")
    joblib.dump(
        {
            "models": models,
            "features": HARMONIZER_FEATURES,
            "feature_labels": FEATURE_LABELS,
            "metrics": model_metrics,
        },
        models_dir / "lgbm_quantile_harmonizer.pkl",
    )
    joblib.dump(
        {
            "model": iso_forest,
            "features": ANOMALY_FEATURES,
        },
        models_dir / "isolation_forest_anomaly.pkl",
    )
    print(f"[train_models] Saved trained .pkl models to: {models_dir}")

    # Build and save telemetry_summary.json
    telemetry = build_telemetry_summary(
        harmonized_df,
        country_overall_shap,
        country_month_shap,
        model_metrics,
        cleaning_stats,
    )
    telemetry_path = data_dir / "telemetry_summary.json"
    with open(telemetry_path, "w", encoding="utf-8") as fp:
        json.dump(telemetry, fp, indent=2)
    print(
        f"[train_models] Saved telemetry summary: {telemetry_path} "
        f"(Completed in {round(time.time() - t0, 2)}s)"
    )
    return harmonized_df, telemetry


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    run_training_pipeline(root)
