class QueueForm extends HTMLElement {
  connectedCallback() {
    this.render();
    this.form = this.querySelector("form");
    this.urlsInput = this.querySelector("[name='urls']");
    this.formatInput = this.querySelector("[name='format']");
    this.queueButton = this.querySelector("button[type='submit']");

    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.dispatchEvent(new CustomEvent("queue-submit", {
        bubbles: true,
        detail: this.payload()
      }));
    });
  }

  payload(force = false) {
    return {
      urls: this.urlsInput.value,
      format: this.formatInput.value,
      force
    };
  }

  setPayload(payload) {
    this.urlsInput.value = payload.urls || "";
    this.formatInput.value = payload.format || "video";
  }

  clear() {
    this.urlsInput.value = "";
  }

  setLoading(isLoading) {
    this.queueButton.disabled = isLoading;
  }

  render() {
    this.innerHTML = `
      <div class="panel">
        <form>
          <label>
            Video URLs
            <textarea name="urls" placeholder="https://www.youtube.com/watch?v=...&#10;https://youtu.be/..." required></textarea>
          </label>
          <div class="controls">
            <label>
              Format
              <select name="format">
                <option value="video">Best Video + Audio</option>
                <option value="audio">Audio Only (MP3)</option>
              </select>
            </label>
            <button type="submit">Add to Queue</button>
          </div>
        </form>
      </div>
    `;
  }
}

customElements.define("queue-form", QueueForm);
