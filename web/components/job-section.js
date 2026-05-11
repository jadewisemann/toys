import "./job-card.js";
import { escapeHtml } from "../utils.js";

class JobSection extends HTMLElement {
  connectedCallback() {
    this.title = this.getAttribute("title") || "";
    this.emptyText = this.getAttribute("empty-text") || "No jobs.";
    this.hideDownload = this.hasAttribute("hide-download");
    this.refreshable = this.hasAttribute("refreshable");
    this.renderShell();
  }

  set jobs(jobs) {
    this.renderJobs(jobs || []);
  }

  renderShell() {
    const meta = this.refreshable
      ? `<button class="secondary" type="button" data-refresh>Refresh</button>`
      : `<span class="muted">Recent 100</span>`;

    this.innerHTML = `
      <div class="panel">
        <div class="section-title">
          <h2>${escapeHtml(this.title)}</h2>
          ${meta}
        </div>
        <div class="list" data-list></div>
      </div>
    `;
    this.list = this.querySelector("[data-list]");
    this.querySelector("[data-refresh]")?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("refresh-jobs", { bubbles: true }));
    });
  }

  renderJobs(jobs) {
    const signature = JSON.stringify(jobs);
    if (signature === this.lastJobsSignature) {
      return;
    }
    this.lastJobsSignature = signature;

    const existingCards = new Map();
    for (const card of this.list.querySelectorAll("job-card[data-job-key]")) {
      existingCards.set(card.dataset.jobKey, card);
    }

    const fragment = document.createDocumentFragment();
    if (!jobs.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = this.emptyText;
      fragment.append(empty);
      this.list.replaceChildren(fragment);
      return;
    }

    for (const job of jobs) {
      const jobKey = job.job_id || `${job.url || ""}:${job.format || ""}:${job.filename || ""}`;
      const card = existingCards.get(jobKey) || document.createElement("job-card");
      card.dataset.jobKey = jobKey;
      if (this.hideDownload) {
        card.setAttribute("hide-download", "");
      } else {
        card.removeAttribute("hide-download");
      }
      card.job = job;
      fragment.append(card);
    }

    this.list.replaceChildren(fragment);
  }
}

customElements.define("job-section", JobSection);
