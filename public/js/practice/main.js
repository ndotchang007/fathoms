const PracticeState = {
  user: null,
  topic: null,
  session: null,
  attemptNumber: 1,
  researchDuration: 0,
  speakingDuration: 0,
  notesLength: 0,
  topicPool: [],
  categories: [],
  selectedCategory: localStorage.getItem('fathoms-topic-category') || 'general',
  shuffling: false,
  settings: { researchTimer: 300, speakingTimer: 60 },
  todayGoal: 'Improve clarity and reduce the speed of speech.',
};

const FOCUS_GOALS = {
  speaking: 'Improve delivery confidence and pace your speech.',
  comprehension: 'Address every part of the prompt directly.',
  depth: 'Support your claims with specific evidence and examples.',
  reasoning: 'Connect causes to their effects more explicitly.',
  clarity: 'Improve clarity and reduce the speed of speech.',
  organization: 'Outline three key points before you start speaking.',
  vocabulary: 'Replace vague words with more precise terminology.',
};

const DEFAULT_TODAY_GOAL = 'Improve clarity and reduce the speed of speech.';

const TRI_BAR_STATES = {
  1: ['in-progress', 'empty', 'empty', 'empty'],
  2: ['filled', 'in-progress', 'empty', 'empty'],
  3: ['filled', 'filled', 'in-progress', 'empty'],
  4: ['filled', 'filled', 'filled', 'in-progress'],
};

const CATEGORY_LABELS = {
  all: 'All',
  shuffle: 'Shuffle',
};

function updateTriBarProgress(step) {
  const states = TRI_BAR_STATES[step] || TRI_BAR_STATES[1];
  document.querySelectorAll('.tri-bar').forEach((bar, i) => {
    bar.className = `tri-bar ${states[i]}`;
  });

  const progress = document.querySelector('.tri-progress');
  if (progress) progress.setAttribute('aria-valuenow', step);

  document.querySelectorAll('.tri-label').forEach((label) => {
    const s = parseInt(label.dataset.step, 10);
    label.classList.toggle('active', s === step);
    label.classList.toggle('done', s < step);
  });
}

function goToStep(step) {
  document.querySelectorAll('.practice-step').forEach((el) => el.classList.remove('active'));
  document.getElementById(`step-${['prompt', 'research', 'speak', 'results'][step - 1]}`).classList.add('active');
  updateTriBarProgress(step);
  updateGoalBanner(step);
}

function updateGoalBanner(step) {
  const banner = document.getElementById('practice-goal-banner');
  if (!banner) return;
  banner.hidden = step > 3;
  const textEl = document.getElementById('practice-goal-text');
  if (textEl && PracticeState.todayGoal) {
    textEl.textContent = PracticeState.todayGoal;
  }
}

async function loadTodayGoal() {
  const focusArea = PracticeState.settings?.focusArea;
  let goal = (focusArea && FOCUS_GOALS[focusArea]) || DEFAULT_TODAY_GOAL;

  try {
    const data = await API.getDashboard(PracticeState.user.id);
    const skill = data?.focus?.skill;
    if (skill && FOCUS_GOALS[skill]) {
      goal = FOCUS_GOALS[skill];
    } else if (data?.focus?.recommendation && skill) {
      goal = data.focus.recommendation;
    }
  } catch {
    // Keep focusArea / default goal if dashboard is unavailable.
  }

  PracticeState.todayGoal = goal;
  updateGoalBanner(1);
}

function setTopicActionsEnabled(enabled) {
  document.getElementById('topic-actions').hidden = !enabled;
  document.getElementById('topic-meta').hidden = !enabled;
  document.getElementById('start-research').disabled = !enabled;
  document.getElementById('another-topic').disabled = !enabled;
  document.getElementById('category-select').disabled = !enabled;
}

function formatCategoryLabel(categoryId) {
  return CATEGORY_LABELS[categoryId] || categoryId;
}

