import { MetricQueryResult } from "./types";

function renderCardHtml(label: string, value: number | string | null, chartId: string, unit: string = ""): string {
	return `
    <div class="metric-card">
      <div class="metric-header">
        <div class="metric-label">${label}</div>
        <div class="metric-value-row">
          <span class="metric-value">${value ?? 0}</span>
          <span class="unit">${unit}</span>
        </div>
      </div>
      <div class="metric-chart-container">
        <canvas id="${chartId}"></canvas>
      </div>
    </div>`;
}

export function renderDashboardHtml(results: MetricQueryResult[], range: string): string {
	const last = results[results.length - 1] || {};

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CoolLib Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #fcfcfd;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
    }
    .dashboard { padding: 15px; box-sizing: border-box; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .metrics-row { display: flex; gap: 10px; width: 100%; }
    .metric-card {
      background: white; border: 1px solid #e5e5e7; border-radius: 12px;
      flex: 1; min-width: 0; padding: 12px 8px; display: flex; flex-direction: column;
    }
    .metric-header { margin-bottom: 6px; padding-left: 4px; }
    .metric-label { font-size: 10px; color: #86868b; font-weight: 600; text-transform: uppercase; }
    .metric-value-row { display: flex; align-items: baseline; gap: 2px; }
    .metric-value { font-size: 20px; font-weight: 700; color: #1d1d1f; }
    .unit { font-size: 11px; color: #86868b; }
    .metric-chart-container { position: relative; height: 85px; width: 100%; }
    .button-group { background: #f1f1f2; padding: 2px; border-radius: 6px; display: flex; }
    .time-btn { border: none; background: transparent; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; color: #6e6e73; transition: all 0.2s; }
    .time-btn.active { background: white; color: #1d1d1f; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

    @media (max-width: 650px) {
      .metrics-row { flex-wrap: wrap; }
      .metric-card { flex: 1 1 calc(50% - 10px); }
    }
    @media (max-width: 480px) {
      .metric-card { flex: 1 1 100%; }
    }
  </style>
</head>
<body>
  <div class="dashboard" id="dashboard-content">
    <div class="header-row">
      <div class="button-group">
        <button class="time-btn" data-range="24h">24 Hours</button>
        <button class="time-btn" data-range="7">7 Days</button>
        <button class="time-btn" data-range="30">30 Days</button>
      </div>
    </div>
    <div class="metrics-row">
      ${renderCardHtml('Uptime', last.uptime, 'chartUptime', 'H')}
      ${renderCardHtml('CPU', last.cpu, 'chartCpu', '%')}
      ${renderCardHtml('Heap', last.memory, 'chartMem', 'MB')}
      ${renderCardHtml('Secured Requests', last.requests, 'chartReq', 'V')}
      ${renderCardHtml('DB Pool', last.db_conn, 'chartDb', 'A')}
    </div>
  </div>

  <script>
    const historyData = ${JSON.stringify(results)};

    const setupChart = (id, key, color, unit) => {
      const el = document.getElementById(id);
      if (!el) return;
      new Chart(el, {
        type: 'line',
        data: {
          labels: historyData.map(r => r.time_label),
          datasets: [{
            label: key,
            data: historyData.map(r => r[key]),
            borderColor: color,
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color,
            fill: true,
            backgroundColor: color + '15',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              titleColor: '#1d1d1f',
              bodyColor: '#1d1d1f',
              borderColor: '#e5e5e7',
              borderWidth: 1,
              padding: 8,
              cornerRadius: 6,
              titleFont: { size: 10, weight: 'bold' },
              bodyFont: { size: 11 },
              displayColors: false,
              callbacks: {
                label: (ctx) => ctx.parsed.y + ' ' + unit
              }
            }
          },
          scales: {
            x: {
              display: true,
              grid: { display: false },
              ticks: { font: { size: 8 }, maxTicksLimit: 3, color: '#c1c1c6' }
            },
            y: {
              display: true,
              position: 'right',
              grid: { color: '#f5f5f5', drawTicks: false },
              ticks: { font: { size: 8 }, maxTicksLimit: 3, color: '#c1c1c6' }
            }
          }
        }
      });
    };

    // 经典的企鹅书香棕色调 (#8B4513)
    setupChart('chartUptime', 'uptime', '#8B4513', 'HRS');
    setupChart('chartCpu', 'cpu', '#8B4513', '%');
    setupChart('chartMem', 'memory', '#8B4513', 'MB');
    setupChart('chartReq', 'requests', '#8B4513', 'HITS');
    setupChart('chartDb', 'db_conn', '#8B4513', 'ACT');

    document.querySelectorAll('.time-btn').forEach(btn => {
      if(btn.dataset.range === "${range}") btn.classList.add('active');
      btn.onclick = () => location.href = "?range=" + btn.dataset.range;
    });

    function sendHeight() {
      const height = document.getElementById('dashboard-content').offsetHeight;
      window.parent.postMessage({ type: 'setHeight', height: height }, '*');
    }

    window.addEventListener('load', sendHeight);

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        sendHeight();
      });
      ro.observe(document.body);
    } else {
      window.addEventListener('resize', sendHeight);
    }

    setTimeout(sendHeight, 500);
  </script>
</body>
</html>`;
}
