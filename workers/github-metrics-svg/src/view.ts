import { D1PushRow, TotalStats } from "./types";

export class MetricsView {
	private static getRelativePulseTime(dateStr: string | undefined): string {
		if (!dateStr) return "Active Sync";
		try {
			const formattedDate = dateStr.replace(' ', 'T') + 'Z';
			const eventTime = new Date(formattedDate).getTime();
			const now = Date.now();
			const diffMs = now - eventTime;

			const diffMins = Math.floor(diffMs / 60000);
			if (diffMins < 1) return "Just now";
			if (diffMins < 60) return `${diffMins}m ago`;

			const diffHours = Math.floor(diffMins / 60);
			if (diffHours < 24) return `${diffHours}h ago`;

			return `${Math.floor(diffHours / 24)}d ago`;
		} catch {
			return "Active Sync";
		}
	}

	static renderSvg(stats: TotalStats, pushRow: D1PushRow | null): string {
		const repoName = pushRow?.repository_name ?? "coollib-dashboards";
		const branchName = pushRow?.branch ?? "main";
		const mainLanguage = pushRow?.language ?? "TypeScript";
		const changedFiles = pushRow?.changed_count ?? 0;

		const lastUpdated = pushRow?.created_at ?? new Date().toISOString().replace('T', ' ').substring(0, 19);
		const pulseTime = this.getRelativePulseTime(pushRow?.created_at);

		const totalCommits = stats.commits;
		const totalPushes = stats.pushes;
		const totalRepos = stats.repos;
		const ciSuccess = stats.ciSuccess;

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 580" width="100%" height="100%">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>

    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#58a6ff" />
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
    <linearGradient id="spark-purple-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#bc8cff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#bc8cff" stop-opacity="0.0" />
    </linearGradient>

    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 600; fill: #c9d1d9; }
      .card-bg { fill: #21262d; stroke: #30363d; stroke-width: 1; rx: 6px; }
      .metric-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 500; fill: #8b949e; }

      /* Base Typography (No filters, raw colors for 100% GitHub compatibility) */
      .metric-value { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; fill: #58a6ff; }
      .metric-value-green { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; fill: #3fb950; }

      .metric-unit { font-size: 12px; font-weight: 400; fill: #8b949e; }
      .tag { font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; font-size: 12px; fill: #79c0ff; }
      .footer-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; fill: #8b949e; }
    </style>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg-grad)" rx="10" />

  <g transform="translate(30, 40)">
    <circle cx="10" cy="-6" r="6" fill="#58a6ff" />
    <text x="26" y="0" class="title">GitHub Activity</text>
    <rect x="0" y="12" width="740" height="1" fill="url(#accent-grad)" opacity="0.4" />
  </g>

  <g transform="translate(30, 80)">
    <rect width="360" height="75" class="card-bg" />
    <path d="M 180 65 Q 210 35, 240 50 T 300 40 T 340 30 L 340 70 L 180 70 Z" fill="url(#spark-blue-grad)" />
    <path d="M 180 65 Q 210 35, 240 50 T 300 40 T 340 30" fill="none" stroke="#58a6ff" stroke-width="4" stroke-linecap="round" opacity="0.25" />
    <path d="M 180 65 Q 210 35, 240 50 T 300 40 T 340 30" fill="none" stroke="#58a6ff" stroke-width="1.5" stroke-linecap="round" opacity="0.9" />
    <circle cx="340" cy="30" r="3" fill="#58a6ff" />

    <text x="20" y="30" class="metric-label">Deployment Frequency</text>
    <text x="20" y="58" class="metric-value">${totalPushes} <tspan class="metric-unit">total pushes</tspan></text>
  </g>

  <g transform="translate(410, 80)">
    <rect width="360" height="75" class="card-bg" />
    <path d="M 180 45 Q 210 42, 240 45 T 300 41 T 340 43 L 340 70 L 180 70 Z" fill="url(#spark-green-grad)" />
    <path d="M 180 45 Q 210 42, 240 45 T 300 41 T 340 43" fill="none" stroke="#3fb950" stroke-width="4" stroke-linecap="round" opacity="0.2" />
    <path d="M 180 45 Q 210 42, 240 45 T 300 41 T 340 43" fill="none" stroke="#3fb950" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
    <circle cx="340" cy="43" r="3" fill="#3fb950" />

    <text x="20" y="30" class="metric-label">Pipeline Success Rate</text>
    <text x="20" y="58" class="metric-value-green">${ciSuccess} <tspan class="metric-unit" fill="#8b949e">check suites</tspan></text>
  </g>

  <g transform="translate(30, 170)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Avg Build Time</text>
    <text x="20" y="58" class="metric-value">2m 45s <tspan class="metric-unit">gradle cache optimized</tspan></text>
  </g>

  <g transform="translate(410, 170)">
    <rect width="360" height="75" class="card-bg" />
    <path d="M 180 65 L 220 60 L 260 48 L 300 45 L 340 32 L 340 70 L 180 70 Z" fill="url(#spark-purple-grad)" />
    <path d="M 180 65 L 220 60 L 260 48 L 300 45 L 340 32" fill="none" stroke="#bc8cff" stroke-width="4" stroke-linecap="round" opacity="0.2" />
    <path d="M 180 65 L 220 60 L 260 48 L 300 45 L 340 32" fill="none" stroke="#bc8cff" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
    <circle cx="340" cy="32" r="3" fill="#bc8cff" />

    <text x="20" y="30" class="metric-label">Engineering Velocity</text>
    <text x="20" y="58" class="metric-value" fill="#bc8cff">${totalCommits} <tspan class="metric-unit">commits tracked</tspan></text>
  </g>

  <g transform="translate(30, 260)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Latest Repository</text>
    <text x="20" y="58" class="metric-value" font-size="16px">${repoName}</text>
  </g>

  <g transform="translate(410, 260)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Ecosystem Pulse</text>
    <text x="20" y="58" class="metric-value" fill="#79c0ff">${pulseTime} <tspan class="metric-unit" fill="#8b949e">since last check-in</tspan></text>
  </g>

  <g transform="translate(30, 350)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Target Branch</text>
    <text x="20" y="58" class="metric-value" fill="#79c0ff">${branchName}</text>
  </g>
  <g transform="translate(410, 350)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">File Changes</text>
    <text x="20" y="58" class="metric-value">${changedFiles} <tspan class="metric-unit">files modified</tspan></text>
  </g>

  <g transform="translate(30, 440)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Primary Stack</text>
    <text x="20" y="58" class="metric-value" fill="#3178c6">${mainLanguage}</text>
  </g>
  <g transform="translate(410, 440)">
    <rect width="360" height="75" class="card-bg" />
    <text x="20" y="30" class="metric-label">Global Ecosystem</text>
    <text x="20" y="58" class="metric-value">${totalRepos} <tspan class="metric-unit">active repos</tspan></text>
  </g>

  <g transform="translate(30, 545)">
    <circle cx="6" cy="-4" r="6" fill="#3fb950" opacity="0.25" />
    <circle cx="6" cy="-4" r="3.5" fill="#3fb950" />

    <text x="18" y="0" class="footer-text" font-weight="500">D1 Real-time Telemetry Active</text>
    <text x="740" y="0" class="footer-text" text-anchor="end">Last Event: ${lastUpdated} UTC</text>
  </g>

</svg>`;
	}
}
