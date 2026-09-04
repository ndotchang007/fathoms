function resolveSourceQuery(source, topicTitle) {
  if (source.query) return source.query;
  if (source.title) return source.title.replace(/\s+[—–-]\s+Overview$/i, '');
  return topicTitle || '';
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBulletsHtml(bullets) {
  const items = (bullets || [])
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('');
  return items
    ? `<ul class="source-bullets">${items}</ul>`
    : '<p class="source-article-fallback">No summary notes for this source.</p>';
}

function initResearch(state) {
  const topic = state.topic;
  const session = state.session;
  const researchTime = state.settings.researchTimer ?? topic.research_time ?? 300;
  const unlimited = researchTime === 0;
  let remaining = researchTime;
  let timerInterval = null;
  const startTime = Date.now();

  document.getElementById('research-topic-title').textContent = topic.title;
  const timerEl = document.getElementById('research-timer');
  if (unlimited) {
    timerEl.textContent = 'Unlimited';
    timerEl.classList.remove('urgent');
  } else {
    timerEl.textContent = formatTime(remaining);
  }

  const sourcesPanel = document.getElementById('research-sources-panel');
  const sourcesListPane = document.getElementById('research-sources-list');
  const viewer = document.getElementById('source-viewer');
  const viewerTitle = document.getElementById('source-viewer-title');
  const viewerSite = document.getElementById('source-viewer-site');
  const viewerStatus = document.getElementById('source-viewer-status');
  const viewerArticle = document.getElementById('source-viewer-article');
  const viewerBody = document.getElementById('source-viewer-body');

  function showList() {
    viewer.hidden = true;
    viewer.setAttribute('aria-hidden', 'true');
    sourcesListPane.hidden = false;
    sourcesPanel.classList.remove('is-reading');
    viewerArticle.innerHTML = '';
    viewerArticle.hidden = true;
    viewerStatus.hidden = true;
    viewerStatus.textContent = '';
  }

  function showReadingShell({ title, site }) {
    sourcesListPane.hidden = true;
    sourcesPanel.classList.add('is-reading');
    viewer.hidden = false;
    viewer.setAttribute('aria-hidden', 'false');
    viewerTitle.textContent = title || 'Source';
    viewerSite.textContent = site || 'Research notes';
    viewerSite.hidden = false;
    viewerBody.scrollTop = 0;
  }

  function openSourceViewer(source) {
    showReadingShell({ title: source.title, site: source.site });
    viewerStatus.hidden = true;
    viewerArticle.hidden = false;
    const url = source.url && source.url !== '#' ? source.url : '';
    const linkHtml = url
      ? `<p class="source-original-link"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View original source ↗</a></p>`
      : '';
    viewerArticle.innerHTML = `
      <div class="source-article-content">
        <p class="source-summary-lead">${escapeHtml(source.description || 'Research summary notes.')}</p>
        ${renderBulletsHtml(source.bullets)}
        ${linkHtml}
      </div>
      <footer class="source-article-attribution">
        <p>Paraphrased research notes for practice — not a verbatim reprint. Prefer the original ${escapeHtml(source.site || 'source')} page for citation.</p>
      </footer>
    `;
  }

  document.getElementById('source-viewer-back').onclick = showList;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !viewer.hidden) showList();
  });

  const sourcesEl = document.getElementById('sources-list');
  sourcesEl.innerHTML = (topic.sources || []).map((s, i) => `
    <article class="source-item">
      <h4>${escapeHtml(s.title)}</h4>
      <div class="source-site">${escapeHtml(s.site || 'Research notes')}</div>
      <p class="source-desc">${escapeHtml(s.description || '')}</p>
      <div class="source-actions">
        <button class="btn btn-secondary btn-sm open-source" data-index="${i}" type="button">Read</button>
      </div>
    </article>`).join('');

  sourcesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.open-source[data-index]');
    if (!btn) return;
    const source = topic.sources[Number(btn.dataset.index)];
    if (!source) return;
    openSourceViewer(source);
  });

  const notesEl = document.getElementById('notes');
  const notesKey = `fathoms-notes-${session.id}`;
  notesEl.value = localStorage.getItem(notesKey) || '';

  let saveTimeout;
  notesEl.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    document.getElementById('notes-status').textContent = 'Saving...';
    saveTimeout = setTimeout(() => {
      localStorage.setItem(notesKey, notesEl.value);
      document.getElementById('notes-status').textContent = 'Notes saved';
    }, 500);
  });

  const searchEl = document.getElementById('web-search');
  const searchResults = document.getElementById('search-results');
  let searchTimeout;
  let latestSearchResults = [];

  searchResults.addEventListener('click', (e) => {
    const btn = e.target.closest('.open-source[data-search-index]');
    if (!btn) return;
    const result = latestSearchResults[Number(btn.dataset.searchIndex)];
    if (!result?.source) return;
    openSourceViewer(result.source);
  });

  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = searchEl.value.trim().toLowerCase();
      if (!q) {
        searchResults.innerHTML = '';
        latestSearchResults = [];
        return;
      }
      const results = (topic.sources || [])
        .map((source, index) => ({ source, index }))
        .filter(({ source }) => {
          const hay = [
            source.title,
            source.site,
            source.description,
            ...(source.bullets || []),
          ].join(' ').toLowerCase();
          return hay.includes(q);
        })
        .slice(0, 6)
        .map(({ source, index }) => ({
          title: source.title,
          site: source.site,
          description: source.description,
          source,
          index,
        }));
      latestSearchResults = results;
      searchResults.innerHTML = results.length
        ? results.map((m, i) => `
        <article class="source-item source-item--search">
          <h4>${escapeHtml(m.title)}</h4>
          <div class="source-site">${escapeHtml(m.site || '')}</div>
          <div class="source-actions">
            <button class="btn btn-secondary btn-sm open-source" data-search-index="${i}" type="button">Read</button>
          </div>
        </article>
      `).join('')
        : '<p class="source-search-empty">No matching notes in this topic’s sources.</p>';
    }, 250);
  });

  function updateTimer() {
    remaining--;
    timerEl.textContent = `${formatTime(remaining)} remaining`;
    if (remaining <= 60) timerEl.classList.add('urgent');
    if (remaining <= 0) {
      clearInterval(timerInterval);
      finishResearch();
    }
  }

  if (!unlimited) {
    timerInterval = setInterval(updateTimer, 1000);
  }

  function finishResearch() {
    clearInterval(timerInterval);
    showList();
    state.researchDuration = Math.floor((Date.now() - startTime) / 1000);
    state.notesLength = notesEl.value.length;
    API.updateSession(session.id, {
      research_duration: state.researchDuration,
      notes_length: state.notesLength,
    }).catch(() => {});
    initSpeak(state);
    goToStep(3);
  }

  document.getElementById('ready-to-speak').onclick = finishResearch;
}