function renderTopic(topic) {
  document.getElementById('topic-badge').textContent = formatCategoryLabel(topic.category);
  document.getElementById('topic-title').textContent = topic.title;
  document.getElementById('topic-prompt').textContent = topic.prompt;
  document.getElementById('topic-category').textContent = formatCategoryLabel(topic.category);
  document.getElementById('topic-difficulty').textContent = topic.difficulty;
  const researchSecs = PracticeState.settings.researchTimer ?? topic.research_time ?? 300;
  const researchLabel = researchSecs === 0
    ? 'Unlimited'
    : `Research: ${Math.max(1, Math.round(researchSecs / 60))} min`;
  document.getElementById('topic-research-time').textContent = researchLabel;
  setTopicActionsEnabled(true);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function prefersReducedMotion() {
  return document.documentElement.classList.contains('reduce-motion')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function ensureCategories() {
  if (PracticeState.categories.length) return PracticeState.categories;
  const { categories } = await API.getTopicCategories();
  PracticeState.categories = categories || [];
  PracticeState.categories.forEach((c) => {
    CATEGORY_LABELS[c.id] = c.label;
  });
  const valid = ['all', 'shuffle', ...PracticeState.categories.map((c) => c.id)];
  if (!valid.includes(PracticeState.selectedCategory)) {
    PracticeState.selectedCategory = 'general';
  }
  return PracticeState.categories;
}

function renderCategorySelect() {
  const select = document.getElementById('category-select');
  if (!select || !PracticeState.categories.length) return;

  select.innerHTML = `
    <option value="all">All</option>
    <option value="shuffle">Shuffle</option>
    <optgroup label="Categories">
      ${PracticeState.categories.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
    </optgroup>
  `;
  select.value = PracticeState.selectedCategory;
}

async function ensureTopicPool() {
  if (PracticeState.topicPool.length) return PracticeState.topicPool;
  const { topics } = await API.getTopics();
  PracticeState.topicPool = topics || [];
  return PracticeState.topicPool;
}

function getCategoryPool() {
  if (PracticeState.selectedCategory === 'all' || PracticeState.selectedCategory === 'shuffle') {
    return PracticeState.topicPool;
  }
  return PracticeState.topicPool.filter((t) => t.category === PracticeState.selectedCategory);
}

function resolveCategoryFilter() {
  if (PracticeState.selectedCategory === 'all') return null;
  if (PracticeState.selectedCategory === 'shuffle') {
    const cats = PracticeState.categories;
    if (!cats.length) return null;
    return cats[Math.floor(Math.random() * cats.length)].id;
  }
  return PracticeState.selectedCategory;
}

async function selectCategory(categoryId) {
  if (categoryId === PracticeState.selectedCategory) return;
  PracticeState.selectedCategory = categoryId;
  localStorage.setItem('fathoms-topic-category', categoryId);
  const select = document.getElementById('category-select');
  if (select) select.value = categoryId;
  await loadTopic();
}

async function runTopicShuffle(finalTopic) {
  const card = document.getElementById('topic-card');
  const titleEl = document.getElementById('topic-title');
  const promptEl = document.getElementById('topic-prompt');
  const badgeEl = document.getElementById('topic-badge');
  const reelEl = document.getElementById('topic-reel');

  setTopicActionsEnabled(false);
  badgeEl.textContent = 'Shuffling…';
  promptEl.textContent = '';
  document.getElementById('topic-meta').hidden = true;
  card.classList.add('shuffling');

  await ensureTopicPool();
  const candidates = getCategoryPool().filter((t) => t.id !== finalTopic.id);
  const spins = prefersReducedMotion() ? 0 : Math.min(14, Math.max(8, candidates.length));

  if (spins === 0 || !candidates.length) {
    renderTopic(finalTopic);
    card.classList.remove('shuffling');
    card.classList.add('topic-landed');
    window.SFX?.affirm();
    setTimeout(() => card.classList.remove('topic-landed'), 700);
    return;
  }

  reelEl.innerHTML = '';
  for (let i = 0; i < spins; i++) {
    const t = candidates[Math.floor(Math.random() * candidates.length)];
    const delay = 40 + i * 28 + Math.floor(i * i * 1.8);
    titleEl.textContent = t.title;
    titleEl.classList.remove('topic-flash');
    void titleEl.offsetWidth;
    titleEl.classList.add('topic-flash');
    reelEl.textContent = formatCategoryLabel(t.category);
    window.SFX?.tick(i / Math.max(1, spins - 1));
    await sleep(delay);
  }

  titleEl.classList.remove('topic-flash');
  await sleep(120);
  renderTopic(finalTopic);
  card.classList.remove('shuffling');
  card.classList.add('topic-landed');
  window.SFX?.affirm();
  setTimeout(() => card.classList.remove('topic-landed'), 700);
}

async function loadTopic(excludeId) {
  if (PracticeState.shuffling) return null;
  PracticeState.shuffling = true;
  try {
    await ensureCategories();
    await ensureTopicPool();
    const categoryFilter = resolveCategoryFilter();
    const { topic } = await API.getRandomTopic(excludeId, categoryFilter);
    if (!topic) {
      showToast('No topics in this category yet.');
      return null;
    }
    PracticeState.topic = topic;
    PracticeState.attemptNumber = 1;
    await runTopicShuffle(topic);
    return topic;
  } finally {
    PracticeState.shuffling = false;
  }
}

async function startSession() {
  const { session, topic } = await API.createSession(PracticeState.topic.id, PracticeState.attemptNumber);
  PracticeState.session = session;
  PracticeState.topic = topic;
  return session;
}

document.addEventListener('DOMContentLoaded', async () => {
  PracticeState.user = await requireAuth();
  if (!PracticeState.user) return;

  if (PracticeState.user.settings) {
    PracticeState.settings = { ...PracticeState.settings, ...PracticeState.user.settings };
  }

  const footer = document.querySelector('.sidebar-footer');
  if (footer) footer.textContent = PracticeState.user.username;

  await ensureCategories();
  renderCategorySelect();
  loadTodayGoal();

  document.getElementById('category-select').addEventListener('change', (e) => {
    selectCategory(e.target.value);
  });

  const params = new URLSearchParams(window.location.search);
  const retryTopicId = params.get('retry');
  const attempt = parseInt(params.get('attempt') || '1', 10);

  if (retryTopicId) {
    const { topic } = await API.getTopic(retryTopicId);
    PracticeState.topic = topic;
    PracticeState.attemptNumber = attempt;
    if (topic.category) {
      PracticeState.selectedCategory = topic.category;
      localStorage.setItem('fathoms-topic-category', topic.category);
      renderCategorySelect();
    }
    renderTopic(topic);
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `Attempt ${attempt}`;
    badge.style.marginBottom = '1rem';
    badge.style.display = 'inline-block';
    document.getElementById('topic-card').insertBefore(badge, document.getElementById('topic-shuffle-stage'));
  } else {
    await loadTopic();
  }

  document.getElementById('start-research').addEventListener('click', async () => {
    await startSession();
    initResearch(PracticeState);
    goToStep(2);
  });

  document.getElementById('another-topic').addEventListener('click', () => {
    loadTopic(PracticeState.topic?.id);
  });

  updateTriBarProgress(1);
  updateGoalBanner(1);
});

window.PracticeState = PracticeState;
window.goToStep = goToStep;
window.loadTopic = loadTopic;
window.startSession = startSession;
