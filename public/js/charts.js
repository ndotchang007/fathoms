function getChartInk() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    ink: isLight ? 'rgba(17,17,17,0.88)' : 'rgba(244,244,245,0.88)',
    muted: isLight ? 'rgba(17,17,17,0.45)' : 'rgba(244,244,245,0.4)',
    fill: isLight ? 'rgba(17,17,17,0.04)' : 'rgba(244,244,245,0.04)',
    bar: isLight ? 'rgba(17,17,17,0.72)' : 'rgba(244,244,245,0.7)',
    barSoft: isLight ? 'rgba(17,17,17,0.14)' : 'rgba(244,244,245,0.14)',
    grid: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)',
    text: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#71717a',
  };
}

function getChartDefaults() {
  const reduced = document.documentElement.classList.contains('reduce-motion');
  const c = getChartInk();

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduced ? false : { duration: 420, easing: 'easeOutQuart' },
    layout: {
      padding: { top: 4, right: 4, bottom: 0, left: 0 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.ink,
        titleColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#fff' : '#090b0e',
        bodyColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#fff' : '#090b0e',
        titleFont: { size: 11, weight: '500' },
        bodyFont: { size: 12, weight: '600' },
        padding: 10,
        cornerRadius: 2,
        displayColors: false,
        caretSize: 0,
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: c.text,
          font: { size: 10, weight: '500' },
          maxRotation: 0,
          autoSkipPadding: 12,
        },
      },
      y: {
        border: { display: false },
        grid: {
          color: c.grid,
          drawTicks: false,
        },
        ticks: {
          color: c.text,
          font: { size: 10, weight: '500' },
          padding: 8,
        },
        beginAtZero: true,
      },
    },
  };
}

function createBarChart(canvas, labels, data) {
  const c = getChartInk();
  const defaults = getChartDefaults();
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: c.bar,
        borderWidth: 0,
        borderRadius: 0,
        barPercentage: 0.55,
        categoryPercentage: 0.7,
      }],
    },
    options: {
      ...defaults,
      scales: {
        ...defaults.scales,
        y: {
          ...defaults.scales.y,
          suggestedMax: Math.max(...data, 1) + 1,
          ticks: {
            ...defaults.scales.y.ticks,
            precision: 0,
          },
        },
      },
    },
  });
}

function createLineChart(canvas, labels, data, label = 'Score') {
  const c = getChartInk();
  const defaults = getChartDefaults();
  const isScore = label === 'Score';
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: c.ink,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHitRadius: 8,
        pointBackgroundColor: c.ink,
        pointBorderWidth: 0,
        spanGaps: true,
      }],
    },
    options: {
      ...defaults,
      scales: {
        ...defaults.scales,
        y: {
          ...defaults.scales.y,
          suggestedMin: 0,
          suggestedMax: isScore ? 100 : undefined,
        },
      },
    },
  });
}

function createRadarChart(canvas, labels, data) {
  const c = getChartInk();
  const reduced = document.documentElement.classList.contains('reduce-motion');
  return new Chart(canvas, {
    type: 'radar',
    data: {
      labels: labels.map(capitalize),
      datasets: [{
        data,
        borderColor: c.ink,
        backgroundColor: c.fill,
        borderWidth: 1.5,
        pointBackgroundColor: c.ink,
        pointBorderWidth: 0,
        pointRadius: 2,
        pointHoverRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduced ? false : { duration: 420, easing: 'easeOutQuart' },
      layout: { padding: 4 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.ink,
          titleColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#fff' : '#090b0e',
          bodyColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#fff' : '#090b0e',
          displayColors: false,
          cornerRadius: 2,
          caretSize: 0,
          padding: 10,
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false },
          border: { display: false },
          grid: { color: c.grid, circular: false },
          angleLines: { color: c.grid },
          pointLabels: {
            color: c.text,
            font: { size: 10, weight: '500' },
            padding: 6,
          },
        },
      },
    },
  });
}

function createHorizontalBarChart(canvas, labels, data) {
  const c = getChartInk();
  const defaults = getChartDefaults();
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels.map(capitalize),
      datasets: [{
        data,
        backgroundColor: c.bar,
        borderWidth: 0,
        borderRadius: 0,
        barPercentage: 0.5,
        categoryPercentage: 0.75,
      }],
    },
    options: {
      indexAxis: 'y',
      ...defaults,
      scales: {
        x: {
          ...defaults.scales.x,
          suggestedMax: 100,
          grid: {
            color: c.grid,
            drawTicks: false,
          },
          border: { display: false },
        },
        y: {
          ...defaults.scales.y,
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: c.text,
            font: { size: 10, weight: '500' },
            padding: 6,
          },
        },
      },
    },
  });
}

function formatChartDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
