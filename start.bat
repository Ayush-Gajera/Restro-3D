@echo off
echo ========================================
echo Starting Restro3D Application
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11 or higher from python.org
    pause
    exit /b 1
)

echo [1/4] Checking virtual environment...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/4] Installing dependencies...
pip install -r requirements.txt

echo [4/4] Starting the application...
echo.
echo ========================================
echo Application will be available at:
echo http://localhost:8000
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
