import json
import os
import queue
import threading
import unicodedata
import uuid
from pathlib import Path

from flask import Flask, Response, jsonify, render_template, request, stream_with_context
from yt_dlp import YoutubeDL

try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None


BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)

jobs = {}
jobs_lock = threading.Lock()


def publish(job_id, event):
    with jobs_lock:
        job = jobs.get(job_id)
    if job:
        job["queue"].put(event)


def clean_message(message):
    if not message:
        return ""
    text = str(message).replace("\r", " ").replace("\n", " ").strip()
    return unicodedata.normalize("NFC", text)


def unique_path(path):
    if not path.exists():
        return path

    for index in range(2, 1000):
        candidate = path.with_name(f"{path.stem} ({index}){path.suffix}")
        if not candidate.exists():
            return candidate

    raise FileExistsError(f"Could not find a unique filename for {path.name}")


def normalize_filename(path):
    path = Path(path)
    normalized_name = unicodedata.normalize("NFC", path.name)
    if path.name == normalized_name:
        return path

    target = unique_path(path.with_name(normalized_name))
    path.rename(target)
    return target


def normalize_downloaded_files(info, fallback_filename):
    candidates = []

    if fallback_filename:
        candidates.append(Path(fallback_filename))

    for key in ("filepath", "_filename"):
        value = info.get(key)
        if value:
            candidates.append(Path(value))

    for download in info.get("requested_downloads") or []:
        value = download.get("filepath") or download.get("_filename")
        if value:
            candidates.append(Path(value))

    video_id = info.get("id")
    if video_id:
        marker = f"[{video_id}]"
        candidates.extend(path for path in DOWNLOAD_DIR.iterdir() if path.is_file() and marker in path.name)

    normalized = []
    seen = set()
    for path in candidates:
        if not path.exists() or path in seen:
            continue
        seen.add(path)
        normalized.append(normalize_filename(path))

    if normalized:
        return max(normalized, key=lambda path: path.stat().st_mtime)
    return Path(fallback_filename) if fallback_filename else None


class QueueLogger:
    def __init__(self, job_id):
        self.job_id = job_id

    def debug(self, message):
        text = clean_message(message)
        if text and not text.startswith("[debug]"):
            publish(self.job_id, {"status": "info", "message": text})

    def warning(self, message):
        publish(self.job_id, {"status": "warning", "message": clean_message(message)})

    def error(self, message):
        publish(self.job_id, {"status": "error", "message": clean_message(message)})


def progress_hook(job_id):
    def hook(data):
        status = data.get("status")

        if status == "downloading":
            total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            downloaded = data.get("downloaded_bytes") or 0
            percent = round((downloaded / total) * 100, 1) if total else None

            publish(
                job_id,
                {
                    "status": "downloading",
                    "percent": percent,
                    "speed": clean_message(data.get("_speed_str")),
                    "eta": clean_message(data.get("_eta_str")),
                    "message": clean_message(data.get("_percent_str")) or "Downloading",
                },
            )
        elif status == "finished":
            filename = data.get("filename")
            publish(
                job_id,
                {
                    "status": "processing",
                    "percent": 100,
                    "filename": Path(filename).name if filename else "",
                    "message": "Download finished. Processing file...",
                },
            )

    return hook


def ydl_options(job_id, requested_format):
    output_template = str(DOWNLOAD_DIR / "%(title).200B [%(id)s].%(ext)s")

    common = {
        "outtmpl": output_template,
        "logger": QueueLogger(job_id),
        "progress_hooks": [progress_hook(job_id)],
        "noplaylist": True,
        "windowsfilenames": True,
        "restrictfilenames": False,
    }

    if imageio_ffmpeg:
        common["ffmpeg_location"] = imageio_ffmpeg.get_ffmpeg_exe()

    if requested_format == "audio":
        return {
            **common,
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
        }

    return {
        **common,
        "format": (
            "bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a][acodec^=mp4a]/"
            "bv*[ext=mp4]+ba[ext=m4a]/"
            "b[ext=mp4]/best[ext=mp4]/best"
        ),
        "merge_output_format": "mp4",
    }


def run_download(job_id, url, requested_format):
    try:
        publish(job_id, {"status": "starting", "percent": 0, "message": "Starting download..."})

        with YoutubeDL(ydl_options(job_id, requested_format)) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            final_path = normalize_downloaded_files(info, filename)

        publish(
            job_id,
            {
                "status": "complete",
                "percent": 100,
                "message": "Download complete.",
                "title": clean_message(info.get("title", "")),
                "filename": final_path.name if final_path else "",
            },
        )
    except Exception as exc:
        publish(job_id, {"status": "error", "message": clean_message(exc)})
    finally:
        publish(job_id, {"status": "end"})


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/download")
def start_download():
    payload = request.get_json(silent=True) or {}
    url = clean_message(payload.get("url"))
    requested_format = payload.get("format", "video")

    if not url:
        return jsonify({"error": "A video URL is required."}), 400

    if requested_format not in {"video", "audio"}:
        return jsonify({"error": "Format must be 'video' or 'audio'."}), 400

    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {"queue": queue.Queue(), "created_by": request.remote_addr}

    thread = threading.Thread(target=run_download, args=(job_id, url, requested_format), daemon=True)
    thread.start()

    return jsonify({"job_id": job_id})


@app.get("/api/progress/<job_id>")
def progress(job_id):
    with jobs_lock:
        job = jobs.get(job_id)

    if not job:
        return jsonify({"error": "Unknown download job."}), 404

    def event_stream():
        try:
            while True:
                event = job["queue"].get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("status") == "end":
                    break
        finally:
            with jobs_lock:
                jobs.pop(job_id, None)

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, threaded=True)
