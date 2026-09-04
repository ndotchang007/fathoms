/**
 * Landing — Game / Explore view toggle + descent scroll on explore page.
 */

const DEPTH_ZONES = [
  { max: 0.25, label: 'Surface' },
  { max: 0.5, label: 'Twilight' },
  { max: 0.75, label: 'Midnight' },
  { max: 1, label: 'Abyss' },
];

const FADE_MS = 360;

let currentView = 'game';
let descentZone = null;
let panels = [];
let exploreScrollEl = null;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function prefersReducedMotion() {
  return document.documentElement.classList.contains('reduce-motion')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setView(view) {
  if (view === currentView) return;

  const gameView = document.getElementById('game-view');
  const exploreView = document.getElementById('explore-view');
  const duration = prefersReducedMotion() ? 0 : FADE_MS;

  if (view === 'explore') {
    gameView?.classList.remove('active');
    exploreView?.classList.add('active');
    gameView?.setAttribute('aria-hidden', 'true');
    exploreView?.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('view-game');
    document.body.classList.add('view-explore');
    window.scrollTo(0, 0);
    currentView = 'explore';
  } else {
    exploreView?.classList.remove('active');
    gameView?.classList.add('active');
    exploreView?.setAttribute('aria-hidden', 'true');
    gameView?.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('view-explore');
    document.body.classList.add('view-game');
    window.scrollTo(0, 0);
    currentView = 'game';
  }

  if (duration > 0) {
    document.body.classList.add('view-transitioning');
    window.setTimeout(() => {
      document.body.classList.remove('view-transitioning');
      if (currentView === 'explore') onScroll();
    }, duration);
  } else if (currentView === 'explore') {
    onScroll();
  }
}

function showExplore() {
  setView('explore');
}

function showGame() {
  setView('game');
}

function getDepthProgress() {
  if (!descentZone || currentView !== 'explore') return 0;
  const rect = descentZone.getBoundingClientRect();
  const zoneTop = window.scrollY + rect.top;
  const total = descentZone.offsetHeight - window.innerHeight;
  if (total <= 0) return 0;
  return clamp((window.scrollY - zoneTop) / total, 0, 1);
}

function panelOpacity(progress, index, count) {
  const slice = 1 / count;
  const start = index * slice;
  const end = (index + 1) * slice;
  const fade = slice * 0.35;
  const enterStart = start - fade * 0.5;
  const exitEnd = end + fade * 0.5;

  if (progress < enterStart || progress > exitEnd) return 0;
  if (progress < start + fade) {
    return (progress - enterStart) / (start + fade - enterStart);
  }
  if (progress > end - fade) {
    return (exitEnd - progress) / (exitEnd - (end - fade));
  }
  return 1;
}

function updateDescent(progress) {
  if (currentView !== 'explore') return;

  panels.forEach((panel, i) => {
    const op = panelOpacity(progress, i, panels.length);
    panel.style.opacity = String(op);
    panel.style.visibility = op > 0.02 ? 'visible' : 'hidden';
    panel.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
  });

  if (descentZone) {
    descentZone.style.setProperty('--depth', progress);
  }

  const depthValue = document.getElementById('depth-value');
  const zoneLabel = document.getElementById('zone-label');
  const railFill = document.getElementById('depth-rail-fill');
  const railMarker = document.getElementById('depth-rail-marker');
  const anchorHud = document.getElementById('anchor-hud');

  if (depthValue) depthValue.textContent = Math.round(progress * 6000).toLocaleString();
  if (zoneLabel) {
    const zone = DEPTH_ZONES.find((z) => progress <= z.max) || DEPTH_ZONES[DEPTH_ZONES.length - 1];
    zoneLabel.textContent = zone.label;
  }
  const pct = `${progress * 100}%`;
  if (railFill) railFill.style.height = pct;
  if (railMarker) railMarker.style.top = pct;
  if (anchorHud) anchorHud.style.setProperty('--anchor-drop', pct);
}

function onScroll() {
  if (currentView !== 'explore') return;
  updateDescent(getDepthProgress());
}

function bindNav() {
  document.getElementById('btn-explore')?.addEventListener('click', showExplore);
  document.getElementById('btn-game')?.addEventListener('click', showGame);

  document.querySelectorAll('[data-show-game]').forEach((el) => {
    el.addEventListener('click', showGame);
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  descentZone = document.getElementById('descent-zone');
  exploreScrollEl = document.getElementById('explore-view');
  panels = [...document.querySelectorAll('.app-panel')];

  document.body.classList.add('view-game');
  bindNav();

  if (sessionStorage.getItem('fathoms-open-explore') === '1') {
    sessionStorage.removeItem('fathoms-open-explore');
    showExplore();
  }
});
