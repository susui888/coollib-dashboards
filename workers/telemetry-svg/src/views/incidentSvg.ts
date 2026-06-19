// src/views/incidentSvg.ts
// Code snippet is entirely in English as requested

import { IncidentSnapshotMetrics } from '../types';

export function renderIncidentSvg(metrics: IncidentSnapshotMetrics): string {
	const hasFault = metrics.active_incidents > 0;

	// System-wide dynamic state mapping
	const statusColor = hasFault ? "#FF6B6B" : "#2EA44F";
	const statusText = hasFault ? "SYSTEM DEGRADED" : "ALL SYSTEMS OPERATIONAL";

	// Core metric cards text class mapping
	const activeIncidentValClass = hasFault ? "val-red" : "val-gray";

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 325" width="100%" height="100%">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>

    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${statusColor}" />
      <stop offset="100%" stop-color="#bc8cff" />
    </linearGradient>

    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; fill: #c9d1d9; }
      .card-bg { fill: #161b22; stroke: #30363d; stroke-width: 1; rx: 6px; }
      .metric-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 500; fill: #8b949e; }

      /* SRE Core Typography Matrix */
      .val-red { font-family: "SFMono-Regular", Consolas, monospace; font-size: 18px; font-weight: 600; fill: #ff6b6b; }
      .val-gray { font-family: "SFMono-Regular", Consolas, monospace; font-size: 18px; font-weight: 600; fill: #8b949e; }
      .val-green { font-family: "SFMono-Regular", Consolas, monospace; font-size: 18px; font-weight: 600; fill: #3fb950; }
      .val-blue { font-family: "SFMono-Regular", Consolas, monospace; font-size: 18px; font-weight: 600; fill: #58a6ff; }
      .metric-unit { font-size: 10px; font-weight: 400; fill: #8b949e; }

      /* Log Line Pipeline Typography */
      .stream-header { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 700; fill: #8b949e; letter-spacing: 0.5px; }
      .log-text { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; fill: #c9d1d9; }
      .log-time { font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; fill: #8b949e; }
      .footer-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 10px; fill: #8b949e; }

      @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
      }
      .status-pulse { animation: ${hasFault ? 'pulse 1.5s infinite' : 'none'}; }
    </style>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg-grad)" rx="10" />

  <g transform="translate(30, 40)">
    <circle cx="6" cy="-5" r="5" fill="${statusColor}" />
    <text x="20" y="0" class="title">Live Alert Monitor</text>
    <text x="480" y="0" class="footer-text" text-anchor="end">On-Call: ${metrics.on_call_primary}</text>
    <rect x="0" y="12" width="480" height="1" fill="url(#accent-grad)" opacity="0.4" />
  </g>

  <g transform="translate(30, 75)">
    <rect width="150" height="65" class="card-bg" />
    <text x="15" y="24" class="metric-label">Active Incidents</text>
    <text x="15" y="48" class="${activeIncidentValClass}">${metrics.active_incidents}</text>
  </g>

  <g transform="translate(195, 75)">
    <rect width="150" height="65" class="card-bg" />
    <text x="15" y="24" class="metric-label">Clearance Rate</text>
    <text x="15" y="48" class="val-green">${metrics.clearance_rate}<tspan class="metric-unit">%</tspan></text>
  </g>

  <g transform="translate(360, 75)">
    <rect width="150" height="65" class="card-bg" />
    <text x="15" y="24" class="metric-label">Avg MTTR (SLA)</text>
    <text x="15" y="48" class="val-blue">${metrics.avg_mttr}</text>
  </g>

  <text x="30" y="170" class="stream-header">INCIDENT TELEMETRY STREAM (LAST 3 EVENTS)</text>

  <g transform="translate(30, 175)">
    ${metrics.recent_logs[0] ? `
        <circle cx="5" cy="12" r="3" fill="${metrics.recent_logs[0].status === 'active' ? '#FF6B6B' : '#2EA44F'}"/>
        <text x="18" y="16" class="log-text">${metrics.recent_logs[0].title}</text>
        <text x="480" y="16" class="log-time" text-anchor="end">[${metrics.recent_logs[0].created_at}]</text>
    ` : `<text x="5" y="16" class="log-text" fill="#8B949E">No historical incidents tracked in cluster.</text>`}
  </g>

  <g transform="translate(30, 197)">
    ${metrics.recent_logs[1] ? `
        <circle cx="5" cy="12" r="3" fill="${metrics.recent_logs[1].status === 'active' ? '#FF6B6B' : '#2EA44F'}"/>
        <text x="18" y="16" class="log-text">${metrics.recent_logs[1].title}</text>
        <text x="480" y="16" class="log-time" text-anchor="end">[${metrics.recent_logs[1].created_at}]</text>
    ` : ''}
  </g>

  <g transform="translate(30, 219)">
    ${metrics.recent_logs[2] ? `
        <circle cx="5" cy="12" r="3" fill="${metrics.recent_logs[2].status === 'active' ? '#FF6B6B' : '#2EA44F'}"/>
        <text x="18" y="16" class="log-text">${metrics.recent_logs[2].title}</text>
        <text x="480" y="16" class="log-time" text-anchor="end">[${metrics.recent_logs[2].created_at}]</text>
    ` : ''}
  </g>

  <g transform="translate(30, 265)">
    <line x1="0" y1="0" x2="480" y2="0" stroke="#21262D" stroke-width="1"/>

    <circle cx="6" cy="18" r="5" fill="${statusColor}" opacity="0.25" class="status-pulse" />
    <circle cx="6" cy="18" r="3" fill="${statusColor}" />
    <text x="18" y="21" class="footer-text" font-weight="600" fill="${statusColor}" letter-spacing="0.5">${statusText}</text>

    <text x="480" y="21" class="footer-text" text-anchor="end">Engine: Hono + Cloudflare D1</text>
  </g>

</svg>`;
}
