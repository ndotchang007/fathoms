const PRESET_RESEARCH = [180, 300, 420, 600];
const PRESET_SPEAKING = [45, 60, 90, 120, 300];

let currentUser = null;
let settings = {};

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  setupSettings(currentUser.settings || {});
  setupDangerZone();
});

function setupSettings(userSettings) {
  settings = { ...userSettings };

  if (settings.theme) {
    document.getElementById('theme').value = settings.theme;
  }

  applyTimerToUI('research', settings.researchTimer ?? 300);
  applyTimerToUI('speaking', settings.speakingTimer ?? 60);

  const soundToggle = document.getElementById('toggle-sound');
  const notesSpeechToggle = document.getElementById('toggle-notes-speech');
  const motionToggle = document.getElementById('toggle-motion');

  if (settings.soundEffects !== false) soundToggle.classList.add('active');
  else soundToggle.classList.remove('active');

  if (settings.showNotesDuringSpeech) notesSpeechToggle.classList.add('active');
  else notesSpeechToggle.classList.remove('active');

  if (settings.reducedMotion) {
    motionToggle.classList.add('active');
    document.documentElement.classList.add('reduce-motion');
  }

  soundToggle.addEventListener('click', () => {
    soundToggle.classList.toggle('active');
    settings.soundEffects = soundToggle.classList.contains('active');
    if (settings.soundEffects) window.SFX?.affirm({ force: true });
    saveSettings();
  });

  notesSpeechToggle.addEventListener('click', () => {
    notesSpeechToggle.classList.toggle('active');
    settings.showNotesDuringSpeech = notesSpeechToggle.classList.contains('active');
    saveSettings();
  });

  motionToggle.addEventListener('click', () => {
    motionToggle.classList.toggle('active');
    settings.reducedMotion = motionToggle.classList.contains('active');
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
    saveSettings();
  });

  document.getElementById('theme').addEventListener('change', (e) => {
    settings.theme = e.target.value;
    document.documentElement.setAttribute('data-theme', e.target.value);
    saveSettings();
  });

  setupTimerControls('research');
  setupTimerControls('speaking');

  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('download-data-btn').addEventListener('click', handleDownload);
}

function applyTimerToUI(type, seconds) {
  const presetEl = document.getElementById(`${type}-timer-preset`);
  const customFields = document.getElementById(`${type}-custom-fields`);
  const hintEl = document.getElementById(`${type}-timer-hint`);

  if (seconds === 0) {
    presetEl.value = '0';
    customFields.hidden = true;
    hintEl.textContent = type === 'research'
      ? 'No time limit — advance manually when ready.'
      : 'No time limit — stop recording when you\'re done.';
    return;
  }

  if (PRESET(type).includes(seconds)) {
    presetEl.value = String(seconds);
    customFields.hidden = true;
  } else {
    presetEl.value = 'custom';
    customFields.hidden = false;
    document.getElementById(`${type}-custom-min`).value = Math.floor(seconds / 60);
    document.getElementById(`${type}-custom-sec`).value = seconds % 60;
  }

  hintEl.textContent = type === 'research'
    ? 'Time allowed for the research phase before auto-advancing.'
    : 'Maximum recording time before auto-stop.';
}

function PRESET(type) {
  return type === 'research' ? PRESET_RESEARCH : PRESET_SPEAKING;
}

function setupTimerControls(type) {
  const presetEl = document.getElementById(`${type}-timer-preset`);
  const customFields = document.getElementById(`${type}-custom-fields`);
  const minEl = document.getElementById(`${type}-custom-min`);
  const secEl = document.getElementById(`${type}-custom-sec`);
  const key = type === 'research' ? 'researchTimer' : 'speakingTimer';

  presetEl.addEventListener('change', () => {
    const val = presetEl.value;
    customFields.hidden = val !== 'custom';
    if (val === 'custom') {
      updateTimerFromCustom(type);
    } else {
      settings[key] = parseInt(val, 10);
      applyTimerToUI(type, settings[key]);
      saveSettings();
    }
  });

  [minEl, secEl].forEach((el) => {
    el.addEventListener('change', () => updateTimerFromCustom(type));
    el.addEventListener('input', () => updateTimerFromCustom(type));
  });
}

