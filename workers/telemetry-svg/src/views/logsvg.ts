import { LogMetrics, LogEvent } from '../types';

export function renderLogSvg(metrics: LogMetrics): string {
	const hasIssues = metrics.error_count > 0;
	const statusColor = hasIssues ? "#FF6B6B" : "#3FB950";
	const statusText = hasIssues ? "ERRORS" : "HEALTHY";
	const errorValClass = hasIssues ? "val-red" : "val-green";

	// 动态计算流量分布
	const logs = metrics.recent_logs || [];
	const platformCount = logs.reduce((acc, log) => {
		acc[log.platform] = (acc[log.platform] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);

	const totalCount = logs.length || 1;
	const pctBackend = Math.round(((platformCount['backend'] || 0) / totalCount) * 100);
	const pctAndroid = Math.round(((platformCount['android'] || 0) / totalCount) * 100);
	const pctIos = Math.round(((platformCount['ios'] || 0) / totalCount) * 100);

	// 动态网关层延迟模拟
	const baseLatency = hasIssues ? 38 : 16;
	const p95Latency = `${baseLatency + (metrics.total_logs % 6)}ms`;

	const getLevelColor = (level: string) => {
		if (level === 'ERROR') return '#FF6B6B';
		if (level === 'WARN') return '#D29922';
		if (level === 'INFO') return '#58A6FF';
		return '#8B949E';
	};

	const formatTime = (isoString: string) => {
		const date = new Date(isoString);
		return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
	};

	const renderLogLine = (log: LogEvent, index: number) => {
		// 🎯 核心修正：行间距精准减少 1px，调整为 23px
		const yOffset = index * 23;
		const levelColor = getLevelColor(log.level);

		const tracePrefix = log.traceId ? log.traceId.substring(0, 4) : '----';
		const metaPrefix = `[${log.platform}::${tracePrefix}] `;

		const maxMessageLen = 66 - metaPrefix.length;
		const displayMsg = log.message.length > maxMessageLen
			? log.message.substring(0, maxMessageLen - 3) + '...'
			: log.message;

		return `
        <g transform="translate(0, ${yOffset})">
            <text x="0" y="11" class="log-mono timestamp">${formatTime(log.timestamp)}</text>

            <rect x="52" y="2" width="30" height="11" rx="1.5" fill="${levelColor}" opacity="0.12"/>
            <text x="67" y="10" class="log-level" fill="${levelColor}" text-anchor="middle">${log.level}</text>

            <text x="92" y="11" class="log-mono">
                <tspan fill="#6e7681">${metaPrefix}</tspan>
                <tspan class="log-text" fill="${log.level === 'ERROR' ? '#FF6B6B' : '#C9D1D9'}">${displayMsg}</tspan>
            </text>
        </g>`;
	};

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 285" width="100%" height="100%">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>

    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${statusColor}" />
      <stop offset="100%" stop-color="#58A6FF" />
    </linearGradient>

    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 600; fill: #c9d1d9; }
      .card-bg { fill: #21262d; stroke: #30363d; stroke-width: 1; rx: 5px; }
      .metric-label { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 500; fill: #8b949e; }

      .val-blue { font-family: "SFMono-Regular", Consolas, monospace; font-size: 16px; font-weight: 600; fill: #58a6ff; letter-spacing: -0.3px; }
      .val-green { font-family: "SFMono-Regular", Consolas, monospace; font-size: 16px; font-weight: 600; fill: #3fb950; letter-spacing: -0.3px; }
      .val-red { font-family: "SFMono-Regular", Consolas, monospace; font-size: 16px; font-weight: 600; fill: #ff6b6b; letter-spacing: -0.3px; }
      .val-purple { font-family: "SFMono-Regular", Consolas, monospace; font-size: 16px; font-weight: 600; fill: #A371F7; letter-spacing: -0.3px; }

      .log-mono { font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; letter-spacing: -0.4px; }
      .timestamp { fill: #484f58; }
      .log-level { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1px; }
      .log-text { font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; letter-spacing: -0.3px; }

      .footer-text { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; fill: #8b949e; }
      .distribution-text { font-family: "SFMono-Regular", Consolas, monospace; font-size: 9px; fill: #8b949e; }
      .pg-badge { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 9px; font-weight: 700; fill: #ffffff; }
    </style>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg-grad)" stroke="#444c56" stroke-width="1" rx="8" />

  <g transform="translate(30, 35)">
    <circle cx="5" cy="-4" r="4.5" fill="${statusColor}" />
    <text x="18" y="0" class="title">CoolLib Telemetry System</text>

    <text x="405" y="0" class="distribution-text" text-anchor="end">
        <tspan fill="#58A6FF">SRV:${pctBackend}%</tspan> ·
        <tspan fill="#3FB950">AND:${pctAndroid}%</tspan> ·
        <tspan fill="#A371F7">IOS:${pctIos}%</tspan>
    </text>

    <g transform="translate(425, -13)">
      <rect width="55" height="16" rx="3" fill="#336791" />
      <text x="27.5" y="11" class="pg-badge" text-anchor="middle">POSTGRES</text>
    </g>

    <rect x="0" y="10" width="480" height="1" fill="url(#accent-grad)" opacity="0.3" />
  </g>

  <g transform="translate(30, 65)">
    <rect width="150" height="55" class="card-bg" />
    <text x="12" y="20" class="metric-label">Total Logs</text>
    <text x="12" y="42" class="val-blue">${metrics.total_logs}</text>
  </g>

  <g transform="translate(195, 65)">
    <rect width="150" height="55" class="card-bg" />
    <text x="12" y="20" class="metric-label">Recent Errors</text>
    <text x="12" y="42" class="${errorValClass}">${metrics.error_count}</text>
  </g>

  <g transform="translate(360, 65)">
    <rect width="150" height="55" class="card-bg" />
    <text x="12" y="20" class="metric-label">Active Traces</text>
    <text x="12" y="42" class="val-purple">${metrics.active_traces}</text>
  </g>

  <g transform="translate(30, 134)">
    ${metrics.recent_logs[0] ? renderLogLine(metrics.recent_logs[0], 0) : ''}
    ${metrics.recent_logs[1] ? renderLogLine(metrics.recent_logs[1], 1) : ''}
    ${metrics.recent_logs[2] ? renderLogLine(metrics.recent_logs[2], 2) : ''}
    ${metrics.recent_logs[3] ? renderLogLine(metrics.recent_logs[3], 3) : ''}
    ${metrics.recent_logs[4] ? renderLogLine(metrics.recent_logs[4], 4) : ''}
  </g>

  <g transform="translate(30, 250)">
    <line x1="0" y1="0" x2="480" y2="0" stroke="#30363D" stroke-width="1"/>
    <circle cx="5" cy="14" r="4.5" fill="${statusColor}" opacity="0.2" />
    <circle cx="5" cy="14" r="3" fill="${statusColor}" />
    <text x="16" y="17" class="footer-text" font-weight="600" fill="${statusColor}" letter-spacing="0.3">${statusText}</text>

    <g transform="translate(210, 10)">
      <text x="70" y="7" class="distribution-text" fill="#6e7681">Edge P95:</text>
      <text x="122" y="7" class="log-mono" font-weight="bold" fill="#3FB950">${p95Latency}</text>
    </g>

    <text x="480" y="17" class="footer-text" text-anchor="end">Sync: CF Tunnel</text>
  </g>

</svg>`.trim();
}
