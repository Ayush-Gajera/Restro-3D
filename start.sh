#!/bin/bash

echo "========================================"
echo "Starting Restro3D Application"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.11 or higher"
    exit 1
fi

echo "[1/4] Checking virtual environment..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "[2/4] Activating virtual environment..."
source venv/bin/activate

echo "[3/4] Installing dependencies..."
pip install -r requirements.txt

echo "[4/4] Starting the application..."
echo ""
echo "========================================"
echo "Application will be available at:"
echo "http://localhost:8000"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