function updateTimerFromCustom(type) {
  const min = parseInt(document.getElementById(`${type}-custom-min`).value, 10) || 0;
  const sec = parseInt(document.getElementById(`${type}-custom-sec`).value, 10) || 0;
  const total = min * 60 + sec;
  const key = type === 'research' ? 'researchTimer' : 'speakingTimer';

  if (total <= 0) {
    document.getElementById(`${type}-timer-preset`).value = '0';
    document.getElementById(`${type}-custom-fields`).hidden = true;
    settings[key] = 0;
  } else {
    settings[key] = total;
  }
  applyTimerToUI(type, settings[key]);
  saveSettings();
}

async function saveSettings() {
  const statusEl = document.getElementById('settings-status');
  statusEl.textContent = 'Saving...';
  try {
    await API.updateSettings(currentUser.id, settings);
    statusEl.textContent = 'Settings saved';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch {
    statusEl.textContent = 'Failed to save settings';
  }
}

async function handleLogout() {
  const btn = document.getElementById('logout-btn');
  btn.disabled = true;
  btn.textContent = 'Signing out…';
  try {
    await API.logout();
  } catch {
    /* still leave the session locally */
  }
  window.location.href = '/';
}

async function handleDownload() {
  const btn = document.getElementById('download-data-btn');
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const data = await API.exportUserData(currentUser.id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fathoms-export-${currentUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Download started');
  } catch {
    showToast('Failed to download data');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download user data';
  }
}

function setupDangerZone() {
  document.getElementById('rename-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('rename-username').value.trim();
    if (!username) return;
    try {
      const { user } = await API.renameAccount(currentUser.id, username);
      currentUser = user;
      showToast('Username updated');
      document.getElementById('rename-username').value = '';
    } catch (err) {
      showToast(err.message || 'Failed to rename account');
    }
  });

  document.getElementById('import-data-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirmModal({
      title: 'Import user data?',
      message: 'This will merge sessions, XP, and achievements from the file into your account. Existing data may be overwritten.',
      confirmLabel: 'Import',
      onConfirm: async () => {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await API.importUserData(currentUser.id, data);
          showToast('Data imported successfully');
          const { user } = await API.getMe();
          currentUser = user;
          setupSettings(user.settings || {});
        } catch (err) {
          showToast(err.message || 'Failed to import data');
        }
      },
    });
    e.target.value = '';
  });

  document.getElementById('reset-data-btn').addEventListener('click', () => {
    showConfirmModal({
      title: 'Reset all progress?',
      message: 'This will delete all your sessions, XP, streaks, and achievements. Your account and settings will be kept.',
      confirmLabel: 'Reset data',
      onConfirm: async () => {
        try {
          await API.resetUserData(currentUser.id);
          showToast('Progress reset');
        } catch {
          showToast('Failed to reset data');
        }
      },
    });
  });

  document.getElementById('delete-account-btn').addEventListener('click', () => {
    const extra = document.createElement('div');
    extra.className = 'form-group';
    extra.innerHTML = `
      <label for="delete-confirm-input">Type <strong>${escapeHtml(currentUser.username)}</strong> to confirm</label>
      <input type="text" id="delete-confirm-input" autocomplete="off">
    `;

    showConfirmModal({
      title: 'Delete your account?',
      message: 'This permanently deletes your account and all data. This cannot be undone.',
      confirmLabel: 'Delete account',
      extra,
      validate: () => {
        const input = document.getElementById('delete-confirm-input');
        return input?.value.trim() === currentUser.username;
      },
      onConfirm: async () => {
        try {
          await API.deleteAccount(currentUser.id);
          window.location.href = '/';
        } catch {
          showToast('Failed to delete account');
        }
      },
    });
  });
}

function showConfirmModal({ title, message, confirmLabel, extra, validate, onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  const extraEl = document.getElementById('modal-extra');
  extraEl.innerHTML = '';
  if (extra) extraEl.appendChild(extra);

  const confirmBtn = document.getElementById('modal-confirm');
  confirmBtn.textContent = confirmLabel || 'Confirm';
  confirmBtn.disabled = !!validate;

  if (validate) {
    const input = extraEl.querySelector('input');
    input?.addEventListener('input', () => {
      confirmBtn.disabled = !validate();
    });
  }

  modal.hidden = false;

  function close() {
    modal.hidden = true;
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    modal.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.replaceWith(el.cloneNode(true));
    });
  }

  modal.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', close);
  });

  document.getElementById('modal-confirm').addEventListener('click', async () => {
    if (validate && !validate()) return;
    confirmBtn.disabled = true;
    try {
      await onConfirm();
    } finally {
      close();
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
