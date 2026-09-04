const SKILLS = ['speaking', 'comprehension', 'depth', 'reasoning', 'organization', 'clarity', 'vocabulary'];
const REVIEW_DURATION_MS = 8000;
const REVIEW_BAR_STATES = {
  1: ['in-progress', 'empty', 'empty'],
  2: ['filled', 'in-progress', 'empty'],
  3: ['filled', 'filled', 'in-progress'],
};

let statsData = null;
let scoreChart = null;
let xpChart = null;
let activityChart = null;
let reviewStep = 1;
let reviewTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  try {
    statsData = await API.getStats(user.id);
    renderStatsPage(statsData);
    setupRangeToggle();
    setupReviewControls();
  } catch (err) {
    showToast('Failed to load stats');
    console.error(err);
  }
});

function renderStatsPage(data) {
  const records = data.records || {};
  const progress = data.progress || {};

  const overall = data.overallScore || 0;
  animateNumber(document.getElementById('overall-score'), overall);
  document.getElementById('overall-label').textContent = scoreLabel(overall);

  document.getElementById('stats-highlights').innerHTML = [
    ['Fathoms', records.totalFathoms || 0],
    ['Best score', records.highestScore || 0],
    ['Streak', progress.streak || records.longestStreak || 0],
    ['Best day XP', records.mostXpDay || 0],
  ].map(([label, value]) => `
    <div class="stats-highlight">
      <div class="stats-highlight-value">${value}</div>
      <div class="stats-highlight-label">${label}</div>
    </div>
  `).join('');

  const skills = data.skills || {};
  const skillValues = SKILLS.map((s) => skills[s] || 0);
  const ranked = SKILLS
    .map((s) => ({ skill: s, value: skills[s] || 0 }))
    .sort((a, b) => b.value - a.value);

  document.getElementById('skills-list').innerHTML = ranked.map((item) => `
    <div class="stats-skill-row">
      <div class="stats-skill-meta">
        <span>${capitalize(item.skill)}</span>
        <span>${item.value}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, item.value)}%"></div></div>
    </div>
  `).join('');

  createRadarChart(document.getElementById('skills-radar'), SKILLS, skillValues);
  createHorizontalBarChart(document.getElementById('skills-bar'), SKILLS, skillValues);
  renderCharts('sevenDays');

  const insights = data.insights || [];
  document.getElementById('insights-list').innerHTML = insights.length
    ? insights.map((text) => `<div class="insight-card">${text}</div>`).join('')
    : '<div class="insight-card">Complete a few Fathoms to unlock personalized insights.</div>';

  document.getElementById('records-grid').innerHTML = [
    ['Highest Score', records.highestScore || 0],
    ['Highest Depth', records.highestDepth || 0],
    ['Highest Speaking', records.highestSpeaking || 0],
    ['Longest Streak', records.longestStreak || 0],
    ['Most XP in One Day', records.mostXpDay || 0],
    ['Most Fathoms in One Day', records.mostFathomsDay || 0],
    ['Biggest Improvement', records.biggestImprovement || 0],
    ['Total Fathoms', records.totalFathoms || 0],
  ].map(([label, value]) => `
    <div class="record-item">
      <div class="record-value">${value}</div>
      <div class="record-label">${label}</div>
    </div>
  `).join('');
}

function renderCharts(range) {
  const series = (statsData.timeSeries && statsData.timeSeries[range]) || [];
  const labels = series.map((d) => formatChartDate(d.date));
  const scores = series.map((d) => (d.score == null ? null : d.score));
  const xp = series.map((d) => d.xp || 0);
  const counts = series.map((d) => d.count || 0);

  if (scoreChart) scoreChart.destroy();
  scoreChart = createLineChart(document.getElementById('score-chart'), labels, scores, 'Score');

  if (xpChart) xpChart.destroy();
  xpChart = createLineChart(document.getElementById('xp-chart'), labels, xp, 'XP');

  if (activityChart) activityChart.destroy();
  activityChart = createBarChart(document.getElementById('activity-chart'), labels, counts);
}

function setupRangeToggle() {
  document.querySelectorAll('.time-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCharts(btn.dataset.range);
    });
  });
}

function scoreLabel(score) {
  if (score >= 90) return 'Exceptional communication';
  if (score >= 80) return 'Strong communication';
  if (score >= 70) return 'Solid communication';
  if (score >= 60) return 'Developing communication';
  if (score > 0) return 'Early progress';
  return 'No scored Fathoms yet';
}

function setupReviewControls() {
  document.getElementById('start-stats-review').addEventListener('click', openReview);
  document.getElementById('review-prev').addEventListener('click', () => goReviewStep(reviewStep - 1));
  document.getElementById('review-next').addEventListener('click', () => goReviewStep(reviewStep + 1));
  document.getElementById('review-close-btn').addEventListener('click', closeReview);
  document.getElementById('review-copy-btn').addEventListener('click', copyShareText);
  document.getElementById('review-share-btn').addEventListener('click', shareSnapshot);

  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('stats-review');
    if (overlay.hidden) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      goReviewStep(reviewStep + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goReviewStep(reviewStep - 1);
    } else if (e.key === 'Escape') {
      closeReview();
    }
  });
}

function openReview() {
  if (!statsData) return;
  fillReviewContent(statsData);
  const overlay = document.getElementById('stats-review');
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('review-open');
  goReviewStep(1, true);
}

