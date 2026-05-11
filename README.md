# yt-dlp Queue

A small local Flask web UI for queueing YouTube downloads with `yt-dlp`.

## Features

- Queue one or more video URLs at once.
- Download video as MP4 or audio as MP3.
- Run downloads in the background with a configurable parallel worker limit.
- Detect duplicate URL and format requests from the active queue or history.
- Review recent download history and job logs in the browser.
- Download completed files from the web UI.
- Import existing files from the `downloads/` folder into history on startup.

## Requirements

- Windows
- Python 3.10 or newer

Python dependencies are listed in `requirements.txt`:

- Flask
- yt-dlp
- imageio-ffmpeg

## Quick Start

Run:

```bat
start.bat
```

The script creates or repairs the local virtual environment, installs dependencies, updates `yt-dlp`, creates `downloads/` if needed, and starts the app at:

```text
http://localhost:5000
```

## Manual Run

```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Configuration

Set `MAX_DOWNLOADS` to control how many downloads run in parallel. The default is `2`.

```bat
set MAX_DOWNLOADS=3
python app.py
```

Set `PORT` to use a different local port. The default is `5000`.

```bat
set PORT=5050
python app.py
```

## Local Data

- Downloaded files are saved in `downloads/`.
- Download history is stored in `history.sqlite3`.
- Both are ignored by git.

## Troubleshooting

If the browser shows an app load or MIME error, stop the Flask server, start it again, and hard refresh the browser with `Ctrl+F5`.

If the virtual environment points to a missing Python install, run `start.bat`; it recreates a broken `venv` automatically.
