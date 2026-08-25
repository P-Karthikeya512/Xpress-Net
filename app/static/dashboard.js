requireAuth();

let currentMode = "upload";
let selectedFile = null;
let capturedBlob = null;
let stream = null;

const EMOTION_EMOJI = {
  Happy: "😊",
  Sad: "☹️",
  Angry: "😠",
  Surprise: "😮",
  Neutral: "😐",
  Fear: "😨",
  Disgust: "🤢",
};

const EMOTION_ACCENTS = {
  Happy: "from-emerald-500 to-lime-500",
  Sad: "from-sky-500 to-blue-500",
  Angry: "from-rose-500 to-red-500",
  Surprise: "from-amber-400 to-orange-500",
  Neutral: "from-slate-400 to-slate-500",
  Fear: "from-violet-500 to-fuchsia-500",
  Disgust: "from-emerald-600 to-green-700",
};

const EMOTION_LABELS = {
  Happy: "Happy",
  Sad: "Sad",
  Angry: "Angry",
  Surprise: "Surprise",
  Neutral: "Neutral",
  Fear: "Fear",
  Disgust: "Disgust",
};

document.addEventListener("DOMContentLoaded", () => {
  const email = getEmail();
  if (email) {
    document.getElementById("user-greeting").textContent = `Welcome back, ${email}`;
  }

  const btnUpload = document.getElementById("btn-upload");
  const btnCamera = document.getElementById("btn-camera");
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const predictBtn = document.getElementById("predict-btn");
  const captureBtn = document.getElementById("btn-capture");
  const retakeBtn = document.getElementById("btn-retake");

  btnUpload.addEventListener("click", () => switchMode("upload"));
  btnCamera.addEventListener("click", () => switchMode("camera"));

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadPreview(file);
  });

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    const file = event.dataTransfer.files?.[0];
    if (file) loadPreview(file);
  });

  captureBtn.addEventListener("click", snapPhoto);
  retakeBtn.addEventListener("click", retakePhoto);
  predictBtn.addEventListener("click", predictEmotion);

  switchMode("upload");
});

function switchMode(mode) {
  currentMode = mode;
  hideError();

  document.getElementById("btn-upload").classList.toggle("active", mode === "upload");
  document.getElementById("btn-camera").classList.toggle("active", mode === "camera");
  document.getElementById("panel-upload").classList.toggle("hidden", mode !== "upload");
  document.getElementById("panel-camera").classList.toggle("hidden", mode !== "camera");

  if (mode === "camera") {
    startCamera();
  } else {
    stopCamera();
  }
}

function showError(message) {
  const errorBox = document.getElementById("error-box");
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  document.getElementById("error-box").classList.add("hidden");
}

function resetResult() {
  document.getElementById("result-empty").classList.remove("hidden");
  document.getElementById("result-card").classList.add("hidden");
}

function displayResult(data, roundTripMs) {
  const emotion = data.predicted_emotion || "Neutral";
  const confidenceValue = typeof data.confidence === "number" ? data.confidence : 0;
  const percentage = confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue;
  const emoji = EMOTION_EMOJI[emotion] || "🙂";
  const accent = EMOTION_ACCENTS[emotion] || "from-violet-500 to-fuchsia-500";
  const label = EMOTION_LABELS[emotion] || emotion;

  document.getElementById("result-emoji").textContent = emoji;
  document.getElementById("result-label").textContent = label;
  document.getElementById("result-confidence").textContent = `${percentage.toFixed(1)}%`;
  document.getElementById("confidence-bar").style.width = `${Math.max(0, Math.min(100, percentage))}%`;
  document.getElementById("confidence-bar").className = `h-full rounded-full bg-gradient-to-r ${accent}`;
  document.getElementById("result-time").textContent = `Predicted at ${formatDateTime(data.created_at)}`;

  const latencyParts = [];
  if (typeof data.inference_ms === "number") {
    latencyParts.push(`Model inference: ${data.inference_ms.toFixed(1)} ms`);
  }
  if (typeof roundTripMs === "number") {
    latencyParts.push(`Round trip: ${roundTripMs.toFixed(1)} ms`);
  }
  document.getElementById("result-latency").textContent = latencyParts.join(" · ");

  document.getElementById("result-empty").classList.add("hidden");
  document.getElementById("result-card").classList.remove("hidden");
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

function loadPreview(file) {
  const allowedTypes = new Set(["image/jpeg", "image/png"]);
  if (!allowedTypes.has(file.type)) {
    showError("Only JPG and PNG images are allowed.");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showError("File exceeds 10 MB.");
    return;
  }

  selectedFile = file;
  capturedBlob = null;
  hideError();

  const reader = new FileReader();
  reader.onload = (event) => {
    document.getElementById("preview-img").src = event.target.result;
    document.getElementById("preview-name").textContent = file.name;
    document.getElementById("upload-placeholder").classList.add("hidden");
    document.getElementById("preview-container").classList.remove("hidden");
  };
  reader.readAsDataURL(file);

  resetResult();
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById("camera-feed");
    video.srcObject = stream;
    video.classList.remove("hidden");
    document.getElementById("snap-preview").classList.add("hidden");
    document.getElementById("btn-retake").classList.add("hidden");
  } catch {
    showError("Camera access denied or unavailable.");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function snapPhoto() {
  const video = document.getElementById("camera-feed");
  const canvas = document.getElementById("snap-canvas");

  if (!video.videoWidth || !video.videoHeight) {
    showError("Camera is not ready yet.");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        showError("Could not capture image.");
        return;
      }

      capturedBlob = blob;
      selectedFile = null;
      hideError();

      const previewUrl = canvas.toDataURL("image/png");
      document.getElementById("snap-preview").src = previewUrl;
      document.getElementById("snap-preview").classList.remove("hidden");
      video.classList.add("hidden");
      document.getElementById("btn-retake").classList.remove("hidden");

      stopCamera();
      resetResult();
    },
    "image/png",
    0.95
  );
}

async function retakePhoto() {
  capturedBlob = null;
  document.getElementById("snap-preview").classList.add("hidden");
  document.getElementById("btn-retake").classList.add("hidden");
  document.getElementById("camera-feed").classList.remove("hidden");
  hideError();
  resetResult();
  await startCamera();
}

function getActiveImagePayload() {
  if (currentMode === "upload") {
    if (!selectedFile) return null;
    return { blob: selectedFile, filename: selectedFile.name || "upload.jpg" };
  }

  if (!capturedBlob) return null;
  return { blob: capturedBlob, filename: "capture.png" };
}

async function predictEmotion() {
  hideError();
  resetResult();

  const payload = getActiveImagePayload();
  if (!payload) {
    showError(currentMode === "upload" ? "Please upload an image first." : "Please capture a photo first.");
    return;
  }

  const btn = document.getElementById("predict-btn");
  const label = document.getElementById("predict-btn-label");
  btn.disabled = true;
  label.textContent = "Predicting…";

  try {
    const formData = new FormData();
    formData.append("file", payload.blob, payload.filename);

    const t0 = performance.now();
    const response = await apiFetch("/api/predict", {
      method: "POST",
      body: formData,
    });
    const roundTripMs = performance.now() - t0;

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail || "Prediction failed.");
    }

    const data = await response.json();
    displayResult(data, roundTripMs);
  } catch (err) {
    showError(err.message || "Something went wrong.");
  } finally {
    btn.disabled = false;
    label.textContent = "Predict emotion";
  }
}