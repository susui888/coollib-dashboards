// src/views/iOSAnalyticsSvg.ts

import { MobileAnalyticsMetrics } from "../types";

export class iOSAnalyticsSvg {
	/**
	 * Renders a highly polished 800x490 micro-dashboard SVG
	 * optimized for GitHub README data injection with active breathing animation.
	 * @param metrics Extracted 7-day rolling SRE Golden Signals
	 * @param displayDate The dynamic day span string (e.g., "2026.06.17 - 2026.06.23")
	 */
	static renderSvg(metrics: MobileAnalyticsMetrics, displayDate: string): string {
		// Deep runtime health assertion matrix (Retained for card-level individual warnings)
		const hasCrash = metrics.top_crash_count > 0;

		// 📌 FORCE OPERATIONAL OVERRIDE:
		// Completely bypass global degradation logic. The main status bar at the bottom
		// will now remain perfectly green ("OPERATIONAL") permanently under any telemetry spikes.
		const isDegraded = false;

		// System-wide dynamic state mapping
		const statusColor = isDegraded ? "#FF6B6B" : "#3fb950";
		const statusText = isDegraded ? "IOS SYSTEM OPERATIONAL" : "IOS SYSTEM OPERATIONAL";

		// Keep the single metric text red if it exceeds the limit, providing subtle engineering hints
		const errorClass = metrics.error_rate >= 1.5 ? "val-red" : "val-green";

		// 📌 Double-check to wipe out any physical/escaped quotes before layout rendering
		const cleanKeyword = String(metrics.top_keyword ?? "N/A")
			.replace(/["'region“”\s]/g, "")
			.trim();

		// Dynamic Sparklines matching the 360x75 card coordinate matrices
		// 📌 ADDED: Applied 'spark-bg-pulse' class only to the gradient path for a pure breathing effect.
		const throughputSparkline = `<path d="M 180 65 Q 210 35, 240 50 T 300 40 T 340 30 L 340 70 L 180 70 Z" fill="url(#spark-blue-grad)" class="spark-bg-pulse" />
    <path d="M 180 65 Q 210 35, 240 50 T 300 40 T 340 30" fill="none" stroke="#58a6ff" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
    <circle cx="340" cy="30" r="3" fill="#58a6ff" />`;

		const funnelSparkline = `<path d="M 180 45 Q 210 42, 240 45 T 300 41 T 340 43 L 340 70 L 180 70 Z" fill="url(#spark-green-grad)" class="spark-bg-pulse" />
    <path d="M 180 45 Q 210 42, 240 45 T 300 41 T 340 43" fill="none" stroke="#3fb950" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
    <circle cx="340" cy="43" r="3" fill="#3fb950" />`;

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 490" width="100%" height="100%">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>

    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3fb950" />
      <stop offset="100%" stop-color="#bc8cff" />
    </linearGradient>

    <linearGradient id="spark-blue-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#58a6ff" stop-opacity="0.0" />
    </linearGradient>
    <linearGradient id="spark-green-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3fb950" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#3fb950" stop-opacity="0.0" />
    </linearGradient>

    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 600; fill: #c9d1d9; }
      .meta-date { font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; font-weight: 500; fill: #8b949e; }
      .card-bg { fill: #21262d; stroke: #30363d; stroke-width: 1; rx: 6px; }
      .metric-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 500; fill: #8b949e; }

      .val-blue { font-family: "SFMono-Regular", Consolas, monospace; font-size: 20px; font-weight: 600; fill: #58a6ff; }
      .val-green { font-family: "SFMono-Regular", Consolas, monospace; font-size: 20px; font-weight: 600; fill: #3fb950; }
      .val-purple { font-family: "SFMono-Regular", Consolas, monospace; font-size: 20px; font-weight: 600; fill: #bc8cff; }
      .val-red { font-family: "SFMono-Regular", Consolas, monospace; font-size: 20px; font-weight: 600; fill: #ff6b6b; }

      .metric-unit { font-size: 12px; font-weight: 400; fill: #8b949e; font-family: -apple-system, sans-serif; }
      .footer-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; fill: #8b949e; }

      /* 📌 PURE GRADIENT BREATHING LOOP */
      .spark-bg-pulse {
        animation: spark-pulse 4s ease-in-out infinite alternate;
      }

      @keyframes spark-pulse {
        0% { opacity: 0.3; }
        100% { opacity: 1.0; }
      }
    </style>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg-grad)" stroke="#444c56" stroke-width="1" rx="10" />

  <g transform="translate(30, 40)">
    <circle cx="10" cy="-6" r="6" fill="#3fb950" />
    <text x="26" y="0" class="title">iOS Core Metrics Panel</text>
    <text x="740" y="0" class="meta-date" text-anchor="end">Snapshot: ${displayDate}</text>
    <rect x="0" y="12" width="740" height="1" fill="url(#accent-grad)" opacity="0.4" />
  </g>

  <g transform="translate(30, 80)">
    <rect width="360" height="75" class="card-bg" />
    ${throughputSparkline}
    <text x="20" y="30" class="metric-label">App Traffic Volume</text>
    <text x="20" y="58" class="val-blue">${metrics.total_requests.toLocaleString()} <tspan class="metric-unit">requests</tspan></text>
  </g>

  <g transform="translate(410, 80)">
    <rect width="360" height="75" class="card-bg" />
    ${funnelSparkline}
    <text x="20" y="30" class="metric-label">Cart Funnel Conversion</text>
    <text x="20" y="58" class="val-green">${metrics.funnel_conversion_rate}% <tspan class="metric-unit">cart-to-rent</tspan></text>
  </g>

  <g transform="translate(30, 180)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Network Latency (P95)</text>
    <text x="20" y="58" class="val-purple">${metrics.p95_latency_ms}<tspan class="metric-unit">ms</tspan></text>
  </g>

  <g transform="translate(410, 180)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">HTTP Error Rate</text>
    <text x="20" y="58" class="${errorClass}">${metrics.error_rate}% <tspan class="metric-unit" fill="#8b949e">failures</tspan></text>
  </g>

  <g transform="translate(30, 280)">
    <rect width="740" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Critical iOS Runtime Crash</text>
    <text x="20" y="55" class="${hasCrash ? 'val-red' : 'val-green'}" font-size="14px">${metrics.top_crash_name}</text>
    <text x="720" y="55" class="metric-unit" text-anchor="end">Occurrences: ${metrics.top_crash_count}</text>
  </g>

  <g transform="translate(30, 380)">
    <rect width="740" height="45" class="card-bg" />
    <text x="20" y="27" class="metric-label">Trending Search Keyword:</text>
    <text x="190" y="28" class="val-green" font-size="16px">${cleanKeyword}</text>
    <text x="720" y="27" class="metric-unit" text-anchor="end">Business Intelligence Ingestion</text>
  </g>

  <g transform="translate(30, 442)">
    <line x1="0" y1="0" x2="740" y2="0" stroke="#30363D" stroke-width="1"/>
    <circle cx="6" cy="16" r="5" fill="${statusColor}" opacity="0.25" />
    <circle cx="6" cy="16" r="3.5" fill="${statusColor}" />
    <text x="18" y="20" class="footer-text" font-weight="600" fill="${statusColor}">${statusText}</text>
  </g>

</svg>`.trim();
	}
}
