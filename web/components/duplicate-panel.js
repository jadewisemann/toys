import "./job-card.js";
import { escapeHtml } from "../utils.js";

class DuplicatePanel extends HTMLElement {
  connectedCallback() {
    this.renderShell();
  }

  showDuplicates(duplicates) {
    this.visible = true;
    this.list.replaceChildren();
    for (const item of duplicates) {
      this.list.append(this.duplicateCard(item));
    }
  }

  showError(message) {
    this.visible = true;
    this.list.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
  }

  hide() {
    this.visible = false;
    this.list.replaceChildren();
  }

  set visible(isVisible) {
    this.classList.toggle("visible", isVisible);
  }

  renderShell() {
    this.className = "duplicate";
    this.innerHTML = `
      <div>
        <h2>Duplicate work found</h2>
        <p>One or more URLs already exist in the queue or history. Compare the previous work before starting again.</p>
      </div>
      <div class="list" data-list></div>
      <div class="duplicate-actions">
        <button type="button" data-force>Download Again</button>
        <button class="secondary" type="button" data-skip>Skip</button>
      </div>
    `;
    this.list = this.querySelector("[data-list]");
    this.querySelector("[data-force]").addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("force-download", { bubbles: true }));
    });
    this.querySelector("[data-skip]").addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("skip-duplicates", { bubbles: true }));
    });
  }

  duplicateCard(item) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <h3>${escapeHtml(item.url)}</h3>
      <p class="muted">Format: ${escapeHtml(item.format)}</p>
    `;

    const list = document.createElement("div");
    list.className = "list";
    for (const job of item.matches || []) {
      const card = document.createElement("job-card");
      card.setAttribute("hide-download", "");
      card.job = job;
      list.append(card);
    }
    wrapper.append(list);
    return wrapper;
  }
}

customElements.define("duplicate-panel", DuplicatePanel);
