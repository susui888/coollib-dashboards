import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "./types";
import telemetryApp from "./routes/telemetry";
import dashboardApp from "./routes/dashboard";

const app = new Hono<{ Bindings: Bindings }>();

// 1. Global CORS middleware configuration
app.use(
    "/api/*",
    cors({
      origin: "*",
      allowMethods: ["POST", "GET", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })
);

// 2. Combine sub-routers with explicit base paths
// This maps to `/api/mobile-telemetry/events`, `/api/mobile-telemetry/events/batch`, etc.
app.route("/api/mobile-telemetry", telemetryApp);

// This maps to `/api/mobile-telemetry/dashboard` and `/api/mobile-telemetry/stream`
app.route("/api/mobile-telemetry", dashboardApp);

export default app;