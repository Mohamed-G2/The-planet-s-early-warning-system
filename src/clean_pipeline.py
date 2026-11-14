"""
Step 1: Modular Data Cleaning & Spatial-Temporal Aggregation Pipeline (`src/clean_pipeline.py`)
for "Eagles of Horus".

Responsibilities:
1. Inspect and ingest all MODIS & VIIRS CSV files from `raw_data` (or fallback NASA directory).
2. Standardize columns (`latitude`, `longitude`, `acq_date`, `frp`, `confidence`, `daynight`,
   `brightness`/`bright_ti4`, `instrument`), drop duplicates and nulls, and apply sensor-specific
   quality gates (`confidence >= 30` for MODIS; `confidence != 'l'` for VIIRS).
3. Tag each record by `country` (`USA`, `Canada`, `Brazil`, `Greece`, `Australia`) using its
   exact spatial bounding box and filter strictly to each country's target benchmark years.
4. Aggregate by `country`, `year`, `month`, and `0.5° x 0.5°` grid cells (`lat_bin`, `lon_bin`),
   computing `hotspot_count`, `frp_sum`, `frp_p90`, `night_fire_ratio` (`daynight == 'N'`),
   `brightness_mean`, and cyclical month features (`sin_month`, `cos_month`), both per-instrument
   and pivoted for cross-sensor harmonization.
"""

from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import duckdb
import numpy as np
import pandas as pd

# Exact 5 target regions: bounding boxes and benchmark years
REGION_SPECS: Dict[str, Dict[str, object]] = {
    "USA": {
        "lat_min": 24.5,
        "lat_max": 49.5,
        "lon_min": -125.0,
        "lon_max": -66.5,
        "years": [2005, 2010, 2012, 2021, 2022, 2023, 2024, 2025],
    },
    "Canada": {
        "lat_min": 41.7,
        "lat_max": 83.1,
        "lon_min": -141.0,
        "lon_max": -52.6,
        "years": [2005, 2010, 2012, 2021, 2022, 2023, 2024, 2025],
    },
    "Brazil": {
        "lat_min": -33.7,
        "lat_max": 5.3,
        "lon_min": -74.0,
        "lon_max": -34.8,
        "years": [2023, 2024, 2025],
    },
    "Greece": {
        "lat_min": 34.8,
        "lat_max": 41.8,
        "lon_min": 19.3,
        "lon_max": 29.6,
        "years": [2023, 2024, 2025],
    },
    "Australia": {
        "lat_min": -43.6,
        "lat_max": -10.7,
        "lon_min": 113.3,
        "lon_max": 153.6,
        "years": [2023, 2024, 2025],
    },
}

STANDARD_COLUMNS = [
    "latitude",
    "longitude",
    "acq_date",
    "frp",
    "confidence",
    "daynight",
    "brightness",
    "instrument",
]


def infer_country_from_path(file_path: Path) -> Optional[str]:
    """Infer target country label from file path or filename if present."""
    parts_upper = [p.upper() for p in file_path.parts]
    name_upper = file_path.name.upper()
    if "USA" in parts_upper or "UNITED_STATES" in name_upper:
        return "USA"
    if "CANADA" in parts_upper or "CANADA" in name_upper:
        return "Canada"
    if "BRAZIL" in parts_upper or "BRAZIL" in name_upper:
        return "Brazil"
    if "GREECE" in parts_upper or "GREECE" in name_upper:
        return "Greece"
    if "AUSTRALIA" in parts_upper or "AUSTRALIA" in name_upper:
        return "Australia"
    return None


def inspect_raw_csvs(raw_dir: Path) -> List[Dict[str, object]]:
    """
    Inspect all CSV files in `raw_dir`, checking column names, date formats,
    satellite/instrument names, and row counts.
    """
    csv_files = sorted(raw_dir.rglob("*.csv"))
    con = duckdb.connect(":memory:")
    report: List[Dict[str, object]] = []

    for f in csv_files:
        rel_path = str(f.relative_to(raw_dir))
        with open(f, "r", encoding="utf-8", errors="replace") as fp:
            header_line = fp.readline().strip()
            first_row_line = fp.readline().strip()

        cols = [c.strip() for c in header_line.split(",")]
        vals = [v.strip() for v in first_row_line.split(",")] if first_row_line else []
        row_map = dict(zip(cols, vals))

        escaped_path = str(f).replace("'", "''")
        row_count = con.execute(
            f"SELECT COUNT(*) FROM read_csv_auto('{escaped_path}', header=True)"
        ).fetchone()[0]

        report.append(
            {
                "file": rel_path,
                "country_hint": infer_country_from_path(f),
                "row_count": int(row_count),
                "columns": cols,
                "sample_acq_date": row_map.get("acq_date", ""),
                "satellite": row_map.get("satellite", ""),
                "instrument": row_map.get("instrument", ""),
                "sample_confidence": row_map.get("confidence", ""),
            }
        )
    con.close()
    return report


