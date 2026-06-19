#!/usr/bin/env node
"use strict";
/* =========================================================================
   GAMESHOW SERVER  —  gameshow.thecultofbrighterdays.org
   Handles two jobs:
     1. POST /upload    — saves CSV/XLSX files into jeopardy/games/
     2. POST /webhook   — triggers `git pull` for auto-deploy on push

   Runs on port 3456 (Caddy proxies /upload and /webhook to it).
   Started by systemd: gameshow-server.service
   ========================================================================= */

const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const { exec } = require("child_process");
const crypto   = require("crypto");

const PORT       = 3456;
const GAMES_DIR  = path.join(__dirname, "jeopardy", "games");
const REPO_DIR   = __dirname;

// Optional: set WEBHOOK_SECRET env var to validate GitHub push signatures.
// Leave unset and any POST to /webhook will trigger a pull (fine for private use).
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

// Ensure the games directory exists
fs.mkdirSync(GAMES_DIR, { recursive: true });

/* ---------- multer storage: sanitise filename, allow only csv/xlsx ---------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, GAMES_DIR),
  filename: (_req, file, cb) => {
    // Strip path traversal, keep original name
    const safe = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9 _\-().]/g, "_")   // only safe chars
      .replace(/_{2,}/g, "_")                   // collapse double underscores
      .trim();
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB max
  fileFilter: (_req, file, cb) => {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only .csv, .xlsx, and .xls files are accepted."), ok);
  },
});

/* ---------- app ---------- */
const app = express();

// CORS: allow the jeopardy page (same origin) to hit /upload
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ------------------------------------------------------------------
   POST /upload
   Accepts a multipart form with field name "file".
   Returns JSON: { ok: true, filename: "..." } or { ok: false, error: "..." }
   ------------------------------------------------------------------ */
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("[upload] error:", err.message);
      return res.status(400).json({ ok: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file received." });
    }
    // Make sure Caddy can read the new file
    fs.chmodSync(req.file.path, 0o644);
    console.log("[upload] saved:", req.file.filename);
    res.json({ ok: true, filename: req.file.filename });
  });
});

/* ------------------------------------------------------------------
   DELETE /upload/:filename
   Removes a CSV/XLSX file from jeopardy/games/
   ------------------------------------------------------------------ */
app.delete("/upload/:filename", (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filepath = path.join(GAMES_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ ok: false, error: "File not found." });
  }

  try {
    fs.unlinkSync(filepath);
    console.log("[delete] removed:", filename);
    res.json({ ok: true, filename });
  } catch (err) {
    console.error("[delete] error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------------------------
   POST /webhook
   GitHub-compatible push webhook. Runs `git pull` in the repo root.
   Set WEBHOOK_SECRET env var to validate the X-Hub-Signature-256 header.
   ------------------------------------------------------------------ */
app.use("/webhook", express.raw({ type: "*/*" }));

app.post("/webhook", (req, res) => {
  // Signature validation (optional but recommended)
  if (WEBHOOK_SECRET) {
    const sig = req.headers["x-hub-signature-256"] || "";
    const expected = "sha256=" + crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      console.warn("[webhook] signature mismatch — ignoring");
      return res.status(401).send("Unauthorized");
    }
  }

  res.sendStatus(200); // respond immediately so GitHub doesn't time out

  exec("git -C " + REPO_DIR + " pull", (err, stdout, stderr) => {
    if (err) {
      console.error("[webhook] git pull failed:", stderr);
    } else {
      console.log("[webhook] git pull:", stdout.trim());
      // Fix permissions after pull so Caddy can serve new files
      exec("chmod -R a+rX " + REPO_DIR, () => {});
    }
  });
});

/* ---------- start ---------- */
app.listen(PORT, "127.0.0.1", () => {
  console.log(`[gameshow-server] listening on 127.0.0.1:${PORT}`);
  console.log(`  GAMES_DIR : ${GAMES_DIR}`);
  console.log(`  REPO_DIR  : ${REPO_DIR}`);
  console.log(`  webhook secret: ${WEBHOOK_SECRET ? "set" : "not set (open)"}`);
});
