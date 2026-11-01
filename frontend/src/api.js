const API = "/api";

export function getToken() {
  return localStorage.getItem("token") || "";
}

function resetSeenAlerts() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith("seenNotes")).forEach((k) => sessionStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

export function setSession(token, user) {
  resetSeenAlerts(); // a fresh login shows its (max 3) alerts again
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  resetSeenAlerts();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

// ---- Global button loading indicator -------------------------------------
// A request that starts right after a button click shows a spinner on that
// button (and blocks double clicks) until the request finishes.
let lastClick = { btn: null, t: 0 };
const busyCount = new Map();

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target instanceof Element ? e.target.closest("button") : null;
      lastClick = { btn: btn && !btn.disabled ? btn : null, t: Date.now() };
    },
    true
  );
}

function trackRequest() {
  const btn = lastClick.btn;
  if (!btn || Date.now() - lastClick.t > 800 || !btn.isConnected) return () => {};
  busyCount.set(btn, (busyCount.get(btn) || 0) + 1);
  btn.setAttribute("data-loading", "1");
  btn.setAttribute("aria-busy", "true");
  return () => {
    const n = (busyCount.get(btn) || 1) - 1;
    if (n <= 0) {
      busyCount.delete(btn);
      btn.removeAttribute("data-loading");
      btn.removeAttribute("aria-busy");
    } else {
      busyCount.set(btn, n);
    }
  };
}

export async function api(path, options = {}) {
  const done = trackRequest();
  try {
    return await apiRequest(path, options);
  } finally {
    done();
  }
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : detail?.message || data?.message || res.statusText;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

const QUEUE_KEY = "offlineQueue";

export function enqueue(item) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  q.push({ ...item, queuedAt: Date.now(), status: "pending" });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function getQueue() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
}

export function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function flushQueue() {
  const q = getQueue();
  const next = [];
  for (const item of q) {
    if (item.status === "confirmed") {
      next.push(item);
      continue;
    }
    try {
      await api(item.path, {
        method: item.method,
        body: JSON.stringify(item.body),
        headers: { "Idempotency-Key": item.key },
      });
      next.push({ ...item, status: "confirmed" });
    } catch {
      next.push({ ...item, status: "failed" });
    }
  }
  saveQueue(next);
  return next;
}
