const ACHIEVEMENT_ICONS = {
  'first-fathom': '🎯',
  'five-fathoms': '⭐',
  'ten-fathoms': '🌟',
  'scholar': '📚',
  'deep-thinker': '🧠',
  'clear-speaker': '🎤',
  'week-strong': '🔥',
  'breakthrough': '🚀',
};

function renderAchievements(achievements) {
  const summaryEl = document.getElementById('achievement-summary');
  const gridEl = document.getElementById('achievements-grid');
  if (!summaryEl || !gridEl) return;

  const unlocked = achievements.filter((a) => a.unlocked).length;
  summaryEl.innerHTML = `
    <div class="stat-item"><div class="stat-value">${unlocked}</div><div class="stat-label">Unlocked</div></div>
    <div class="stat-item"><div class="stat-value">${achievements.length - unlocked}</div><div class="stat-label">Remaining</div></div>
    <div class="stat-item"><div class="stat-value">${achievements.length}</div><div class="stat-label">Total</div></div>
  `;

  gridEl.innerHTML = achievements.map((a) => {
    const icon = ACHIEVEMENT_ICONS[a.slug] || '🏆';
    const dateStr = a.unlocked_at
      ? `Unlocked ${new Date(a.unlocked_at).toLocaleDateString()}`
      : 'Locked';
    return `
      <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}" aria-label="${a.name}${a.unlocked ? ', unlocked' : ', locked'}">
        <div class="achievement-icon">${a.unlocked ? icon : '🔒'}</div>
        <h3>${a.name}</h3>
        <p>${a.description}</p>
        <div class="achievement-date">${dateStr}</div>
      </div>
    `;
  }).join('');
}
