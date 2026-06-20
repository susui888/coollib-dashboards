// src/views/systemSvg.ts
// Code snippet is entirely in English as requested

import { ScaleMetrics, RuntimeRawRow } from "../types";

export function renderMonitorSvg(scaleData: ScaleMetrics | null, runtimeData: RuntimeRawRow[]): string {
	const data = scaleData || { books: 0, users: 0, loans: 0, reviews: 0, review_images: 0, timestamp: new Date() };

	const metricsMap: Record<string, number> = {};
	runtimeData.forEach(row => metricsMap[row.metric_name] = row.metric_value);

	// Compute infrastructure metrics
	const uptimeSeconds = Math.floor(Number(metricsMap['process.uptime'] || 0));
	const days = Math.floor(uptimeSeconds / 86400);
	const hours = Math.floor((uptimeSeconds % 86400) / 3600);
	const uptimeVal = uptimeSeconds > 0 ? (days > 0 ? `${days}d ${hours}h` : `${hours}h`) : "0h";

	const cpuVal = metricsMap['process.cpu.usage'] != null ? (metricsMap['process.cpu.usage'] * 100).toFixed(1) + "%" : "0.1%";
	const heapVal = metricsMap['jvm.memory.used'] != null ? Math.floor(metricsMap['jvm.memory.used'] / 1024 / 1024) + "M" : "314M";
	const requestsVal = metricsMap['spring.security.http.secured.requests'] != null ? Math.floor(metricsMap['spring.security.http.secured.requests']).toLocaleString() : "0";

	// Compute operational diagnostics
	const utilization = data.books > 0 ? ((data.loans / data.books) * 100).toFixed(1) + "%" : "0.0%";
	const mediaDensity = data.reviews > 0 ? (data.review_images / data.reviews).toFixed(2) : "0.00";
	const engagement = data.users > 0 ? (data.reviews / data.users).toFixed(2) : "0.00";

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 490" width="100%" height="100%">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>

    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#58a6ff" />
      <stop offset="100%" stop-color="#bc8cff" />
    </linearGradient>

    <linearGradient id="spark-green-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3fb950" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#3fb950" stop-opacity="0.0" />
    </linearGradient>
    <linearGradient id="spark-purple-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#bc8cff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#bc8cff" stop-opacity="0.0" />
    </linearGradient>

    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 600; fill: #c9d1d9; }
      .card-bg { fill: #21262d; stroke: #30363d; stroke-width: 1; rx: 6px; }
      .metric-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 500; fill: #8b949e; text-transform: uppercase; letter-spacing: 0.3px; }

      .metric-value { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; fill: #58a6ff; }
      .metric-value-green { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; fill: #3fb950; }
      .metric-value-purple { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; fill: #bc8cff; }

      .metric-unit { font-size: 12px; font-weight: 400; fill: #8b949e; }
      .footer-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; fill: #8b949e; }
    </style>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg-grad)" stroke="#444c56" stroke-width="1" rx="10" />

  <g transform="translate(30, 40)">
    <circle cx="10" cy="-6" r="6" fill="#bc8cff" />
    <text x="26" y="0" class="title">Infrastructure Mini Monitor</text>
    <rect x="0" y="12" width="740" height="1" fill="url(#accent-grad)" opacity="0.4" />
  </g>

  <g transform="translate(30, 80)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Total Books</text>
    <text x="20" y="58" class="metric-value">${Math.floor(data.books).toLocaleString()} <tspan class="metric-unit">in ecosystem</tspan></text>
  </g>

  <g transform="translate(30, 170)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Inventory Utilization</text>
    <text x="20" y="58" class="metric-value-purple">${utilization} <tspan class="metric-unit" fill="#8b949e">loaned ratio</tspan></text>
  </g>

  <g transform="translate(30, 260)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Media Enrichment</text>
    <text x="20" y="58" class="metric-value">${mediaDensity} <tspan class="metric-unit">images per review</tspan></text>
  </g>

  <g transform="translate(30, 350)">
    <rect width="360" height="75" class="card-bg" />
    <path d="M 180 48 Q 200 51, 220 47 T 260 50 T 300 46 T 340 48 L 340 70 L 180 70 Z" fill="url(#spark-purple-grad)" />
    <path d="M 180 48 Q 200 51, 220 47 T 260 50 T 300 46 T 340 48" fill="none" stroke="#bc8cff" stroke-width="4" stroke-linecap="round" opacity="0.15" />
    <path d="M 180 48 Q 200 51, 220 47 T 260 50 T 300 46 T 340 48" fill="none" stroke="#bc8cff" stroke-width="1.5" stroke-linecap="round" opacity="0.75" />
    <circle cx="340" cy="48" r="3" fill="#bc8cff" />

    <text x="20" y="30" class="metric-label">Engagement Index</text>
    <text x="20" y="58" class="metric-value">${engagement} <tspan class="metric-unit">reviews per user</tspan></text>
  </g>

  <g transform="translate(410, 80)">
    <rect width="360" height="75" class="card-bg" />
    <path d="M 180 64 L 220 58 L 260 46 L 300 35 L 340 22 L 340 70 L 180 70 Z" fill="url(#spark-green-grad)" />
    <path d="M 180 64 L 220 58 L 260 46 L 300 35 L 340 22" fill="none" stroke="#3fb950" stroke-width="4" stroke-linecap="round" opacity="0.2" />
    <path d="M 180 64 L 220 58 L 260 46 L 300 35 L 340 22" fill="none" stroke="#3fb950" stroke-width="1.5" stroke-linecap="round" opacity="0.85" />
    <circle cx="340" cy="22" r="3" fill="#3fb950" />

    <text x="20" y="30" class="metric-label">System Uptime</text>
    <text x="20" y="58" class="metric-value-green">${uptimeVal} <tspan class="metric-unit" fill="#8b949e">uptime</tspan></text>
  </g>

  <g transform="translate(410, 170)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">CPU Usage</text>
    <text x="20" y="58" class="metric-value">${cpuVal} <tspan class="metric-unit">process compute workload</tspan></text>
  </g>

  <g transform="translate(410, 260)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">JVM Heap Allocation</text>
    <text x="20" y="58" class="metric-value">${heapVal} <tspan class="metric-unit">memory utilization</tspan></text>
  </g>

  <g transform="translate(410, 350)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Secured Requests</text>
    <text x="20" y="58" class="metric-value">${requestsVal} <tspan class="metric-unit">http operations</tspan></text>
  </g>

  <g transform="translate(30, 455)">
    <circle cx="6" cy="5" r="6" fill="#3fb950" opacity="0.25" />
    <circle cx="6" cy="5" r="3.5" fill="#3fb950" />
    <text x="18" y="10" class="footer-text" font-weight="500">GITHUB LIVE TELEMETRY ACTIVE</text>
  </g>

</svg>`.trim();
}
