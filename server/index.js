import "dotenv/config";

import express from "express";
import cors from "cors";

import { studentRouter } from "./routes/student.js";
import { assessmentRouter } from "./routes/assessment.js";
import { aiChatRouter } from "./routes/aiChat.js";
import { ascoraRouter } from "./routes/ascora.js";
import { notebookRouter } from "./routes/notebook.js";

const app = express();

const PORT = Number(process.env.PORT) || 3001;

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173";

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "2mb",
  })
);

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ascora-api",
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// Supabase / AI configuration debug
// --------------------------------------------------

app.get("/api/debug/supabase", (req, res) => {
  res.json({
    supabaseUrlConfigured:
      Boolean(process.env.SUPABASE_URL),

    serviceKeyConfigured:
      Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),

    anonKeyConfigured:
      Boolean(
        process.env.VITE_SUPABASE_ANON_KEY
      ),

    hfTokenConfigured:
      Boolean(process.env.HF_TOKEN),

    aiKeyConfigured:
      Boolean(process.env.AI_API_KEY),
  });
});

// --------------------------------------------------
// Routes
// --------------------------------------------------

app.use(
  "/api/assessment",
  assessmentRouter
);

app.use(
  "/api/ai",
  aiChatRouter
);

app.use(
  "/api/ascora",
  ascoraRouter
);

app.use(
  "/api/notebook",
  notebookRouter
);

app.use(
  "/api/student",
  studentRouter
);

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
  });
});

// --------------------------------------------------
// Global error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : undefined,
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("====================================");
  console.log("       ASCORA API SERVER");
  console.log("====================================");
  console.log(
    `Server: http://localhost:${PORT}`
  );
  console.log(
    `Frontend: ${CLIENT_ORIGIN}`
  );

  console.log(
    `Supabase URL: ${
      process.env.SUPABASE_URL
        ? "configured"
        : "NOT CONFIGURED"
    }`
  );

  console.log(
    `Supabase Server Key: ${
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "configured"
        : "NOT CONFIGURED"
    }`
  );

  console.log(
    `Supabase Anon Key: ${
      process.env.VITE_SUPABASE_ANON_KEY
        ? "configured"
        : "NOT CONFIGURED"
    }`
  );

  console.log(
    `HF Token: ${
      process.env.HF_TOKEN
        ? "configured"
        : "NOT CONFIGURED"
    }`
  );

  console.log("====================================");
  console.log("");
});