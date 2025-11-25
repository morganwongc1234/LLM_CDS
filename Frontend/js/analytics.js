import { apiGet, initHeader, requireAuthGuard } from './common.js';

const $ = (sel) => document.querySelector(sel);

// Register the plugin globally if it loaded successfully
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

/**
 * Class to manage a single Analytics Widget (Chart + Table + Toggles)
 */
class AnalyticsWidget {
  constructor(containerId, title, data, keyField, valueField) {
    this.container = document.getElementById(containerId);
    this.title = title;
    this.data = data || [];
    this.keyField = keyField;
    this.valueField = valueField;
    this.chartInstance = null;
    this.currentView = 'bar'; // Default view

    // Professional Color Palette
    this.colors = [
      '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe',
      '#1e40af', '#1d4ed8', '#1e3a8a', '#172554', '#9ca3af'
    ];

    if(this.container) this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="widget-header">
        <h3>${this.title}</h3>
        <div class="view-controls">
          <button class="view-btn" data-view="table">Table</button>
          <button class="view-btn" data-view="pie">Pie</button>
          <button class="view-btn active" data-view="bar">Bar</button>
        </div>
      </div>
      <div class="chart-container">
        <canvas></canvas>
      </div>
      <div class="table-container" style="display: none;"></div>
    `;

    const buttons = this.container.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        buttons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.switchView(e.target.dataset.view);
      });
    });

    this.switchView(this.currentView);
  }

  switchView(viewType) {
    this.currentView = viewType;
    const chartContainer = this.container.querySelector('.chart-container');
    const tableContainer = this.container.querySelector('.table-container');

    if (viewType === 'table') {
      chartContainer.style.display = 'none';
      tableContainer.style.display = 'block';
      this.renderTable(tableContainer);
    } else {
      tableContainer.style.display = 'none';
      chartContainer.style.display = 'block';
      this.renderChart(viewType);
    }
  }

  renderTable(container) {
    if (container.innerHTML.trim() !== '') return;

    const displayKey = this.keyField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const total = this.data.reduce((sum, item) => sum + item[this.valueField], 0);

    const rows = this.data.map(item => {
      const val = item[this.valueField];
      const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0.0%';
      
      return `
      <tr>
        <td>${item[this.keyField] ?? 'N/A'}</td>
        <td>${val}</td>
        <td>${pct}</td>
      </tr>
    `}).join('');

    container.innerHTML = `
      <table class="table">
        <thead><tr><th>${displayKey}</th><th>Count</th><th>Percentage</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  renderChart(type) {
    const canvas = this.container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const labels = this.data.map(d => d[this.keyField] ?? 'N/A');
    const values = this.data.map(d => d[this.valueField]);

    const showDataLabels = (type === 'pie');

    this.chartInstance = new Chart(ctx, {
      type: type,
      data: {
        labels: labels,
        datasets: [{
          label: 'Count',
          data: values,
          backgroundColor: this.colors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                top: 30,
                bottom: 30, 
                left: 20,
                right: 20
            }
        },
        plugins: {
          legend: { 
            display: type === 'pie', 
            position: 'right' 
          },
          datalabels: {
            display: showDataLabels, 
            formatter: (value, ctx) => {
              let sum = 0;
              let dataArr = ctx.chart.data.datasets[0].data;
              dataArr.map(data => { sum += data; });
              let percentage = (value * 100 / sum).toFixed(1) + "%";
              return percentage;
            },
            color: (context) => {
               const value = context.dataset.data[context.dataIndex];
               const total = context.dataset.data.reduce((acc, curr) => acc + curr, 0);
               return (value / total < 0.05) ? '#333' : '#fff';
            },
            anchor: (context) => {
               const value = context.dataset.data[context.dataIndex];
               const total = context.dataset.data.reduce((acc, curr) => acc + curr, 0);
               return (value / total < 0.05) ? 'end' : 'center';
            },
            align: (context) => {
               const value = context.dataset.data[context.dataIndex];
               const total = context.dataset.data.reduce((acc, curr) => acc + curr, 0);
               return (value / total < 0.05) ? 'end' : 'center';
            },
            offset: 6,
            clamp: true,
            overlap: false
          }
        },
        scales: type === 'bar' ? {
          y: { 
              beginAtZero: true, 
              ticks: { stepSize: 1 } 
          },
          x: { 
              display: true,
              ticks: {
                  autoSkip: false,
                  maxRotation: 90, 
                  minRotation: 45 
              }
          } 
        } : {
          y: { display: false }, 
          x: { display: false }
        }
      }
    });
  }
}

// --- Main Init ---

async function getSafeResponseData(response) {
  try {
    return await response.json();
  } catch (e) {
    const text = await response.text();
    return { error: `Server error ${response.status}`, detail: text };
  }
}

async function initAnalyticsPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  try {
    const r = await apiGet('/api/admin/analytics');
    const data = await getSafeResponseData(r);

    if (!r.ok) {
      document.querySelector('.container').innerHTML = `<p class="error">Error: ${data.error}</p>`;
      return;
    }

    // 1. Render Scorecards
    ['scTotalUsers', 'scTotalPatients', 'scTotalEHR', 'scTotalReports'].forEach(id => {
      // ✨ FIX: Correctly map scTotalUsers -> totalUsers
      const key = id.replace('sc', ''); 
      
      const el = document.getElementById(id);
      
      // Generate default key (e.g., TotalUsers -> totalUsers)
      let dataKey = key.charAt(0).toLowerCase() + key.slice(1);
      
      // Manual override for EHR (scTotalEHR -> totalEHRSubmissions)
      if (id === 'scTotalEHR') dataKey = 'totalEHRSubmissions';
      
      if(el) el.textContent = data[dataKey] ?? 0;
    });

    // 2. Initialize Widgets
    new AnalyticsWidget('widgetUsersByRole', 'User Roles', data.usersByRole, 'role', 'count');
    new AnalyticsWidget('widgetAgeGroups', 'Patient Age', data.ageGroups, 'age_group', 'count');
    new AnalyticsWidget('widgetSexDistribution', 'Patient Sex', data.sexDistribution, 'sex', 'count');
    new AnalyticsWidget('widgetTopLocations', 'Top Locations', data.topLocations, 'state', 'count');

  } catch (err) {
    console.error('Analytics Init Error:', err);
  }
}

document.addEventListener('DOMContentLoaded', initAnalyticsPage);