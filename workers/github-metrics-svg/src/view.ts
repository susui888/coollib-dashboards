import { TelemetryData } from "./types";

export function renderTelemetrySvg(data: TelemetryData): string {
	const nonce = Math.random().toString(36).substring(2, 7).toUpperCase();

	return `
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260" viewBox="0 0 520 260" fill="none">
  <defs>
    <filter id="cream-premium-shadow" x="0" y="0" width="520" height="260" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#544333" flood-opacity="0.06" />
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#544333" flood-opacity="0.04" />
    </filter>
    <linearGradient id="cream-card-gradient" x1="10" y1="10" x2="510" y2="250" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FAF8F5" />
      <stop offset="100%" stop-color="#F4EFEA" />
    </linearGradient>
  </defs>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;800&amp;family=JetBrains+Mono:wght@700;800&amp;display=swap');
    .card { fill: url(#cream-card-gradient); stroke: #E6DFD5; stroke-width: 1.2; rx: 6px; }
    .title { font-family: "Inter", -apple-system, sans-serif; font-size: 14px; font-weight: 800; fill: #2D2219; letter-spacing: -0.1px; text-transform: uppercase; }
    .label { font-family: "Inter", -apple-system, sans-serif; font-size: 10px; fill: #665C54; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; dominant-baseline: central; }
    .value { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 800; fill: #2D2219; letter-spacing: -0.2px; text-anchor: end; dominant-baseline: central; }
    .sync-text { font-family: "Inter", -apple-system, sans-serif; font-size: 9px; fill: #998E84; font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase; }
    .badge { fill: #EBE5DC; rx: 4px; }
    .badge-text { font-family: "Inter", -apple-system, sans-serif; font-size: 8px; font-weight: 700; fill: #7A6F65; text-transform: uppercase; letter-spacing: 0.8px; }
    .c-brown { fill: #8B5A2B; } .c-green { fill: #1E7E34; } .c-blue { fill: #1A5FB4; } .c-purple { fill: #6A1B9A; } .c-slate { fill: #665C54; }
    .txt-brown { fill: #8B5A2B; } .txt-green { fill: #1E7E34; } .txt-blue { fill: #1A5FB4; }
    .line { stroke: #E6DFD5; stroke-width: 1; stroke-dasharray: 4 3; }
  </style>

  <g filter="url(#cream-premium-shadow)"><rect class="card" width="500" height="240" x="10" y="10" /></g>

  <g transform="translate(30, 42)">
    <circle class="c-brown" cx="4" cy="6" r="3.5" /><circle class="c-green" cx="13" cy="6" r="3.5" /><circle class="c-blue" cx="22" cy="6" r="3.5" />
    <text class="title" x="34" y="10">GitHub Telemetry Monitor</text>
  </g>

  <g transform="translate(34, 78)">
    <rect class="badge" width="134" height="16" y="-12" />
    <text class="badge-text" x="6" y="-1">GLOBAL METRICS</text>

    <g transform="translate(0, 24)"><path class="c-brown" d="M2 1h8v2H2V1zm0 4h8v6H2V5zm1.5 1.5v3h5v-3h-5z" /><text class="label" x="20" y="6">COMMITS</text><text class="value" x="180" y="6">${data.commits}</text></g>
    <g transform="translate(0, 46)"><path class="c-slate" d="M6 0a6 6 0 1 0 4.24 1.76L9.17 2.83A4.5 4.5 0 1 1 6 1.5V3l3-2-3-2v1.5z" /><text class="label" x="20" y="5.5">PUSHES</text><text class="value" x="180" y="5.5">${data.pushes}</text></g>
    <g transform="translate(0, 68)"><path class="c-brown" d="M0 1h12v11H0V1zm2 2v7h8V3H2z" /><text class="label" x="20" y="6">REPOSITORIES</text><text class="value txt-brown" x="180" y="6">${data.repos}</text></g>
    <g transform="translate(0, 90)"><path class="c-purple" d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM5.5 3v3.5h3v-1h-2V3h-1z" /><text class="label" x="20" y="6">LAST PUSH</text><text class="value" x="180" y="6">${data.lastPush}</text></g>
    <g transform="translate(0, 112)"><path class="c-blue" d="M1 2c0-1.1 2.24-2 6-2s5 .9 5 2-2.24 2-5 2-5-.9-5-2zm0 3.5c0 1.1 2.24 2 5 2s5-.9 5-2" /><text class="label" x="20" y="6">LATEST REPO</text><text class="value txt-blue" x="180" y="6">${data.latestRepo}</text></g>
  </g>

  <line class="line" x1="254" y1="70" x2="254" y2="195" />

  <g transform="translate(278, 78)">
    <rect class="badge" width="148" height="16" y="-12" /><text class="badge-text" x="6" y="-1">LATEST TRANSACTION</text>

    <g transform="translate(0, 24)"><path class="c-purple" d="M1 1h10v10H1V1zm1.5 7.5h7L7 5 5 7.5l-1.5-1-2 2z" /><text class="label" x="20" y="6">BRANCH</text><text class="value" x="185" y="6">${data.branch}</text></g>
    <g transform="translate(0, 46)"><path class="c-slate" d="M1 1h10v7H1V1zm1.5 1.5v4h7v-4h-7z" /><text class="label" x="20" y="5.5">LANGUAGE</text><text class="value" x="185" y="5.5">${data.language}</text></g>
    <g transform="translate(0, 68)"><path class="c-slate" d="M6 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 7.5A2.5 2.5 0 0 1 4.5 5h3A2.5 2.5 0 0 1 10 7.5V9H2V7.5z" /><text class="label" x="20" y="6">ACTOR</text><text class="value" x="185" y="6">${data.actor}</text></g>
    <g transform="translate(0, 90)"><path class="c-blue" d="M1 1h10v2H1V1zm0 4h10v2H1V5zm0 4h10v2H1V9z" /><text class="label" x="20" y="5.5">CHANGED</text><text class="value" x="185" y="5.5">${data.changed}</text></g>
    <g transform="translate(0, 112)"><path class="c-green" d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z" /><text class="label" x="20" y="5.5">CI STATUS</text><text class="value txt-green" x="185" y="5.5">${data.ci}</text></g>
  </g>

  <text class="sync-text" x="34" y="225">GITHUB TELEMETRY: REAL-TIME | D1 PERSISTED | SYNC ID: ${nonce}</text>
</svg>
  `.trim();
}
