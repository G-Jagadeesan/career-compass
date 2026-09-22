/**
 * Career Compass Server
 * Main entry point for the Hono server
 */

// Load environment variables FIRST before any other imports
import "dotenv/config";

import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import routes from "./routes.js";

const app = new Hono();

// Mount API routes
app.route("/", routes);

// Serve static files from /public
app.use("/*", serveStatic({ root: "./public" }));
app.use("/", serveStatic({ path: "./public/index.html" }));

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Start server
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`Career Compass server starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port
});

console.log(`Server running at http://localhost:${port}`);
