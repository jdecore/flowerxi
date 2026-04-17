#!/usr/bin/env python3
"""Collect market rose prices from public pages and write a static JSON payload."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

DEFAULT_OUTPUT = Path("frontend/public/market_prices.json")
DEFAULT_SOURCES: list[dict[str, Any]] = [
    {
        "name": "Mercado de Flores Bogota",
        "url": "https://mercadodeflores.co/precios-rosa-corte",
        "selectors": {
            "table": "table",
            "rows": "tr",
            "variety": "td:nth-child(1)",
            "unit": "td:nth-child(2)",
            "price": "td:nth-child(3)",
        },
    },
    {
        "name": "Fedeflores",
        "url": "https://fedeflores.co",
        "selectors": {
            "table": "table",
            "rows": "tr",
            "variety": "td:nth-child(1)",
            "unit": "td:nth-child(2)",
            "price": "td:nth-child(3)",
        },
    },
]


def parse_price_to_cop(raw_price: str) -> float:
    cleaned = re.sub(r"[^0-9,.\-]", "", raw_price or "").strip()
    if not cleaned:
        return 0.0

    # Keep only digits as COP integer value in most portals.
    digits = re.sub(r"[^0-9]", "", cleaned)
    return float(digits) if digits else 0.0


def load_existing(output_file: Path) -> dict[str, Any]:
    if not output_file.exists():
        return {"data": []}

    try:
        return json.loads(output_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"data": []}


def extract_rows(source: dict[str, Any], html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    selectors = source.get("selectors", {})
    table_selector = selectors.get("table", "table")
    rows_selector = selectors.get("rows", "tr")
    table = soup.select_one(table_selector)
    if table is None:
        raise ValueError("Table not found with configured selector")

    now_iso = dt.datetime.now(tz=dt.timezone.utc).isoformat()
    items: list[dict[str, Any]] = []
    for row in table.select(rows_selector):
        if row.find("th"):
            continue

        variety_node = row.select_one(selectors.get("variety", "td:nth-child(1)"))
        unit_node = row.select_one(selectors.get("unit", "td:nth-child(2)"))
        price_node = row.select_one(selectors.get("price", "td:nth-child(3)"))
        if not variety_node or not price_node:
            continue

        variety = variety_node.get_text(strip=True)
        unit = unit_node.get_text(strip=True) if unit_node else "unidad"
        price_cop = parse_price_to_cop(price_node.get_text(strip=True))
        if not variety or price_cop <= 0:
            continue

        items.append(
            {
                "variety": variety,
                "unit": unit,
                "price_cop": price_cop,
                "source": source["name"],
                "scraped_at": now_iso,
            }
        )

    return items


def scrape_sources() -> dict[str, Any]:
    payload = {
        "scraped_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
        "generated_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
        "sources": [],
        "data": [],
        "stale": False,
    }

    for source in DEFAULT_SOURCES:
        source_status: dict[str, Any] = {"name": source["name"], "url": source["url"], "status": "error"}
        try:
            response = requests.get(
                source["url"],
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; FlowerxiBot/1.0; +https://github.com/jdecore/flowerxi)"
                },
                timeout=20,
            )
            response.raise_for_status()
            rows = extract_rows(source, response.text)
            source_status["status"] = "success"
            source_status["count"] = len(rows)
            payload["data"].extend(rows)
        except Exception as exc:  # explicit error surfaced to payload/logs
            source_status["error"] = str(exc)
        finally:
            payload["sources"].append(source_status)

    # Deduplicate records by variety + unit + source.
    unique: dict[tuple[str, str, str], dict[str, Any]] = {}
    for item in payload["data"]:
        key = (item["variety"], item["unit"], item["source"])
        unique[key] = item
    payload["data"] = sorted(unique.values(), key=lambda row: row["variety"].lower())

    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape rose market prices for Flowerxi")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output JSON file path")
    args = parser.parse_args()

    output_file = Path(args.output)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    existing_data = load_existing(output_file)
    payload = scrape_sources()

    if not payload["data"] and existing_data.get("data"):
        payload["data"] = existing_data["data"]
        payload["stale"] = True

    output_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Sources checked: {len(payload['sources'])}")
    print(f"Prices stored: {len(payload['data'])}")
    if payload["stale"]:
        print("No fresh prices found. Keeping previous dataset.")


if __name__ == "__main__":
    main()

