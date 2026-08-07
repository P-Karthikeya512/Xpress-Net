requireAuth();

const EMOTION_EMOJI = {
  Happy: "😊",
  Sad: "☹️",
  Angry: "😠",
  Surprise: "😮",
  Neutral: "😐",
  Fear: "😨",
  Disgust: "🤢",
};

document.addEventListener("DOMContentLoaded", loadHistory);

async function loadHistory() {
  const loadingState = document.getElementById("loading-state");
  const errorState = document.getElementById("error-state");
  const emptyState = document.getElementById("empty-state");
  const listEl = document.getElementById("history-list");

  try {
    const response = await apiFetch("/api/history");
    if (!response.ok) throw new Error("Request failed");

    const items = await response.json();

    loadingState.classList.add("hidden");

    if (!Array.isArray(items) || items.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    listEl.innerHTML = items.map(renderItem).join("");
    listEl.classList.remove("hidden");

    items.forEach(loadHistoryImage);
  } catch {
    loadingState.classList.add("hidden");
    errorState.classList.remove("hidden");
  }
}

function renderItem(item) {
  const emotion = item.predicted_emotion || "Neutral";
  const emoji = EMOTION_EMOJI[emotion] || "🙂";
  const confidenceValue = typeof item.confidence === "number" ? item.confidence : 0;
  const percentage = confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue;
  const dateLabel = formatDateTime(item.created_at);

  return `
    <article class="history-item">
      <div class="history-head">
        <div class="flex items-center gap-3">
          <span class="history-badge">${emoji} ${escapeHtml(emotion)}</span>
          <span class="history-confidence">${percentage.toFixed(1)}%</span>
        </div>
      </div>
      <img
        id="history-img-${item.id}"
        class="history-thumb mt-3 hidden"
        alt="${escapeHtml(emotion)} prediction"
      />
      <p class="history-emotion mt-4">${escapeHtml(emotion)}</p>
      <p class="history-meta">${escapeHtml(dateLabel)}</p>
    </article>
  `;
}

// <img src="..."> can't send an Authorization header, and this endpoint
// is JWT-protected — so we fetch it through apiFetch (token attached),
// then turn the response into a blob URL the <img> tag can point to.
async function loadHistoryImage(item) {
  const imgEl = document.getElementById(`history-img-${item.id}`);
  if (!imgEl) return;

  try {
    const response = await apiFetch(`/api/history/${item.id}/image`);
    if (!response.ok) return; // leave the thumb hidden if the image is missing

    const blob = await response.blob();
    imgEl.src = URL.createObjectURL(blob);
    imgEl.classList.remove("hidden");
    imgEl.addEventListener("load", () => URL.revokeObjectURL(imgEl.src), { once: true });
  } catch {
    // network/auth failure — silently leave the thumbnail hidden
  }
}

function formatDateTime(value) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
