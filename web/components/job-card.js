import { displayTitle, escapeHtml, percentValue } from "../utils.js";

class JobCard extends HTMLElement {
  set job(job) {
    this._job = job;
    this.render();
  }

  get showDownload() {
    return !this.hasAttribute("hide-download");
  }

  render() {
    const job = this._job || {};
    const wasOpen = Boolean(this.querySelector("details")?.open);
    const status = escapeHtml(job.status || "unknown");
    const percent = percentValue(job);
    const logs = Array.isArray(job.logs) ? job.logs : [];
    const logText = logs.length ? logs.map(escapeHtml).join("\n") : "No logs yet.";
    const download = this.showDownload && job.download_url
      ? `<a href="${escapeHtml(job.download_url)}">Download</a>`
      : "";
    const error = job.error ? `<p class="muted">${escapeHtml(job.error)}</p>` : "";

    this.className = "job";
    this.innerHTML = `
      <div class="job-head">
        <div class="job-title">
          <strong>${escapeHtml(displayTitle(job))}</strong>
          <span class="muted url">${escapeHtml(job.url || job.filename || "")}</span>
        </div>
        <span class="badge ${status}">${status}</span>
      </div>
      <div class="bar" aria-label="Progress">
        <div class="bar-fill" style="width: ${percent}%"></div>
      </div>
      ${error}
      ${download ? `<div class="job-actions">${download}</div>` : ""}
      <details>
        <summary>Logs</summary>
        <pre>${logText}</pre>
      </details>
    `;

    const details = this.querySelector("details");
    if (details) {
      details.open = wasOpen;
    }
  }
}

customElements.define("job-card", JobCard);
