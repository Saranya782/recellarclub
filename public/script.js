const input = document.getElementById("domain-input");
const searchBtn = document.getElementById("search-btn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");

let debounceTimer = null;

searchBtn.addEventListener("click", search);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") search();
});

async function search() {
  const name = input.value.trim();
  if (!name) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    showLoading(true);
    hideError();
    resultsEl.innerHTML = "";

    try {
      const res = await fetch(`/api/check-domain?name=${encodeURIComponent(name)}`);
      const text = await res.text();

      // Check if response is HTML (Cloudflare block, etc.)
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        const readable = extractTextFromHtml(text);
        showError(readable);
        return;
      }

      const data = JSON.parse(text);

      if (!res.ok) {
        const errMsg = typeof data.error === "string" && data.error.trim().startsWith("<")
          ? extractTextFromHtml(data.error)
          : data.error || "Something went wrong";
        showError(errMsg);
        return;
      }

      renderResults(data);
    } catch (err) {
      showError("Failed to connect to server");
    } finally {
      showLoading(false);
    }
  }, 500);
}

function renderResults(data) {
  resultsEl.innerHTML = "";

  // ResellerClub API returns: { "canva.com": { "status": "regthroughothers", ... }, ... }
  // OR sometimes: { "canva.com": "available", ... }
  const entries = Object.entries(data);
  if (entries.length === 0) {
    showError("No results returned");
    return;
  }

  for (const [domain, info] of entries) {
    // info can be an object with .status or a plain string
    const status = typeof info === "object" ? (info.status || "unknown") : String(info);
    const isAvailable = status === "available";
    const isTaken = status === "regthroughothers" || status === "regthroughus";
    const label = isAvailable ? "Available" : isTaken ? "Taken" : status.charAt(0).toUpperCase() + status.slice(1);
    const statusClass = isAvailable ? "available" : isTaken ? "taken" : "unknown";

    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <span class="domain-name">${escapeHtml(domain)}</span>
      <span class="status ${statusClass}">${label}</span>
    `;
    resultsEl.appendChild(item);
  }
}

function extractTextFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Try to find the main heading/message from Cloudflare block pages
  const h1 = doc.querySelector("h1");
  const h2 = doc.querySelector("h2");
  const parts = [];
  if (h1) parts.push(h1.textContent.trim());
  if (h2) parts.push(h2.textContent.trim());
  if (parts.length > 0) return parts.join(" — ");
  // Fallback: extract all visible text, cleaned up
  const bodyText = doc.body?.textContent?.trim() || "Unknown error from API";
  return bodyText.replace(/\s+/g, " ").substring(0, 200);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showLoading(show) {
  loadingEl.classList.toggle("hidden", !show);
  searchBtn.disabled = show;
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function hideError() {
  errorEl.classList.add("hidden");
}
