// backend/server.js
//
// Express server. Bütün API route-ları və (production-da) frontend static-i serve edir.

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = Number(process.env.PORT || 5050);
const IS_PROD = process.env.NODE_ENV === "production";

// ─────────── Frontend dist-i tap ───────────
function resolveFrontendDist() {
  const candidates = [];
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "frontend", "dist"));
  }
  candidates.push(path.resolve(__dirname, "..", "frontend", "dist"));

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "index.html"))) {
      console.log("📦 Frontend dist tapıldı:", c);
      return c;
    }
  }
  console.warn("⚠️  Frontend dist tapılmadı (dev-də normaldır)");
  return null;
}

const FRONTEND_PATH = resolveFrontendDist();

// ─────────── Middleware ───────────
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Log middleware (yalnız dev)
if (!IS_PROD) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, mode: IS_PROD ? "production" : "development" });
});

// ─────────── API Routes ───────────
app.use("/auth",        require("./routes/auth"));
app.use("/sections",    require("./routes/sections"));
app.use("/commissions", require("./routes/commissions"));
app.use("/exercises",   require("./routes/exercises"));
app.use("/exams",       require("./routes/exams"));
app.use("/students",    require("./routes/students"));
app.use("/results",     require("./routes/results"));
app.use("/imports",     require("./routes/imports"));
app.use("/exports",     require("./routes/exports"));
app.use("/resultsapp-import", require("./routes/resultsapp-import"));

// ─────────── Static frontend ───────────
if (FRONTEND_PATH) {
  app.use(express.static(FRONTEND_PATH));

  // SPA fallback (yalnız API olmayan yollar)
  app.get(/^(?!\/(api|auth|sections|commissions|exercises|exams|students|results|imports|exports|resultsapp-import)\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
  });
}

// ─────────── Xəta handler ───────────
app.use((err, req, res, _next) => {
  console.error("Server xətası:", err);
  res.status(err.status || 500).json({ message: err.message || "Daxili server xətası" });
});

// ─────────── Start ───────────
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 Server ${PORT} portunda işləyir: http://127.0.0.1:${PORT}`);
});

server.on("error", (err) => {
  console.error("server.listen xətası:", err);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT",  () => server.close(() => process.exit(0)));

module.exports = server;
