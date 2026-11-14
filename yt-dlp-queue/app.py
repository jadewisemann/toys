import json
import mimetypes
import os
import queue
import re
import sqlite3
import threading
import unicodedata
import uuid
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request, send_file, send_from_directory
from yt_dlp import YoutubeDL

try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None


BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)
DB_PATH = BASE_DIR / "history.sqlite3"
MAX_WORKERS = int(os.environ.get("MAX_DOWNLOADS", "2"))
VIDEO_ID_PATTERN = re.compile(r"\[([A-Za-z0-9_-]{6,})\]")

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")

app = Flask(__name__, template_folder="web", static_folder="web", static_url_path="/static")

jobs = {}
jobs_lock = threading.Lock()
download_queue = queue.Queue()
workers_started = False
workers_lock = threading.Lock()
JOB_STATES = {"queued", "starting", "running", "downloading", "processing", "complete", "error", "end"}


@app.after_request
def fix_static_mime_types(response):
    if request.path.endswith((".js", ".mjs")):
        response.headers["Content-Type"] = "application/javascript; charset=utf-8"
    elif request.path.endswith(".css"):
        response.headers["Content-Type"] = "text/css; charset=utf-8"
    return response


def publish(job_id, event):
    with jobs_lock:
        job = jobs.get(job_id)
        if job:
            if event.get("status") in JOB_STATES:
                job["status"] = event["status"]
            if "percent" in event:
                job["percent"] = event["percent"]
            if "message" in event and event["message"]:
                job["logs"].append(event["message"])
            if "title" in event:
                job["title"] = event["title"]
            if "filename" in event:
                job["filename"] = event["filename"]
    if job:
        job["events"].put(event)


def now_iso():
    from datetime import datetime

    return datetime.now().replace(microsecond=0).isoformat()


def db_connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with db_connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS history (
                job_id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                format TEXT NOT NULL,
                status TEXT NOT NULL,
                title TEXT,
                filename TEXT,
                file_path TEXT,
                error TEXT,
                logs TEXT NOT NULL,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_url_format ON history(url, format)"
        )
    import_existing_downloads()


