const SKILLS = ['speaking', 'comprehension', 'depth', 'reasoning', 'organization', 'clarity', 'vocabulary'];

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireAuth();
  if (!currentUser) return;

  try {
    const [data, { achievements }] = await Promise.all([
      API.getProfile(currentUser.id),
      API.getAchievements(),
    ]);
    renderProfile(data);
    renderAchievements(achievements);
  } catch (err) {
    showToast('Failed to load profile');
    console.error(err);
  }

  if (window.location.hash === '#trophy-case') {
    document.getElementById('trophy-case')?.scrollIntoView({ behavior: 'smooth' });
  }
});

function renderProfile(data) {
  const { user, stats } = data;
  document.getElementById('profile-avatar').textContent = user.username.charAt(0).toUpperCase();
  document.getElementById('profile-name').textContent = user.username;
  document.getElementById('profile-level').textContent = `Level ${user.level}`;
  document.getElementById('profile-xp').textContent = user.xp;
  document.getElementById('profile-fathoms').textContent = stats.fathomsCompleted;
  document.getElementById('profile-streak').textContent = stats.streak;
  document.getElementById('profile-avg').textContent = stats.averageScore;

  document.getElementById('profile-skills').innerHTML = SKILLS.map((skill) => {
    const val = stats.skills[skill] || 0;
    return `<div class="skill-bar">
      <div class="skill-bar-header"><span>${capitalize(skill)}</span><span>${val}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${val}%"></div></div>
    </div>`;
  }).join('');
}
