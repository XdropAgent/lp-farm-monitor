#!/usr/bin/env python3
"""LP Farm Monitor - Live Server with Multi-Strategy Comparison
Serves dashboard + real-time API from multiple strategy state files.
"""

import json
import os
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Strategy state files
STRATEGIES = {
    "meridian": {
        "name": "Meridian (AI Agent)",
        "state_file": Path("/root/meridian/state.json"),
        "description": "AI-powered autonomous DLMM LP (LLM screening + management)",
        "capital_sol": 2.0,
    },
    "custom": {
        "name": "Custom Simulator",
        "state_file": Path("/root/.hermes/data/dlmm_sim_state.json"),
        "description": "Rule-based DLMM simulator (fee/TVL ratio + curve strategy)",
        "capital_sol": 2.0,
    },
}

STATIC_DIR = Path("/root/lp-farm-monitor")
PORT = 8089


def parse_meridian_state(data):
    """Parse Meridian's state.json format into unified format."""
    positions = []
    for pos in data.get("positions", []):
        # Meridian stores positions differently
        entry_time = pos.get("deployedAt", pos.get("entryTime", 0))
        if isinstance(entry_time, str):
            try:
                from datetime import datetime
                entry_time = datetime.fromisoformat(entry_time.replace("Z", "+00:00")).timestamp()
            except:
                entry_time = 0

        hours_held = (time.time() - entry_time) / 3600 if entry_time > 0 else 0

        positions.append({
            "pool_name": pos.get("poolName", pos.get("pool_name", "Unknown")),
            "pool_address": pos.get("poolAddress", pos.get("pool_address", "")),
            "bin_step": pos.get("binStep", pos.get("bin_step", 0)),
            "capital_usd": pos.get("capitalUsd", pos.get("capital_usd", 0)),
            "capital_sol": pos.get("amountSol", pos.get("capital_sol", 0)),
            "entry_price": pos.get("entryPrice", pos.get("entry_price", 0)),
            "last_price": pos.get("currentPrice", pos.get("last_price", 0)),
            "current_pnl_pct": pos.get("pnlPct", pos.get("current_pnl_pct", 0)),
            "current_pnl_usd": pos.get("pnlUsd", pos.get("current_pnl_usd", 0)),
            "current_apy": pos.get("apy", pos.get("current_apy", 0)),
            "current_il_pct": pos.get("ilPct", pos.get("current_il_pct", 0)),
            "accumulated_fee": pos.get("feesEarned", pos.get("accumulated_fee", 0)),
            "hours_held": hours_held,
            "status": pos.get("status", "open"),
            "entry_time": entry_time,
            "note": pos.get("note", ""),
        })

    closed = []
    for pos in data.get("closedPositions", data.get("closed_positions", [])):
        closed.append({
            "pool_name": pos.get("poolName", pos.get("pool_name", "Unknown")),
            "capital_usd": pos.get("capitalUsd", pos.get("capital_usd", 0)),
            "final_pnl_pct": pos.get("pnlPct", pos.get("final_pnl_pct", 0)),
            "final_pnl_usd": pos.get("pnlUsd", pos.get("final_pnl_usd", 0)),
            "fees_earned": pos.get("feesEarned", pos.get("fees_earned", 0)),
            "hours_held": pos.get("hoursHeld", pos.get("hours_held", 0)),
            "close_reason": pos.get("closeReason", pos.get("close_reason", "")),
        })

    return positions, closed


def parse_custom_state(data):
    """Parse custom simulator state.json format."""
    positions = data.get("positions", [])
    closed = data.get("closed_positions", [])
    return positions, closed


def build_strategy_response(strategy_key, strategy_info):
    """Build API response for a single strategy."""
    state_file = strategy_info["state_file"]

    if not state_file.exists():
        return {
            "strategy": strategy_key,
            "name": strategy_info["name"],
            "description": strategy_info["description"],
            "capital_sol": strategy_info["capital_sol"],
            "status": "no_data",
            "positions": [],
            "closed_positions": [],
            "summary": {
                "total_capital_usd": 0,
                "total_pnl_usd": 0,
                "total_fees_usd": 0,
                "total_pnl_pct": 0,
                "active_positions": 0,
                "closed_positions": 0,
            },
        }

    try:
        data = json.loads(state_file.read_text())
    except (json.JSONDecodeError, IOError):
        return {
            "strategy": strategy_key,
            "name": strategy_info["name"],
            "status": "error",
            "error": "Failed to read state file",
        }

    if strategy_key == "meridian":
        positions, closed = parse_meridian_state(data)
    else:
        positions, closed = parse_custom_state(data)

    # Calculate totals
    total_capital = sum(p.get("capital_usd", 0) for p in positions)
    total_pnl = sum(p.get("current_pnl_usd", 0) for p in positions)
    total_fees = sum(p.get("accumulated_fee", 0) for p in positions)
    closed_pnl = sum(p.get("final_pnl_usd", p.get("current_pnl_usd", 0)) for p in closed)
    closed_fees = sum(p.get("fees_earned", p.get("accumulated_fee", 0)) for p in closed)

    return {
        "strategy": strategy_key,
        "name": strategy_info["name"],
        "description": strategy_info["description"],
        "capital_sol": strategy_info["capital_sol"],
        "status": "active",
        "positions": positions,
        "closed_positions": closed,
        "summary": {
            "total_capital_usd": round(total_capital, 2),
            "total_pnl_usd": round(total_pnl + closed_pnl, 4),
            "total_fees_usd": round(total_fees + closed_fees, 4),
            "total_pnl_pct": round(
                ((total_pnl + closed_pnl) / total_capital * 100) if total_capital > 0 else 0, 4
            ),
            "active_positions": len(positions),
            "closed_positions": len(closed),
        },
        "last_update": os.path.getmtime(str(state_file)),
    }


class FarmHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/strategies"):
            self.serve_all_strategies()
        elif self.path.startswith("/api/strategy/"):
            key = self.path.split("/api/strategy/")[1].split("?")[0]
            self.serve_strategy(key)
        elif self.path.startswith("/api/positions"):
            # Legacy endpoint — returns custom strategy
            self.serve_strategy("custom")
        else:
            super().do_GET()

    def serve_all_strategies(self):
        response = {
            "strategies": {},
            "server_time": time.time(),
        }
        for key, info in STRATEGIES.items():
            response["strategies"][key] = build_strategy_response(key, info)
        self.send_json(response)

    def serve_strategy(self, key):
        if key not in STRATEGIES:
            self.send_json({"error": f"Unknown strategy: {key}"}, 404)
            return
        response = build_strategy_response(key, STRATEGIES[key])
        response["server_time"] = time.time()
        self.send_json(response)

    def send_json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), FarmHandler)
    print(f"LP Farm Monitor live on http://localhost:{PORT}")
    print(f"API: http://localhost:{PORT}/api/strategies")
    print(f"Strategies: {list(STRATEGIES.keys())}")
    server.serve_forever()
