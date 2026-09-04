/**
 * Guest practice on landing — full game flow, compact demo shell, 1-min speak timer.
 */

const GuestState = {
  topic: null,
  topicPool: [],
  shuffling: false,
  settings: { researchTimer: 300 },
  session: { id: 'guest' },
  speakTimerId: null,
  researchTimerId: null,
};

const GUEST_SPEAK_SECONDS = 60;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function prefersReducedMotion() {
  return document.documentElement.classList.contains('reduce-motion')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function goDemoStep(step) {
  document.querySelectorAll('.demo-step').forEach((el) => el.classList.remove('active'));
  document.getElementById(`demo-step-${step}`)?.classList.add('active');
}

function renderDemoTopic(topic) {
  document.getElementById('demo-badge').textContent = 'Your topic';
  document.getElementById('demo-topic-title').textContent = topic.title;
  document.getElementById('demo-topic-prompt').textContent = topic.prompt;
  document.getElementById('demo-cat').textContent = topic.category;
  document.getElementById('demo-diff').textContent = topic.difficulty;
  const researchMin = Math.floor((GuestState.settings.researchTimer || topic.research_time || 300) / 60);
  document.getElementById('demo-research-time').textContent = `Research: ${researchMin} min`;
  document.getElementById('demo-topic-actions').hidden = false;
  document.getElementById('demo-topic-meta').hidden = false;
}

async function ensureTopicPool() {
  if (GuestState.topicPool.length) return GuestState.topicPool;
  const { topics } = await API.getTopics();
  GuestState.topicPool = topics || [];
  return GuestState.topicPool;
}

async function runShuffle(finalTopic) {
  const card = document.getElementById('demo-topic-card');
  const titleEl = document.getElementById('demo-topic-title');
  const badgeEl = document.getElementById('demo-badge');
  document.getElementById('demo-topic-actions').hidden = true;
  document.getElementById('demo-topic-meta').hidden = true;
  badgeEl.textContent = 'Drawing topic…';
  document.getElementById('demo-topic-prompt').textContent = '';
  card.classList.add('shuffling');

  const pool = await ensureTopicPool();
  const candidates = pool.filter((t) => t.id !== finalTopic.id);
  const spins = prefersReducedMotion() ? 0 : Math.min(12, Math.max(6, candidates.length));

  if (!spins || !candidates.length) {
    renderDemoTopic(finalTopic);
    card.classList.remove('shuffling');
    window.SFX?.affirm();
    return;
  }

  for (let i = 0; i < spins; i++) {
    const t = candidates[Math.floor(Math.random() * candidates.length)];
    titleEl.textContent = t.title;
    window.SFX?.tick(i / Math.max(1, spins - 1));
    await sleep(45 + i * 30);
  }

  renderDemoTopic(finalTopic);
  card.classList.remove('shuffling');
  window.SFX?.affirm();
}

async function loadDemoTopic(excludeId) {
  if (GuestState.shuffling) return;
  GuestState.shuffling = true;
  try {
    await ensureTopicPool();
    const { topic } = await API.getRandomTopic(excludeId);
    GuestState.topic = topic;
    GuestState.session = { id: `guest-${topic.id}` };
    await runShuffle(topic);
  } catch (err) {
    document.getElementById('demo-badge').textContent = 'Could not load topic';
    console.error(err);
  } finally {
    GuestState.shuffling = false;
  }
}

function resolveSourceUrl(source, topicTitle) {
  if (source.url && source.url !== '#') return source.url;
  const q = encodeURIComponent(topicTitle || source.title || '');
  return `https://www.britannica.com/search?query=${q}`;
}

function renderGuestBullets(bullets) {
  if (!Array.isArray(bullets) || !bullets.length) return '';
  return `<ul class="demo-source-bullets">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
}

function initDemoResearch() {
  clearInterval(GuestState.researchTimerId);
  const topic = GuestState.topic;
  const researchTime = GuestState.settings.researchTimer || topic.research_time || 300;
  let remaining = researchTime;

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  document.getElementById('demo-research-title').textContent = topic.title;
  document.getElementById('demo-research-timer').textContent = formatTime(remaining);

  const sourcesEl = document.getElementById('demo-sources');
  sourcesEl.innerHTML = (topic.sources || []).map((s, i) => {
    const href = resolveSourceUrl(s, topic.title);
    return `
      <div class="demo-source">
        <h4>${escapeHtml(s.title)}</h4>
        <div class="site">${escapeHtml(s.site || '')}</div>
        <p>${escapeHtml(s.description || '')}</p>
        <button type="button" class="btn btn-ghost demo-source-toggle" data-demo-source="${i}" aria-expanded="false">Show notes</button>
        <div class="demo-source-notes" id="demo-source-notes-${i}" hidden>
          ${renderGuestBullets(s.bullets)}
          <a class="btn btn-ghost" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Original source ↗</a>
        </div>
      </div>`;
  }).join('') || '<p class="demo-empty">No sources bundled for this topic.</p>';

  sourcesEl.onclick = (e) => {
    const btn = e.target.closest('.demo-source-toggle[data-demo-source]');
    if (!btn) return;
    const idx = btn.dataset.demoSource;
    const panel = document.getElementById(`demo-source-notes-${idx}`);
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Hide notes' : 'Show notes';
  };

  const notesEl = document.getElementById('demo-notes');
  const notesKey = `fathoms-notes-${GuestState.session.id}`;
  notesEl.value = localStorage.getItem(notesKey) || '';
  notesEl.oninput = () => {
    localStorage.setItem(notesKey, notesEl.value);
    document.getElementById('demo-notes-status').textContent = 'Notes saved';
  };

  const searchEl = document.getElementById('demo-web-search');
  const searchResults = document.getElementById('demo-search-results');
  let searchTimeout;
  searchEl.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = searchEl.value.trim().toLowerCase();
      if (!q) { searchResults.innerHTML = ''; return; }
      const hits = (topic.sources || []).filter((s) => {
        const hay = [s.title, s.site, s.description, ...(s.bullets || [])].join(' ').toLowerCase();
        return hay.includes(q);
      }).slice(0, 5);
      searchResults.innerHTML = hits.length
        ? hits.map((m) => `
        <a class="demo-search-hit" href="${escapeHtml(resolveSourceUrl(m, topic.title))}" target="_blank" rel="noopener noreferrer">
          <span>${escapeHtml(m.title)}</span>
          <small>${escapeHtml(m.site || '')}</small>
        </a>
      `).join('')
        : '<p class="demo-empty">No matching notes in these sources.</p>';
    }, 250);
  };

  function finishResearch() {
    clearInterval(GuestState.researchTimerId);
    GuestState.researchTimerId = null;
    initDemoSpeak();
    goDemoStep(3);
  }

  function tickResearch() {
    remaining--;
    const timerEl = document.getElementById('demo-research-timer');
    timerEl.textContent = `${formatTime(remaining)} remaining`;
    if (remaining <= 60) timerEl.classList.add('urgent');
    if (remaining <= 0) finishResearch();
  }

  GuestState.researchTimerId = setInterval(tickResearch, 1000);
  document.getElementById('demo-ready-speak').onclick = finishResearch;
}

function initDemoSpeak() {
  clearInterval(GuestState.speakTimerId);
  let remaining = GUEST_SPEAK_SECONDS;
  const timerEl = document.getElementById('demo-timer');
  const statusEl = document.getElementById('demo-speak-status');
  const startBtn = document.getElementById('demo-speak-start');
  const doneBtn = document.getElementById('demo-speak-done');

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  timerEl.textContent = formatTime(remaining);
  timerEl.classList.remove('urgent');
  statusEl.textContent = 'One minute on the clock. Talk it out.';
  startBtn.hidden = false;
  doneBtn.hidden = true;

  function finishSpeak() {
    clearInterval(GuestState.speakTimerId);
    GuestState.speakTimerId = null;
    startBtn.hidden = true;
    doneBtn.hidden = true;
    goDemoStep(4);
  }

  startBtn.onclick = () => {
    startBtn.hidden = true;
    doneBtn.hidden = false;
    statusEl.textContent = 'Go — explain your topic out loud.';
    window.SFX?.record();
    GuestState.speakTimerId = setInterval(() => {
      remaining--;
      timerEl.textContent = formatTime(remaining);
      if (remaining <= 10) timerEl.classList.add('urgent');
      if (remaining <= 0) finishSpeak();
    }, 1000);
  };

  doneBtn.onclick = finishSpeak;
}

function bindGuestControls() {
  document.getElementById('demo-start-research').addEventListener('click', () => {
    initDemoResearch();
    goDemoStep(2);
  });

  document.getElementById('demo-skip-research').addEventListener('click', () => {
    clearInterval(GuestState.researchTimerId);
    initDemoSpeak();
    goDemoStep(3);
  });

  document.getElementById('demo-another').addEventListener('click', () => {
    loadDemoTopic(GuestState.topic?.id);
    goDemoStep(1);
  });

  document.getElementById('demo-play-again').addEventListener('click', () => {
    document.getElementById('demo-speak-start').hidden = false;
    document.getElementById('demo-speak-done').hidden = true;
    loadDemoTopic(GuestState.topic?.id);
    goDemoStep(1);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindGuestControls();
  goDemoStep(1);
  await loadDemoTopic();
});
