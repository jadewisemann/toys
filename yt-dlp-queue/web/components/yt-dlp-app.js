import "./duplicate-panel.js";
import "./job-section.js";
import "./queue-form.js";
import "./queue-stats.js";

class YtDlpApp extends HTMLElement {
  connectedCallback() {
    this.pendingPayload = null;
    this.render();
    this.refreshJobs();
    this.refreshTimer = window.setInterval(() => this.refreshJobs(), 1500);
  }

  disconnectedCallback() {
    window.clearInterval(this.refreshTimer);
  }

  render() {
    this.innerHTML = `
      <section class="top">
        <queue-form></queue-form>
        <queue-stats></queue-stats>
      </section>
      <duplicate-panel></duplicate-panel>
      <section class="grid">
        <job-section title="Current Queue" empty-text="No queued or running jobs." refreshable></job-section>
        <job-section title="History" empty-text="No completed jobs yet." hide-download></job-section>
      </section>
    `;

    this.form = this.querySelector("queue-form");
    this.stats = this.querySelector("queue-stats");
    this.duplicates = this.querySelector("duplicate-panel");
    this.activeSection = this.querySelector("job-section[refreshable]");
    this.historySection = this.querySelector("job-section[hide-download]");

    this.addEventListener("queue-submit", (event) => this.submitQueue(event.detail));
    this.addEventListener("force-download", () => this.submitPending());
    this.addEventListener("skip-duplicates", () => this.skipDuplicates());
    this.addEventListener("refresh-jobs", () => this.refreshJobs());
  }

  async refreshJobs() {
    const lastUpdated = document.getElementById("lastUpdated");

    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const active = data.active || [];
      const history = data.history || [];

      this.stats.data = {
        activeCount: active.length,
        historyCount: history.length,
        maxWorkers: data.max_workers
      };
      this.activeSection.jobs = active;
      this.historySection.jobs = history;

      if (lastUpdated) {
        lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
      }
    } catch (error) {
      if (lastUpdated) {
        lastUpdated.textContent = `Load failed: ${error.message}`;
      }
      return;
    }
  }

  async submitQueue(payload) {
    this.form.setLoading(true);
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.status === 409 && data.duplicates) {
        this.pendingPayload = payload;
        this.duplicates.showDuplicates(data.duplicates);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to queue download.");
      }

      this.duplicates.hide();
      this.pendingPayload = null;
      this.form.clear();
      await this.refreshJobs();
    } catch (error) {
      this.duplicates.showError(error.message);
    } finally {
      this.form.setLoading(false);
    }
  }

  async submitPending() {
    if (!this.pendingPayload) {
      return;
    }

    const payload = { ...this.pendingPayload, force: true };
    this.form.setPayload(payload);
    await this.submitQueue(payload);
  }

  skipDuplicates() {
    this.pendingPayload = null;
    this.duplicates.hide();
  }
}

customElements.define("yt-dlp-app", YtDlpApp);
