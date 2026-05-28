import { ScaleMetrics, RuntimeRawRow } from "./types";

export function renderMonitorSvg(scaleData: ScaleMetrics | null, runtimeData: RuntimeRawRow[]): string {
	const data = scaleData || { books: 0, users: 0, loans: 0, reviews: 0, review_images: 0, timestamp: new Date() };

	const metricsMap: Record<string, number> = {};
	runtimeData.forEach(row => metricsMap[row.metric_name] = row.metric_value);

	const uptimeSeconds = Math.floor(Number(metricsMap['process.uptime'] || 0));
	const days = Math.floor(uptimeSeconds / 86400);
	const hours = Math.floor((uptimeSeconds % 86400) / 3600);
	const uptimeVal = uptimeSeconds > 0 ? (days > 0 ? `${days}d ${hours}h` : `${hours}h`) : "0h";

	const cpuVal = metricsMap['process.cpu.usage'] != null ? (metricsMap['process.cpu.usage'] * 100).toFixed(1) + "%" : "0.1%";
	const heapVal = metricsMap['jvm.memory.used'] != null ? Math.floor(metricsMap['jvm.memory.used'] / 1024 / 1024) + "M" : "314M";
	const requestsVal = metricsMap['spring.security.http.secured.requests'] != null ? Math.floor(metricsMap['spring.security.http.secured.requests']).toLocaleString() : "0";
	const dbPoolVal = metricsMap['hikaricp.connections.active'] != null ? Math.floor(metricsMap['hikaricp.connections.active']) + "/20" : "0/20";

	const utilization = data.books > 0 ? ((data.loans / data.books) * 100).toFixed(1) + "%" : "0.0%";
	const mediaDensity = data.reviews > 0 ? (data.review_images / data.reviews).toFixed(2) : "0.00";
	const engagement = data.users > 0 ? (data.reviews / data.users).toFixed(2) : "0.00";

	const nonce = Math.random().toString(36).substring(2, 7).toUpperCase();

	return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260" viewBox="0 0 520 260" fill="none">
  <defs>
    <filter id="smooth-shadow" x="0" y="0" width="520" height="260" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.07" />
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.04" />
    </filter>
  </defs>

  <style>
    .card { fill: #FFFFFF; stroke: #E1E4E8; stroke-width: 1.5; rx: 6px; }
    .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; fill: #24292E; }
    .section-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; fill: #586069; text-transform: uppercase; letter-spacing: 0.3px; }
    .label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 12px; fill: #24292E; font-weight: 400; dominant-baseline: central; }
    .value { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 12px; font-weight: 600; fill: #24292E; text-anchor: end; dominant-baseline: central; }
    .footer-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10px; fill: #586069; font-weight: 400; }
    .divider { stroke: #E1E4E8; stroke-width: 1; }
    .icon { fill: #586069; }
    .icon-accent { fill: #8B4513; }
  </style>

  <g filter="url(#smooth-shadow)">
    <rect class="card" width="500" height="240" x="10" y="10" />
  </g>

  <g transform="translate(32, 36)">
    <svg class="icon" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M16 8.5c0-.78-.44-1.45-1.06-1.78.11-.47.16-.95.16-1.44 0-1.25-.45-2.42-1.22-3.34-.34-.41-.77-.77-1.25-1.05C11.53.33 10.19 0 8.75 0c-1.44 0-2.78.33-3.89.89-.48.28-.91.64-1.25 1.05C2.84 2.86 2.39 4.03 2.39 5.28c0 .48.05.97.16 1.44C1.94 7.05 1.5 7.72 1.5 8.5c0 .78.44 1.45 1.06 1.78-.11.47-.16.95-.16 1.44 0 1.25.45 2.42 1.22 3.34.34.41.77.77 1.25 1.05 1.11.56 2.45.89 3.89.89 1.44 0 2.78-.33 3.89-.89.48-.28.91-.64 1.25-1.05.77-.92 1.22-2.09 1.22-3.34 0-.48-.05-.97-.16-1.44.62-.33 1.06-1 1.06-1.78zm-1.5 0c0 .41-.34.75-.75.75s-.75-.34-.75-.75.34-.75.75-.75.75.34.75.75zM8.75 14c-2.9 0-5.25-2.24-5.25-5s2.35-5 5.25-5 5.25 2.24 5.25 5-2.35 5-5.25 5z"></path></svg>
    <text class="title" x="24" y="13">Infrastructure Mini Monitor</text>
  </g>

  <g transform="translate(32, 72)">
    <text class="section-title" x="0" y="0">Logistics Metrics</text>
    <g transform="translate(0, 20)">
      <path class="icon icon-accent" d="M0 1h12v11H0V1zm2 2v7h8V3H2z" />
      <text class="label" x="22" y="6">Total Books</text>
      <text class="value" x="190" y="6">${Math.floor(data.books).toLocaleString()}</text>
    </g>
    <g transform="translate(0, 42)">
      <path class="icon" d="M6 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 7.5A2.5 2.5 0 0 1 4.5 5h3A2.5 2.5 0 0 1 10 7.5V9H2V7.5z" />
      <text class="label" x="22" y="5.5">Total Users</text>
      <text class="value" x="190" y="5.5">${Math.floor(data.users).toLocaleString()}</text>
    </g>
    <g transform="translate(0, 64)">
      <path class="icon icon-accent" d="M6 0a6 6 0 1 0 4.24 1.76L9.17 2.83A4.5 4.5 0 1 1 6 1.5V3l3-2-3-2v1.5z" />
      <text class="label" x="22" y="6">Inventory Util</text>
      <text class="value" x="190" y="6" fill="#8B4513">${utilization}</text>
    </g>
    <g transform="translate(0, 86)">
      <path class="icon" d="M1 1h10v10H1V1zm1.5 7.5h7L7 5 5 7.5l-1.5-1-2 2z" />
      <text class="label" x="22" y="6">Media Enrichment</text>
      <text class="value" x="190" y="6">${mediaDensity}</text>
    </g>
    <g transform="translate(0, 108)">
      <path class="icon" d="M2 1h8v2H2V1zm0 4h8v6H2V5zm1.5 1.5v3h5v-3h-5z" />
      <text class="label" x="22" y="6">Engagement Index</text>
      <text class="value" x="190" y="6">${engagement}</text>
    </g>
  </g>

  <line class="divider" x1="260" y1="72" x2="260" y2="195" />

  <g transform="translate(288, 72)">
    <text class="section-title" x="0" y="0">Edge Telemetry</text>
    <g transform="translate(0, 20)">
      <path class="icon" d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM5.5 3v3.5h3v-1h-2V3h-1z" />
      <text class="label" x="22" y="6">Uptime</text>
      <text class="value" x="190" y="6" fill="#0366D6">${uptimeVal}</text>
    </g>
    <g transform="translate(0, 42)">
      <path class="icon" d="M1 1h10v7H1V1zm1.5 1.5v4h7v-4h-7zM3 9h1v2H3V9zm5 0h1v2H8V9z" />
      <text class="label" x="22" y="5.5">CPU Usage</text>
      <text class="value" x="190" y="5.5">${cpuVal}</text>
    </g>
    <g transform="translate(0, 64)">
      <path class="icon" d="M1 1h10v2H1V1zm0 4h10v2H1V5zm0 4h10v2H1V9z" />
      <text class="label" x="22" y="6">JVM Heap</text>
      <text class="value" x="190" y="6">${heapVal}</text>
    </g>
    <g transform="translate(0, 86)">
      <path class="icon" d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2zM3 3h6v1H3V3zm0 2h4v1H3V5z" />
      <text class="label" x="22" y="5.5">Secured Requests</text>
      <text class="value" x="190" y="5.5">${requestsVal}</text>
    </g>
    <g transform="translate(0, 108)">
      <path class="icon" d="M1 2c0-1.1 2.24-2 6-2s5 .9 5 2-2.24 2-5 2-5-.9-5-2zm0 3.5c0 1.1 2.24 2 5 2s5-.9 5-2 M1 9c0 1.1 2.24 2 5 2s5-.9 5-2" />
      <text class="label" x="22" y="5.5">DB Pool Active</text>
      <text class="value" x="190" y="5.5">${dbPoolVal}</text>
    </g>
  </g>

  <g transform="translate(32, 222)">
    <text class="footer-text" x="0" y="0">Pipeline: Cloudflare Workers • Edge Cached: 30m • ID: ${nonce}</text>
  </g>
</svg>`.trim();
}
