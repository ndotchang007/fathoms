/**
 * Short UI sound effects via Web Audio (no asset files).
 * Respects PracticeState.settings.soundEffects (default on).
 */
const SFX = (() => {
  let ctx = null;
  let unlocked = false;

  function enabled() {
    const settings = window.PracticeState?.settings;
    if (settings && settings.soundEffects === false) return false;
    return true;
  }

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  async function ensureRunning() {
    const c = getCtx();
    if (!c) return null;
    if (c.state === 'suspended') {
      try {
        await c.resume();
      } catch {
        return null;
      }
    }
    unlocked = c.state === 'running';
    return unlocked ? c : null;
  }

  function tone(c, {
    type = 'sine',
    freq = 880,
    start = 0,
    duration = 0.08,
    gain = 0.12,
    attack = 0.005,
    decay = 0.06,
  }) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + start);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + Math.max(attack + 0.01, decay));
    osc.connect(g);
    g.connect(c.destination);
    osc.start(c.currentTime + start);
    osc.stop(c.currentTime + start + duration + 0.02);
  }

  /** Mechanical counter tick — pitch rises slightly as shuffle progresses (0–1). */
  function tick(progress = 0) {
    if (!enabled()) return;
    ensureRunning().then((c) => {
      if (!c) return;
      const p = Math.max(0, Math.min(1, progress));
      const freq = 920 + p * 480;
      tone(c, {
        type: 'square',
        freq,
        duration: 0.045,
        gain: 0.045,
        attack: 0.002,
        decay: 0.035,
      });
    });
  }

  /** Short major-third chime when a topic lands. */
  function affirm({ force = false } = {}) {
    if (!force && !enabled()) return;
    ensureRunning().then((c) => {
      if (!c) return;
      tone(c, {
        type: 'sine',
        freq: 523.25,
        duration: 0.18,
        gain: 0.14,
        attack: 0.008,
        decay: 0.16,
      });
      tone(c, {
        type: 'sine',
        freq: 659.25,
        start: 0.07,
        duration: 0.22,
        gain: 0.12,
        attack: 0.008,
        decay: 0.2,
      });
      tone(c, {
        type: 'triangle',
        freq: 783.99,
        start: 0.12,
        duration: 0.28,
        gain: 0.08,
        attack: 0.01,
        decay: 0.26,
      });
    });
  }

  /** Classic short record beep when the mic starts. */
  function record() {
    if (!enabled()) return;
    ensureRunning().then((c) => {
      if (!c) return;
      tone(c, {
        type: 'sine',
        freq: 880,
        duration: 0.12,
        gain: 0.16,
        attack: 0.004,
        decay: 0.1,
      });
      tone(c, {
        type: 'sine',
        freq: 1174.66,
        start: 0.1,
        duration: 0.1,
        gain: 0.12,
        attack: 0.004,
        decay: 0.085,
      });
    });
  }

  function unlockOnGesture() {
    const unlock = () => {
      ensureRunning();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true, passive: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', unlockOnGesture, { once: true });
    } else {
      unlockOnGesture();
    }
  }

  return { tick, affirm, record, ensureRunning };
})();

window.SFX = SFX;