function closeReview() {
  stopReviewTimer();
  const overlay = document.getElementById('stats-review');
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('review-open');
}

function fillReviewContent(data) {
  const records = data.records || {};
  const skills = data.skills || {};
  const overall = data.overallScore || 0;

  document.getElementById('review-overall').textContent = overall;
  document.getElementById('review-overall-caption').textContent = scoreLabel(overall);

  document.getElementById('review-stat-grid').innerHTML = [
    ['Total Fathoms', records.totalFathoms || 0],
    ['Best score', records.highestScore || 0],
    ['Longest streak', records.longestStreak || 0],
    ['Biggest jump', records.biggestImprovement || 0],
  ].map(([label, value]) => `
    <div class="review-stat">
      <div class="review-stat-value">${value}</div>
      <div class="review-stat-label">${label}</div>
    </div>
  `).join('');

  const ranked = SKILLS
    .map((s) => ({ skill: s, value: skills[s] || 0 }))
    .sort((a, b) => a.value - b.value);
  const weakest = ranked.slice(0, 3);
  const strongest = [...ranked].sort((a, b) => b.value - a.value)[0];

  const tips = [];
  if (strongest && strongest.value > 0) {
    tips.push(`
      <div class="review-improve-item review-improve-strong">
        <div class="review-improve-head">
          <strong>Keep leaning on ${capitalize(strongest.skill)}</strong>
          <span>${strongest.value}</span>
        </div>
        <p>This is your strongest signal. Use it to carry weaker areas in your next explanation.</p>
      </div>
    `);
  }

  weakest.forEach((item) => {
    tips.push(`
      <div class="review-improve-item">
        <div class="review-improve-head">
          <strong>${capitalize(item.skill)}</strong>
          <span>${item.value}</span>
        </div>
        <p>${improvementTip(item.skill)}</p>
      </div>
    `);
  });

  document.getElementById('review-improve-list').innerHTML = tips.join('') || `
    <div class="review-improve-item"><p>Complete a Fathom to unlock improvement suggestions.</p></div>
  `;

  const shareText = buildShareText(data);
  const card = document.getElementById('review-share-card');
  card.dataset.shareText = shareText;
  card.innerHTML = `<p class="review-share-text">${shareText.replace(/\n/g, '<br>')}</p>`;
}

function improvementTip(skill) {
  const tips = {
    speaking: 'Practice finishing thoughts out loud without filler. Aim for one clean minute next session.',
    comprehension: 'During research, write one sentence that captures the core idea before you speak.',
    depth: 'Add one concrete example and one “why it matters” point in every explanation.',
    reasoning: 'State a claim, then support it with a cause → effect chain.',
    organization: 'Use a simple frame: definition → mechanism → implication.',
    clarity: 'Cut jargon. Prefer shorter sentences and define any technical term once.',
    vocabulary: 'Borrow two precise terms from your sources and use them deliberately.',
  };
  return tips[skill] || 'Focus on one skill at a time in your next Fathom.';
}

function buildShareText(data) {
  const records = data.records || {};
  const skills = data.skills || {};
  const topSkill = SKILLS
    .map((s) => ({ skill: s, value: skills[s] || 0 }))
    .sort((a, b) => b.value - a.value)[0];

  return [
    'My Fathoms snapshot',
    `Overall score: ${data.overallScore || 0}`,
    `Fathoms completed: ${records.totalFathoms || 0}`,
    `Best score: ${records.highestScore || 0}`,
    topSkill ? `Strongest skill: ${capitalize(topSkill.skill)} (${topSkill.value})` : null,
    `Streak: ${records.longestStreak || 0}`,
  ].filter(Boolean).join('\n');
}

function goReviewStep(step, force = false) {
  if (step < 1) return;
  if (step > 3) {
    closeReview();
    return;
  }
  if (!force && step === reviewStep) {
    restartReviewTimer();
    return;
  }

  reviewStep = step;

  document.querySelectorAll('.review-screen').forEach((screen) => {
    screen.classList.toggle('active', Number(screen.dataset.screen) === step);
  });

  const states = REVIEW_BAR_STATES[step];
  document.querySelectorAll('#review-tri-progress .tri-bar').forEach((bar, i) => {
    bar.className = `tri-bar ${states[i]}`;
  });
  document.getElementById('review-tri-progress').setAttribute('aria-valuenow', String(step));

  document.querySelectorAll('[data-review-step]').forEach((label) => {
    const s = Number(label.dataset.reviewStep);
    label.classList.toggle('active', s === step);
    label.classList.toggle('done', s < step);
  });

  restartReviewTimer();
}

function restartReviewTimer() {
  stopReviewTimer();
  const fill = document.getElementById('review-timer-fill');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth;
  fill.style.transition = `width ${REVIEW_DURATION_MS}ms linear`;
  fill.style.width = '100%';
  reviewTimer = setTimeout(() => goReviewStep(reviewStep + 1), REVIEW_DURATION_MS);
}

function stopReviewTimer() {
  clearTimeout(reviewTimer);
  reviewTimer = null;
}

async function copyShareText() {
  const text = document.getElementById('review-share-card').dataset.shareText || '';
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch {
    showToast('Could not copy');
  }
}

async function shareSnapshot() {
  const text = document.getElementById('review-share-card').dataset.shareText || '';
  if (navigator.share) {
    try {
      await navigator.share({ title: 'My Fathoms stats', text });
      return;
    } catch {
      /* user cancelled or share failed */
    }
  }
  copyShareText();
}
