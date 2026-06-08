// electron/main.js
//
// Electron əsas prosesi:
//   1) Backend Express server-ini child process kimi başladır
//   2) Server hazır olanı gözləyir (port 5050 dinləyənə qədər)
//   3) BrowserWindow açıb http://localhost:5050 yükləyir
//   4) App bağlananda backend-i də öldürür
//
// DB faylı `userData` qovluğunda saxlanılır:
//   • Windows: %APPDATA%/ExamStation/database.db
//   • macOS:   ~/Library/Application Support/ExamStation/database.db
//   • Linux:   ~/.config/ExamStation/database.db

const { app, BrowserWindow, Menu, shell, dialog, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const net = require("net");

const IS_DEV = !app.isPackaged;
const PORT = Number(process.env.PORT || 5050);

// ─────────── Backend entry-point tap ───────────
function resolveBackendEntry() {
  if (IS_DEV) {
    return path.join(__dirname, "..", "backend", "server.js");
  }
  const candidates = [
    path.join(process.resourcesPath, "app.asar.unpacked", "backend", "server.js"),
    path.join(process.resourcesPath, "app.asar", "backend", "server.js"),
    path.join(process.resourcesPath, "backend", "server.js"),
    path.join(__dirname, "..", "backend", "server.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ─────────── User data DB yolu ───────────
function getUserDbPath() {
  return path.join(app.getPath("userData"), "database.db");
}

// ─────────── Portu gözlə ───────────
function waitForPort(port, host = "127.0.0.1", timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.once("connect", () => { sock.destroy(); resolve(); });
      sock.once("error",   () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Port ${port} ${timeoutMs}ms ərzində açılmadı`));
        }
        setTimeout(tryConnect, 300);
      });
      sock.once("timeout", () => { sock.destroy(); setTimeout(tryConnect, 300); });
      sock.connect(port, host);
    };
    tryConnect();
  });
}

// ─────────── Backend prosesi ───────────
let backendProcess = null;

function startBackend() {
  const entry = resolveBackendEntry();
  if (!entry) {
    dialog.showErrorBox(
      "Server tapılmadı",
      "backend/server.js paketdə tapılmadı. Quraşdırma korlanmış ola bilər."
    );
    app.quit();
    return null;
  }

  console.log("🚀 Backend başladılır:", entry);

  backendProcess = fork(entry, [], {
    env: {
      ...process.env,
      NODE_ENV: IS_DEV ? "development" : "production",
      PORT: String(PORT),
      DB_PATH: getUserDbPath(),
      USER_DATA_DIR: app.getPath("userData"),
      // ELECTRON_RUN_AS_NODE ilə forklanan prosesdə process.resourcesPath
      // tanımsız ola bilər — frontend dist-i tapmaq üçün env ilə ötürürük.
      RESOURCES_PATH: process.resourcesPath,
      ELECTRON_RUN_AS_NODE: "1",
    },
    // Paketlənmiş halda backend `app.asar` içindədir; `app.asar` real qovluq
    // deyil, ona görə cwd kimi real `resources` qovluğunu veririk (ENOENT-in qarşısı).
    cwd: IS_DEV ? path.dirname(entry) : process.resourcesPath,
    silent: false,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  backendProcess.stdout?.on("data", (d) => console.log("[backend]", d.toString().trim()));
  backendProcess.stderr?.on("data", (d) => console.error("[backend ERR]", d.toString().trim()));
  backendProcess.on("error", (e) => console.error("[backend fork-error]", e));
  backendProcess.on("exit", (code) => {
    console.log(`[backend] çıxdı kod=${code}`);
    backendProcess = null;
  });

  return backendProcess;
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try { backendProcess.kill(); } catch (_) {}
    backendProcess = null;
  }
}

// ─────────── Pəncərə ───────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: "Exam Station",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Yalnız HƏQİQİ xarici (http/https, localhost olmayan) linkləri brauzerdə aç.
  // İxrac/yükləmə linkləri (127.0.0.1) burada tutulmamalıdır ki, daxili
  // `will-download` mexanizmi işləsin.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isLocal = url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost");
    if (!isLocal) shell.openExternal(url);
    return { action: "deny" };
  });

  // DEV-də Vite dev server (HMR), PROD-da Express static
  const url = IS_DEV
    ? "http://localhost:5173/"
    : `http://127.0.0.1:${PORT}/`;

  mainWindow.loadURL(url).catch((err) => {
    console.error("loadURL xətası:", err);
    dialog.showErrorBox("Yükləmə xətası", err.message);
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─────────── İxrac yükləmələri ───────────
// Frontend `/exports/...` linkinə klik edəndə Electron `will-download`
// hadisəsini tetikler. SavePath verilmədiyi üçün Electron "Farklı kaydet"
// pəncərəsini göstərir; `done` dinləyicisi xəta halında bildirir.
function setupDownloads() {
  session.defaultSession.on("will-download", (event, item) => {
    item.once("done", (_e, state) => {
      if (state !== "completed") {
        dialog.showErrorBox("İxrac yüklənmədi", `Hal: ${state}`);
      }
    });
  });
}

// ─────────── Lifecycle ───────────
app.whenReady().then(async () => {
  startBackend();

  try {
    await waitForPort(PORT);
  } catch (err) {
    dialog.showErrorBox("Server başlamadı", err.message);
    app.quit();
    return;
  }

  setupDownloads();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopBackend);
app.on("quit", stopBackend);

// Tək instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}