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
    this.list.replaceChildren();
    if (!jobs.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = this.emptyText;
      this.list.append(empty);
      return;
    }

    for (const job of jobs) {
      const card = document.createElement("job-card");
      if (this.hideDownload) {
        card.setAttribute("hide-download", "");
      }
      card.job = job;
      this.list.append(card);
    }
  }
}

customElements.define("job-section", JobSection);
