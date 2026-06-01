// src/lib/api.js
// Sade fetch wrapper. Dev-də Vite proxy ilə işləyir, prod-da eyni origin.

async function handle(res) {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data.message || msg;
    } catch {}
    const err = new Error(msg || "Server xətası");
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  get(path) {
    return fetch(path).then(handle);
  },
  post(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then(handle);
  },
  put(path, body) {
    return fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then(handle);
  },
  del(path) {
    return fetch(path, { method: "DELETE" }).then(handle);
  },
  /** multipart upload — `file` field */
  upload(path, file) {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(path, { method: "POST", body: fd }).then(handle);
  },
  /** Brauzerin yükləməsini başlat */
  download(path, filename) {
    const a = document.createElement("a");
    a.href = path;
    if (filename) a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};