def import_existing_downloads():
    files = [path for path in DOWNLOAD_DIR.iterdir() if path.is_file() and path.name != ".gitkeep"]
    if not files:
        return

    with db_connect() as connection:
        for path in files:
            existing = connection.execute(
                "SELECT job_id FROM history WHERE file_path = ?", (str(path),)
            ).fetchone()
            if existing:
                continue

            match = VIDEO_ID_PATTERN.search(path.stem)
            video_id = match.group(1) if match else path.stem
            title = path.stem[: match.start()].strip() if match else path.stem
            requested_format = "audio" if path.suffix.lower() == ".mp3" else "video"
            job_id = uuid.uuid5(uuid.NAMESPACE_URL, str(path)).hex
            timestamp = now_iso()
            url = f"https://www.youtube.com/watch?v={video_id}" if match else ""

            connection.execute(
                """
                INSERT OR IGNORE INTO history (
                    job_id, url, format, status, title, filename, file_path, error,
                    logs, created_at, started_at, finished_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    url,
                    requested_format,
                    "complete",
                    clean_message(title),
                    path.name,
                    str(path),
                    "",
                    json.dumps(["Imported existing file."], ensure_ascii=False),
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )


def row_to_job(row):
    return {
        "job_id": row["job_id"],
        "url": row["url"],
        "format": row["format"],
        "status": row["status"],
        "title": row["title"] or "",
        "filename": row["filename"] or "",
        "error": row["error"] or "",
        "logs": json.loads(row["logs"] or "[]"),
        "created_at": row["created_at"],
        "started_at": row["started_at"] or "",
        "finished_at": row["finished_at"],
    }


def save_history(job):
    with db_connect() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO history (
                job_id, url, format, status, title, filename, file_path, error,
                logs, created_at, started_at, finished_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job["job_id"],
                job["url"],
                job["format"],
                job["status"],
                job.get("title", ""),
                job.get("filename", ""),
                job.get("file_path", ""),
                job.get("error", ""),
                json.dumps(job.get("logs", []), ensure_ascii=False),
                job["created_at"],
                job.get("started_at", ""),
                job.get("finished_at", now_iso()),
            ),
        )


def recent_history(limit=100):
    with db_connect() as connection:
        rows = connection.execute(
            "SELECT * FROM history ORDER BY finished_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [row_to_job(row) for row in rows]


def history_matches(url, requested_format):
    with db_connect() as connection:
        rows = connection.execute(
            """
            SELECT * FROM history
            WHERE url = ? AND format = ?
            ORDER BY finished_at DESC
            """,
            (url, requested_format),
        ).fetchall()
    return [row_to_job(row) for row in rows]


def find_duplicates(items):
    duplicates = []
    with jobs_lock:
        active = [job for job in jobs.values() if job["status"] not in {"complete", "error", "end"}]

    for item in items:
        matches = []
        for job in active:
            if job["url"] == item["url"] and job["format"] == item["format"]:
                matches.append(job_snapshot(job))
        matches.extend(history_matches(item["url"], item["format"]))
        if matches:
            duplicates.append({"url": item["url"], "format": item["format"], "matches": matches})

    return duplicates


def job_snapshot(job):
    return {
        "job_id": job["job_id"],
        "url": job["url"],
        "format": job["format"],
        "status": job["status"],
        "percent": job.get("percent", 0),
        "title": job.get("title", ""),
        "filename": job.get("filename", ""),
        "error": job.get("error", ""),
        "logs": job.get("logs", [])[-80:],
        "created_at": job["created_at"],
        "started_at": job.get("started_at", ""),
        "finished_at": job.get("finished_at", ""),
        "download_url": f"/api/files/{job['job_id']}" if job.get("file_path") else "",
    }


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


def run_download(job):
    job_id = job["job_id"]
    url = job["url"]
    requested_format = job["format"]
    try:
        with jobs_lock:
            job["status"] = "running"
            job["started_at"] = now_iso()

        publish(job_id, {"status": "starting", "percent": 0, "message": "Starting download..."})

        with YoutubeDL(ydl_options(job_id, requested_format)) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            final_path = normalize_downloaded_files(info, filename)

        with jobs_lock:
            job["title"] = clean_message(info.get("title", ""))
            job["filename"] = final_path.name if final_path else ""
            job["file_path"] = str(final_path) if final_path else ""
            job["finished_at"] = now_iso()

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
        error = clean_message(exc)
        with jobs_lock:
            job["error"] = error
            job["finished_at"] = now_iso()
        publish(job_id, {"status": "error", "message": error})
    finally:
        with jobs_lock:
            job["finished_at"] = job.get("finished_at") or now_iso()
            saveable = dict(job)
        save_history(saveable)
        publish(job_id, {"status": "end"})
        with jobs_lock:
            jobs.pop(job_id, None)


def worker_loop():
    while True:
        job_id = download_queue.get()
        try:
            with jobs_lock:
                job = jobs.get(job_id)
            if job:
                run_download(job)
        finally:
            download_queue.task_done()


def ensure_workers():
    global workers_started
    with workers_lock:
        if workers_started:
            return
        for index in range(MAX_WORKERS):
            thread = threading.Thread(target=worker_loop, name=f"download-worker-{index + 1}", daemon=True)
            thread.start()
        workers_started = True


def parse_urls(payload):
    values = []
    if payload.get("urls"):
        if isinstance(payload["urls"], list):
            values = payload["urls"]
        else:
            values = str(payload["urls"]).splitlines()
    elif payload.get("url"):
        values = str(payload["url"]).splitlines()

    urls = []
    seen = set()
    for value in values:
        url = clean_message(value)
        if url and url not in seen:
            urls.append(url)
            seen.add(url)
    return urls


def create_job(url, requested_format):
    job_id = uuid.uuid4().hex
    job = {
        "job_id": job_id,
        "url": url,
        "format": requested_format,
        "status": "queued",
        "percent": 0,
        "title": "",
        "filename": "",
        "file_path": "",
        "error": "",
        "logs": ["Queued."],
        "events": queue.Queue(),
        "created_at": now_iso(),
        "started_at": "",
        "finished_at": "",
        "created_by": request.remote_addr,
    }
    with jobs_lock:
        jobs[job_id] = job
    download_queue.put(job_id)
    return job_snapshot(job)


@app.route("/")
def index():
    response = app.make_response(render_template("index.html"))
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/components/<path:filename>")
def component_file(filename):
    return send_from_directory(
        BASE_DIR / "web" / "components",
        filename,
        mimetype="application/javascript" if filename.endswith(".js") else None,
    )


@app.get("/styles.css")
def stylesheet_file():
    return send_from_directory(BASE_DIR / "web", "styles.css", mimetype="text/css")


@app.get("/utils.js")
def utils_file():
    return send_from_directory(BASE_DIR / "web", "utils.js", mimetype="application/javascript")


@app.post("/api/download")
def start_download():
    payload = request.get_json(silent=True) or {}
    urls = parse_urls(payload)
    requested_format = payload.get("format", "video")
    force = bool(payload.get("force"))

    if not urls:
        return jsonify({"error": "At least one video URL is required."}), 400

    if requested_format not in {"video", "audio"}:
        return jsonify({"error": "Format must be 'video' or 'audio'."}), 400

    items = [{"url": url, "format": requested_format} for url in urls]
    duplicates = find_duplicates(items)
    if duplicates and not force:
        return jsonify({"duplicates": duplicates}), 409

    ensure_workers()
    created = [create_job(url, requested_format) for url in urls]
    return jsonify({"jobs": created, "max_workers": MAX_WORKERS})


@app.get("/api/jobs")
def list_jobs():
    with jobs_lock:
        active = [job_snapshot(job) for job in jobs.values() if job["status"] in {"queued", "running", "starting", "downloading", "processing"}]
    return jsonify({"active": active, "history": recent_history(), "max_workers": MAX_WORKERS})


@app.get("/api/jobs/<job_id>")
def get_job(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if job:
        return jsonify(job_snapshot(job))

    with db_connect() as connection:
        row = connection.execute("SELECT * FROM history WHERE job_id = ?", (job_id,)).fetchone()
    if not row:
        return jsonify({"error": "Unknown download job."}), 404
    return jsonify(row_to_job(row))


@app.get("/api/files/<job_id>")
def download_file(job_id):
    file_path = ""
    download_name = ""

    with jobs_lock:
        job = jobs.get(job_id)
        if job:
            file_path = job.get("file_path", "")
            download_name = job.get("filename", "")

    if not file_path:
        with db_connect() as connection:
            row = connection.execute("SELECT file_path, filename FROM history WHERE job_id = ?", (job_id,)).fetchone()
        if row:
            file_path = row["file_path"] or ""
            download_name = row["filename"] or ""

    path = Path(file_path)
    if not file_path or not path.exists() or not path.is_file():
        abort(404)

    return send_file(path, as_attachment=True, download_name=download_name or path.name)


init_db()


if __name__ == "__main__":
    ensure_workers()
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, threaded=True)
