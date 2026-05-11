# yt-dlp Queue

[한국어 버전 보기](#한국어)

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

## 한국어

`yt-dlp` 다운로드를 로컬 브라우저에서 큐로 관리하는 작은 Flask 웹 UI입니다.

### 주요 기능

- 하나 이상의 비디오 URL을 한 번에 큐에 추가합니다.
- 비디오는 MP4, 오디오는 MP3로 다운로드합니다.
- 설정한 병렬 작업 수만큼 백그라운드에서 다운로드를 실행합니다.
- 현재 큐와 기록을 기준으로 중복 URL 및 포맷 요청을 감지합니다.
- 최근 다운로드 기록과 작업 로그를 브라우저에서 확인합니다.
- 완료된 파일을 웹 UI에서 다운로드합니다.
- 시작 시 `downloads/` 폴더에 이미 있는 파일을 기록으로 가져옵니다.

### 요구 사항

- Windows
- Python 3.10 이상

Python 의존성은 `requirements.txt`에 있습니다.

- Flask
- yt-dlp
- imageio-ffmpeg

### 빠른 시작

다음을 실행하세요.

```bat
start.bat
```

이 스크립트는 로컬 가상환경을 만들거나 복구하고, 의존성을 설치하고, `yt-dlp`를 업데이트하고, 필요한 경우 `downloads/` 폴더를 만든 뒤 앱을 실행합니다.

```text
http://localhost:5000
```

### 수동 실행

```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 설정

`MAX_DOWNLOADS`로 동시에 실행할 다운로드 수를 조정할 수 있습니다. 기본값은 `2`입니다.

```bat
set MAX_DOWNLOADS=3
python app.py
```

`PORT`로 로컬 포트를 바꿀 수 있습니다. 기본값은 `5000`입니다.

```bat
set PORT=5050
python app.py
```

### 로컬 데이터

- 다운로드 파일은 `downloads/`에 저장됩니다.
- 다운로드 기록은 `history.sqlite3`에 저장됩니다.
- 두 항목 모두 git에서 제외됩니다.

### 문제 해결

브라우저에 앱 로드 또는 MIME 오류가 보이면 Flask 서버를 끄고 다시 시작한 뒤 `Ctrl+F5`로 강력 새로고침하세요.

가상환경이 삭제된 Python 설치 경로를 가리키면 `start.bat`를 실행하세요. 깨진 `venv`를 자동으로 다시 만듭니다.
