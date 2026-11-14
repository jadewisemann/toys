class QueueStats extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  set data(data) {
    this.activeCount.textContent = data.activeCount;
    this.historyCount.textContent = data.historyCount;
    this.workerCount.textContent = data.maxWorkers || this.workerCount.textContent;
  }

  render() {
    this.innerHTML = `
      <aside class="panel stats">
        <div class="stat"><span>Queued / Running</span><strong data-active-count>0</strong></div>
        <div class="stat"><span>History</span><strong data-history-count>0</strong></div>
        <div class="stat"><span>Parallel limit</span><strong data-worker-count>2</strong></div>
      </aside>
    `;
    this.activeCount = this.querySelector("[data-active-count]");
    this.historyCount = this.querySelector("[data-history-count]");
    this.workerCount = this.querySelector("[data-worker-count]");
  }
}

customElements.define("queue-stats", QueueStats);
