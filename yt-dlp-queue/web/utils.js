export const escapeHtml  = (value) => {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const percentValue = (job) => {
  const value = Number(job.percent);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

export const displayTitle = (job) => {
  return job.title || job.filename || job.url || "Untitled job";
}