def standardize_dataframe(
    df: pd.DataFrame, country_hint: Optional[str] = None
) -> pd.DataFrame:
    """
    Standardize an in-memory DataFrame:
    - Map `bright_ti4` -> `brightness` (preserving `bright_ti4` alias if needed)
    - Ensure required columns exist
    - Drop nulls and duplicates
    - Apply sensor quality gates (`confidence >= 30` for MODIS; `confidence != 'l'` for VIIRS)
    - Tag by `country` and filter strictly to bounding boxes & benchmark years
    """
    df = df.copy()
    if "brightness" not in df.columns and "bright_ti4" in df.columns:
        df["brightness"] = df["bright_ti4"]
    elif "brightness" in df.columns and "bright_ti4" in df.columns:
        df["brightness"] = df["brightness"].fillna(df["bright_ti4"])

    missing = [c for c in STANDARD_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required standardized columns: {missing}")

    # Keep relevant columns for deduplication and aggregation
    dedup_cols = [
        c
        for c in [
            "latitude",
            "longitude",
            "acq_date",
            "acq_time",
            "instrument",
            "frp",
            "brightness",
            "daynight",
        ]
        if c in df.columns
    ]
    df = df.dropna(subset=STANDARD_COLUMNS).drop_duplicates(subset=dedup_cols)

    df["instrument"] = df["instrument"].astype(str).str.strip().str.upper()
    df["daynight"] = df["daynight"].astype(str).str.strip().str.upper()

    # Quality gates: confidence >= 30 for MODIS; confidence != 'l' for VIIRS
    is_modis = df["instrument"] == "MODIS"
    is_viirs = df["instrument"] == "VIIRS"

    modis_conf = pd.to_numeric(df.loc[is_modis, "confidence"], errors="coerce") >= 30
    viirs_conf = (
        df.loc[is_viirs, "confidence"].astype(str).str.strip().str.lower() != "l"
    )

    keep_mask = pd.Series(False, index=df.index)
    keep_mask.loc[is_modis] = modis_conf
    keep_mask.loc[is_viirs] = viirs_conf
    df = df.loc[keep_mask].copy()

    # Parse dates
    dt = pd.to_datetime(df["acq_date"], format="%Y-%m-%d", errors="coerce")
    df = df.loc[dt.notna()].copy()
    df["year"] = dt.loc[dt.notna()].dt.year.astype(int)
    df["month"] = dt.loc[dt.notna()].dt.month.astype(int)

    # Tag country and enforce exact bounding boxes + target benchmark years
    if country_hint and country_hint in REGION_SPECS:
        spec = REGION_SPECS[country_hint]
        bbox_mask = (
            (df["latitude"] >= spec["lat_min"])
            & (df["latitude"] <= spec["lat_max"])
            & (df["longitude"] >= spec["lon_min"])
            & (df["longitude"] <= spec["lon_max"])
            & (df["year"].isin(spec["years"]))
        )
        df = df.loc[bbox_mask].copy()
        df["country"] = country_hint
    else:
        df["country"] = None
        for cname, spec in REGION_SPECS.items():
            m = (
                df["country"].isna()
                & (df["latitude"] >= spec["lat_min"])
                & (df["latitude"] <= spec["lat_max"])
                & (df["longitude"] >= spec["lon_min"])
                & (df["longitude"] <= spec["lon_max"])
                & (df["year"].isin(spec["years"]))
            )
            df.loc[m, "country"] = cname
        df = df.dropna(subset=["country"]).copy()

    # 0.5° x 0.5° grid bins
    df["lat_bin"] = np.floor(df["latitude"].astype(float) * 2.0) / 2.0
    df["lon_bin"] = np.floor(df["longitude"].astype(float) * 2.0) / 2.0
    return df


def aggregate_grid_cells(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate a standardized DataFrame by `country`, `instrument`, `year`, `month`,
    `lat_bin`, `lon_bin`, computing `hotspot_count`, `frp_sum`, `frp_p90`,
    `night_fire_ratio`, `brightness_mean`, and cyclical month features (`sin_month`, `cos_month`).
    """
    df = df.copy()
    df["is_night"] = (df["daynight"] == "N").astype(float)
    group_cols = ["country", "instrument", "year", "month", "lat_bin", "lon_bin"]

    agg = (
        df.groupby(group_cols, as_index=False)
        .agg(
            hotspot_count=("frp", "count"),
            frp_sum=("frp", "sum"),
            frp_p90=("frp", lambda s: float(np.percentile(s, 90))),
            night_fire_ratio=("is_night", "mean"),
            brightness_mean=("brightness", "mean"),
        )
        .sort_values(group_cols)
        .reset_index(drop=True)
    )
    agg["sin_month"] = np.sin(2.0 * np.pi * agg["month"] / 12.0)
    agg["cos_month"] = np.cos(2.0 * np.pi * agg["month"] / 12.0)
    return agg


def run_clean_pipeline(
    raw_dir: Path,
    output_dir: Path,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, object]]:
    """
    Execute the full high-throughput DuckDB + Pandas cleaning & aggregation pipeline
    across all 44 CSV files in `raw_dir`.

    Returns:
      - `sensor_grid_df`: Per-instrument (`MODIS`, `VIIRS`) 0.5°x0.5° monthly grid aggregations
      - `paired_grid_df`: Unified `(country, year, month, lat_bin, lon_bin)` grid table containing
        MODIS features, VIIRS features, and combined raw metrics ready for harmonization
      - `cleaning_stats`: Detailed summary of raw vs cleaned row counts per country and sensor
    """
    t0 = time.time()
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_files = sorted(raw_dir.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found under {raw_dir}")

    con = duckdb.connect(":memory:")
    con.execute("PRAGMA threads=8;")
    con.execute(
        """
        CREATE TABLE combined_sensor_grid (
            country VARCHAR,
            instrument VARCHAR,
            year INTEGER,
            month INTEGER,
            lat_bin DOUBLE,
            lon_bin DOUBLE,
            hotspot_count BIGINT,
            frp_sum DOUBLE,
            frp_p90 DOUBLE,
            night_fire_ratio DOUBLE,
            brightness_mean DOUBLE
        )
        """
    )

    file_stats: List[Dict[str, object]] = []

    for f in csv_files:
        country = infer_country_from_path(f)
        if country not in REGION_SPECS:
            continue
        spec = REGION_SPECS[country]
        years_sql = ", ".join(str(y) for y in spec["years"])
        escaped_path = str(f).replace("'", "''")

        with open(f, "r", encoding="utf-8", errors="replace") as fp:
            header_cols = [c.strip().lower() for c in fp.readline().strip().split(",")]

        bright_col = "brightness" if "brightness" in header_cols else "bright_ti4"
        is_modis_file = "modis" in f.name.lower() or "modis" in [p.lower() for p in f.parts]

        if is_modis_file:
            conf_filter = "TRY_CAST(confidence AS DOUBLE) >= 30.0"
            inst_literal = "'MODIS'"
        else:
            conf_filter = "LOWER(TRIM(CAST(confidence AS VARCHAR))) != 'l'"
            inst_literal = "'VIIRS'"

        con.execute("DROP TABLE IF EXISTS tmp_raw;")
        con.execute("DROP TABLE IF EXISTS tmp_clean;")

        con.execute(
            f"""
            CREATE TEMP TABLE tmp_raw AS
            SELECT
                TRY_CAST(latitude AS DOUBLE) AS latitude,
                TRY_CAST(longitude AS DOUBLE) AS longitude,
                CAST(acq_date AS VARCHAR) AS acq_date,
                CAST(acq_time AS VARCHAR) AS acq_time,
                TRY_CAST(frp AS DOUBLE) AS frp,
                confidence,
                UPPER(TRIM(CAST(daynight AS VARCHAR))) AS daynight,
                TRY_CAST({bright_col} AS DOUBLE) AS brightness,
                {inst_literal} AS instrument,
                TRY_CAST(SUBSTR(CAST(acq_date AS VARCHAR), 1, 4) AS INTEGER) AS year,
                TRY_CAST(SUBSTR(CAST(acq_date AS VARCHAR), 6, 2) AS INTEGER) AS month
            FROM read_csv_auto('{escaped_path}', header=True, all_varchar=True)
            """
        )

        con.execute(
            f"""
            CREATE TEMP TABLE tmp_clean AS
            SELECT DISTINCT
                latitude, longitude, acq_date, acq_time, frp, confidence,
                daynight, brightness, instrument, year, month
            FROM tmp_raw
            WHERE latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND acq_date IS NOT NULL
              AND frp IS NOT NULL
              AND confidence IS NOT NULL
              AND daynight IS NOT NULL
              AND brightness IS NOT NULL
              AND year IS NOT NULL
              AND month BETWEEN 1 AND 12
              AND {conf_filter}
              AND latitude BETWEEN {spec['lat_min']} AND {spec['lat_max']}
              AND longitude BETWEEN {spec['lon_min']} AND {spec['lon_max']}
              AND year IN ({years_sql})
            """
        )

        raw_rows = con.execute("SELECT COUNT(*) FROM tmp_raw").fetchone()[0]
        clean_rows = con.execute("SELECT COUNT(*) FROM tmp_clean").fetchone()[0]
        file_stats.append(
            {
                "file": str(f.relative_to(raw_dir)),
                "country": country,
                "instrument": "MODIS" if is_modis_file else "VIIRS",
                "raw_rows": int(raw_rows),
                "clean_rows": int(clean_rows),
            }
        )

        con.execute(
            f"""
            INSERT INTO combined_sensor_grid
            SELECT
                '{country}' AS country,
                instrument,
                year,
                month,
                FLOOR(latitude * 2.0) / 2.0 AS lat_bin,
                FLOOR(longitude * 2.0) / 2.0 AS lon_bin,
                COUNT(*)::BIGINT AS hotspot_count,
                SUM(frp)::DOUBLE AS frp_sum,
                QUANTILE_CONT(frp, 0.90)::DOUBLE AS frp_p90,
                AVG(CASE WHEN daynight = 'N' THEN 1.0 ELSE 0.0 END)::DOUBLE AS night_fire_ratio,
                AVG(brightness)::DOUBLE AS brightness_mean
            FROM tmp_clean
            GROUP BY 1, 2, 3, 4, 5, 6
            """
        )

    final_sensor_sql = """
    SELECT
        country,
        instrument,
        year,
        month,
        lat_bin,
        lon_bin,
        SUM(hotspot_count)::BIGINT AS hotspot_count,
        SUM(frp_sum)::DOUBLE AS frp_sum,
        AVG(frp_p90)::DOUBLE AS frp_p90,
        SUM(night_fire_ratio * hotspot_count) / NULLIF(SUM(hotspot_count), 0) AS night_fire_ratio,
        SUM(brightness_mean * hotspot_count) / NULLIF(SUM(hotspot_count), 0) AS brightness_mean,
        SIN(2.0 * PI() * month / 12.0) AS sin_month,
        COS(2.0 * PI() * month / 12.0) AS cos_month
    FROM combined_sensor_grid
    GROUP BY 1, 2, 3, 4, 5, 6
    ORDER BY country, year, month, instrument, lat_bin, lon_bin
    """
    sensor_grid_df = con.execute(final_sensor_sql).df()

    # Build paired grid table joining MODIS and VIIRS per (country, year, month, lat_bin, lon_bin)
    con.register("sensor_grid_view", sensor_grid_df)
    paired_sql = """
    WITH modis AS (
        SELECT
            country, year, month, lat_bin, lon_bin,
            hotspot_count AS raw_modis,
            frp_sum AS modis_frp_sum,
            frp_p90 AS modis_frp_p90,
            night_fire_ratio AS modis_night_fire_ratio,
            brightness_mean AS modis_brightness_mean
        FROM sensor_grid_view
        WHERE instrument = 'MODIS'
    ),
    viirs AS (
        SELECT
            country, year, month, lat_bin, lon_bin,
            hotspot_count AS raw_viirs,
            frp_sum AS viirs_frp_sum,
            frp_p90 AS viirs_frp_p90,
            night_fire_ratio AS viirs_night_fire_ratio,
            brightness_mean AS viirs_brightness_mean
        FROM sensor_grid_view
        WHERE instrument = 'VIIRS'
    )
    SELECT
        COALESCE(m.country, v.country) AS country,
        COALESCE(m.year, v.year)::INTEGER AS year,
        COALESCE(m.month, v.month)::INTEGER AS month,
        COALESCE(m.lat_bin, v.lat_bin)::DOUBLE AS lat_bin,
        COALESCE(m.lon_bin, v.lon_bin)::DOUBLE AS lon_bin,
        COALESCE(m.raw_modis, 0)::BIGINT AS raw_modis,
        COALESCE(v.raw_viirs, 0)::BIGINT AS raw_viirs,
        (COALESCE(m.raw_modis, 0) + COALESCE(v.raw_viirs, 0))::BIGINT AS hotspot_count,
        COALESCE(m.modis_frp_sum, 0.0)::DOUBLE AS modis_frp_sum,
        COALESCE(v.viirs_frp_sum, 0.0)::DOUBLE AS viirs_frp_sum,
        CASE
            WHEN COALESCE(v.viirs_frp_sum, 0.0) > 0 THEN v.viirs_frp_sum
            ELSE COALESCE(m.modis_frp_sum, 0.0)
        END AS frp_sum,
        COALESCE(m.modis_frp_p90, v.viirs_frp_p90, 0.0)::DOUBLE AS modis_frp_p90,
        COALESCE(v.viirs_frp_p90, m.modis_frp_p90, 0.0)::DOUBLE AS viirs_frp_p90,
        COALESCE(v.viirs_frp_p90, m.modis_frp_p90, 0.0)::DOUBLE AS frp_p90,
        COALESCE(m.modis_night_fire_ratio, v.viirs_night_fire_ratio, 0.0)::DOUBLE AS modis_night_fire_ratio,
        COALESCE(v.viirs_night_fire_ratio, m.modis_night_fire_ratio, 0.0)::DOUBLE AS viirs_night_fire_ratio,
        CASE
            WHEN (COALESCE(m.raw_modis, 0) + COALESCE(v.raw_viirs, 0)) > 0 THEN
                (COALESCE(m.modis_night_fire_ratio, 0.0) * COALESCE(m.raw_modis, 0)
                 + COALESCE(v.viirs_night_fire_ratio, 0.0) * COALESCE(v.raw_viirs, 0))
                / (COALESCE(m.raw_modis, 0) + COALESCE(v.raw_viirs, 0))
            ELSE 0.0
        END AS night_fire_ratio,
        COALESCE(m.modis_brightness_mean, v.viirs_brightness_mean, 310.0)::DOUBLE AS modis_brightness_mean,
        COALESCE(v.viirs_brightness_mean, m.modis_brightness_mean, 325.0)::DOUBLE AS viirs_brightness_mean,
        COALESCE(v.viirs_brightness_mean, m.modis_brightness_mean, 320.0)::DOUBLE AS brightness_mean,
        SIN(2.0 * PI() * COALESCE(m.month, v.month) / 12.0)::DOUBLE AS sin_month,
        COS(2.0 * PI() * COALESCE(m.month, v.month) / 12.0)::DOUBLE AS cos_month
    FROM modis m
    FULL OUTER JOIN viirs v
      ON m.country = v.country
     AND m.year = v.year
     AND m.month = v.month
     AND m.lat_bin = v.lat_bin
     AND m.lon_bin = v.lon_bin
    ORDER BY 1, 2, 3, 4, 5
    """
    paired_grid_df = con.execute(paired_sql).df()
    con.close()

    sensor_out = output_dir / "cleaned_sensor_grid.parquet"
    paired_out = output_dir / "cleaned_paired_grid.parquet"
    sensor_grid_df.to_parquet(sensor_out, index=False)
    paired_grid_df.to_parquet(paired_out, index=False)

    total_raw = sum(item["raw_rows"] for item in file_stats)
    total_clean = sum(item["clean_rows"] for item in file_stats)
    cleaning_stats = {
        "total_files_processed": len(file_stats),
        "total_raw_rows": total_raw,
        "total_cleaned_rows": total_clean,
        "retention_rate_pct": round(100.0 * total_clean / max(total_raw, 1), 2),
        "sensor_grid_cells": int(len(sensor_grid_df)),
        "paired_grid_cells": int(len(paired_grid_df)),
        "elapsed_seconds": round(time.time() - t0, 2),
        "files": file_stats,
    }
    with open(output_dir / "cleaning_audit.json", "w", encoding="utf-8") as fp:
        json.dump(cleaning_stats, fp, indent=2)

    return sensor_grid_df, paired_grid_df, cleaning_stats


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    raw_data_dir = project_root / "raw_data"
    if not raw_data_dir.exists():
        raw_data_dir = Path(r"C:\Users\Mohamed Gabr\Desktop\NASA")
    data_out_dir = project_root / "data"

    print(f"[clean_pipeline] Running cleaning & aggregation from: {raw_data_dir}")
    sensor_df, paired_df, stats = run_clean_pipeline(raw_data_dir, data_out_dir)
    print(
        f"[clean_pipeline] Done in {stats['elapsed_seconds']}s | "
        f"Raw rows: {stats['total_raw_rows']:,} -> Cleaned rows: {stats['total_cleaned_rows']:,} "
        f"({stats['retention_rate_pct']}%) | Paired grid cells: {stats['paired_grid_cells']:,}"
    )
