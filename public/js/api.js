const API = {
  async request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include',
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  loginDemo() {
    return this.request('/auth/demo', { method: 'POST' });
  },

  register({ username, password, focusArea }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, focusArea }),
    });
  },

  login({ username, password }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  getMe() {
    return this.request('/auth/me');
  },

  getTopics(category) {
    const q = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request(`/topics${q}`);
  },

  getTopicCategories() {
    return this.request('/topics/categories');
  },

  getDashboard(userId) {
    return this.request(`/dashboard/${userId}`);
  },

  getRandomTopic(exclude, category) {
    const params = new URLSearchParams();
    if (exclude) params.set('exclude', exclude);
    if (category) params.set('category', category);
    const q = params.toString() ? `?${params}` : '';
    return this.request(`/topics/random${q}`);
  },

  getTopic(id) {
    return this.request(`/topics/${id}`);
  },

  getSourceArticle(query, context) {
    const params = new URLSearchParams({ q: query });
    if (context) params.set('context', context);
    return this.request(`/sources/article?${params}`);
  },

  createSession(topicId, attemptNumber = 1) {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId, attempt_number: attemptNumber }),
    });
  },

  updateSession(id, data) {
    return this.request(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  evaluateSession(id, data) {
    return this.request(`/sessions/${id}/evaluate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  reportFeedback(sessionId, data) {
    return this.request(`/sessions/${sessionId}/report-feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getSessions(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/sessions${q ? '?' + q : ''}`);
  },

  getStats(userId) {
    return this.request(`/stats/${userId}`);
  },

  getAchievements() {
    return this.request('/achievements');
  },

  getProfile(userId) {
    return this.request(`/users/${userId}`);
  },

  updateSettings(userId, settings) {
    return this.request(`/users/${userId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },

  exportUserData(userId) {
    return this.request(`/users/${userId}/export`);
  },

  importUserData(userId, data) {
    return this.request(`/users/${userId}/import`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  resetUserData(userId) {
    return this.request(`/users/${userId}/reset`, { method: 'POST' });
  },

  renameAccount(userId, username) {
    return this.request(`/users/${userId}/username`, {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  },

  deleteAccount(userId) {
    return this.request(`/users/${userId}`, { method: 'DELETE' });
  },
};

function showToast(message, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function animateNumber(el, target, duration = 1000) {
  if (document.documentElement.classList.contains('reduce-motion')) {
    el.textContent = target;
    return;
  }
  const start = 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function animateProgressBar(el, percent) {
  requestAnimationFrame(() => {
    el.style.width = `${percent}%`;
  });
}
