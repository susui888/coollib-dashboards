// workers/business-dash/src/view.ts
import { StatsEntry } from "./types";

function renderCardHtml(label: string, value: string | number, chartId: string, subtitle = "", tooltip = ""): string {
	return `
    <div class="metric-card">
      <div class="metric-info">
        <div class="metric-label" data-tooltip="${tooltip}">${label}</div>
        <div class="metric-value">${value || 0}</div>
        ${subtitle ? `<div class="metric-subtitle">${subtitle}</div>` : ''}
      </div>
      <div class="metric-chart">
        <canvas id="${chartId}"></canvas>
      </div>
    </div>`;
}

export function renderDashboardHtml(sortedResults: StatsEntry[], range: string): string {
	const lastEntry = sortedResults[sortedResults.length - 1];

	const lastSyncTime = new Date(lastEntry.timestamp).toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const utilization = ((lastEntry.loans / lastEntry.books) * 100).toFixed(1) + "%";
	const mediaDensity = (lastEntry.review_images / lastEntry.reviews).toFixed(2);
	const engagement = (lastEntry.reviews / lastEntry.users).toFixed(2);

	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CoolLib Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --util-blue: #0071e3;
      --media-purple: #af52de;
      --social-green: #28a745;
      --base-brown: #8B4513;
      --apple-gray: #86868b;
      --apple-black: #1d1d1f;
    }
    html, body { margin: 0; background: #fcfcfd; font-family: -apple-system, sans-serif; overflow: hidden; -webkit-font-smoothing: antialiased; }
    .dashboard-wrapper { padding: 24px; }
    .dashboard { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .header-row { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 8px; }
    .button-group { background: #f1f1f2; padding: 4px; border-radius: 12px; display: flex; gap: 4px; border: 1px solid #e5e5e5; }
    .time-btn { border: none; background: transparent; padding: 6px 14px; border-radius: 9px; font-size: 12px; color: var(--apple-gray); cursor: pointer; font-weight: 600; transition: 0.2s; }
    .time-btn.active { background: white; color: var(--apple-black); box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
    .edge-badge { background: #f5f5f7; color: var(--apple-gray); padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
    .metric-card { background: white; border: 1px solid #e1e1e1; border-radius: 16px; display: flex; padding: 18px; min-height: 120px; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: border-color 0.25s, box-shadow 0.25s; cursor: default; position: relative; }
    .metric-card:hover { border-color: #d1d1d6; box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
    .metric-info { width: 35%; border-right: 1px solid #f5f5f7; padding-right: 20px; }
    .metric-label { font-size: 11px; color: var(--apple-gray); text-transform: uppercase; font-weight: 700; letter-spacing: 0.6px; position: relative; }
    .metric-value { font-size: 34px; font-weight: 700; color: var(--apple-black); letter-spacing: -1.2px; margin: 2px 0; }
    .metric-subtitle { font-size: 11px; color: #acacb1; line-height: 1.4; }
    .metric-chart { width: 65%; height: 110px; padding-left: 20px; }
    .metric-label[data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; bottom: 130%; left: 0; width: 220px; background: rgba(29, 29, 31, 0.95); color: white; padding: 10px 14px; border-radius: 10px; font-size: 11px; line-height: 1.4; font-weight: 400; text-transform: none; z-index: 100; box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
    .scale-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 600px) { .scale-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="dashboard-wrapper" id="content-height-anchor">
    <div class="dashboard">
      <div class="header-row">
        <div class="button-group">
          <button class="time-btn" data-range="24h">24 Hours</button>
          <button class="time-btn" data-range="7">7 Days</button>
          <button class="time-btn" data-range="30">30 Days</button>
        </div>
        <div style="text-align: right">
          <div style="font-size: 12px; font-weight: 600;" id="date-display">--</div>
          <div style="font-size: 10px; color: var(--apple-gray)">Last Sync: ${lastSyncTime}</div>
        </div>
      </div>

      <div class="edge-badge">Behavioral Intelligence</div>
      ${renderCardHtml('Inventory Utilization', utilization, 'chartUtil', 'Live circulation rate.', 'Formula: (Active Loans / Total Books).')}
      ${renderCardHtml('Media Enrichment', mediaDensity, 'chartMedia', 'Avg. R2 images per review.', 'Formula: (R2 Images / Total Reviews).')}
      ${renderCardHtml('Engagement Index', engagement, 'chartEngage', 'Interactions per user.', 'Formula: (Reviews / Users).')}

      <div class="edge-badge" style="margin-top: 8px">System Scale</div>
      <div class="scale-grid">
          ${renderCardHtml('Total Books', Math.floor(lastEntry.books), 'chartBooks', 'Cataloged items.', 'Primary DB row count.')}
          ${renderCardHtml('Total Users', Math.floor(lastEntry.users), 'chartUsers', 'Member base.', 'Registered user identities.')}
      </div>
    </div>
  </div>

  <script>
    const sendHeight = () => {
      const height = document.getElementById('content-height-anchor').offsetHeight;
      window.parent.postMessage({ type: 'setHeight', height: height }, '*');
    };
    const resizeObserver = new ResizeObserver(() => sendHeight());
    resizeObserver.observe(document.body);
    window.addEventListener('load', sendHeight);

    const history = ${JSON.stringify(sortedResults)};
    const currentRange = "${range}";
    const labels = history.map(r => {
      if (currentRange === '24h') return r.day;
      const [y, m, d] = r.day.split('-'); return d + '/' + m;
    });

    const createConfig = (data, labelName, color, isInteger = false, isPercent = false) => ({
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: labelName,
          data: data,
          borderColor: color,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.45,
          backgroundColor: color + '0D'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            displayColors: false,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            titleColor: '#86868b', bodyColor: '#1d1d1f',
            borderColor: '#e1e1e1', borderWidth: 1, padding: 12, cornerRadius: 10,
            callbacks: {
              label: (ctx) => {
                let val = ctx.parsed.y;
                let formatted = isInteger ? Math.floor(val) : val.toFixed(2);
                if (isPercent) formatted = val.toFixed(1) + '%';
                return labelName + ': ' + formatted;
              }
            }
          }
        },
        scales: {
          x: { display: true, grid: { display: false }, ticks: { maxTicksLimit: 6, font: {size: 10} } },
          y: { position: 'right', grid: { color: '#f2f2f7' }, ticks: { maxTicksLimit: 3, font: {size: 10} } }
        }
      }
    });

    new Chart(document.getElementById('chartUtil'), createConfig(history.map(r => (r.loans/r.books*100)), 'Utilization', '#0071e3', false, true));
    new Chart(document.getElementById('chartMedia'), createConfig(history.map(r => (r.review_images/r.reviews)), 'Media Index', '#af52de', false));
    new Chart(document.getElementById('chartEngage'), createConfig(history.map(r => (r.reviews/r.users)), 'Engagement', '#28a745', false));
    new Chart(document.getElementById('chartBooks'), createConfig(history.map(r => r.books), 'Books', '#8B4513', true));
    new Chart(document.getElementById('chartUsers'), createConfig(history.map(r => r.users), 'Users', '#8B4513', true));

    document.querySelectorAll('.time-btn').forEach(btn => {
      if (btn.dataset.range === currentRange) btn.classList.add('active');
      btn.addEventListener('click', () => { location.href = "?range=" + btn.dataset.range; });
    });

    if (labels.length > 0) document.getElementById('date-display').innerText = labels[0] + ' — ' + labels[labels.length - 1];
  </script>
</body>
</html>`;
}
