@echo off
setlocal

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo Python was not found. Please install Python 3.10 or newer from https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set "PYTHON=py -3"
) else (
    set "PYTHON=python"
)

if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" --version >nul 2>nul
    if errorlevel 1 (
        echo Existing virtual environment is broken. Recreating it...
        rmdir /s /q "venv"
    )
)

if not exist "venv\Scripts\python.exe" (
    echo Creating virtual environment...
    %PYTHON% -m venv venv
    if errorlevel 1 (
        echo Failed to create the virtual environment.
        pause
        exit /b 1
    )
)

call "venv\Scripts\activate.bat"
if errorlevel 1 (
    echo Failed to activate the virtual environment.
    pause
    exit /b 1
)

echo Installing dependencies...
python -m pip install --upgrade pip
if errorlevel 1 (
    echo Failed to upgrade pip.
    pause
    exit /b 1
)

pip install -r requirements.txt
if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)

echo Updating yt-dlp...
pip install -U yt-dlp
if errorlevel 1 (
    echo Failed to update yt-dlp.
    pause
    exit /b 1
)

if not exist "downloads" mkdir "downloads"

echo Starting yt-dlp Web UI at http://localhost:5000
start "" /B cmd /C "timeout /t 2 /nobreak >nul & start http://localhost:5000"
python app.py

pause
