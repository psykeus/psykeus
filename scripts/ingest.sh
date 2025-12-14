#!/bin/bash
# Wrapper script for running the ingestion pipeline
# Usage: ./scripts/ingest.sh /path/to/designs [--dry-run]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "Error: Virtual environment not found at $VENV_DIR"
    echo "Run: python3 -m venv scripts/.venv && scripts/.venv/bin/pip install -r scripts/requirements.txt"
    exit 1
fi

source "$VENV_DIR/bin/activate"
python "$SCRIPT_DIR/ingest_designs.py" "$@"
