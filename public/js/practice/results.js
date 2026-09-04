const RUBRIC_SKILLS = [
  { key: 'comprehension', label: 'Understanding & Accuracy' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'organization', label: 'Structure' },
  { key: 'vocabulary', label: 'Conciseness' },
  { key: 'depth', label: 'Audience Effectiveness' },
  { key: 'speaking', label: 'Delivery', optional: true },
];

const MAX_TRANSCRIPT_WORDS = 800;

const EVAL_MESSAGES = [
  'Evaluating your response…',
  'Scoring clarity and structure…',
  'Reviewing depth and reasoning…',
  'Measuring organization…',
  'Checking vocabulary and comprehension…',
  'Finishing your score…',
];

const DEPTH_DOTS = 5;
const MIN_FATHOMS = 1;
const MAX_FATHOMS = 100;

let evalAnimInterval = null;
let evalMsgInterval = null;
let evalProgress = 0;
let evalTargetProgress = 0;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatFeedbackHtml(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(/^([^:]+:)/, '<strong class="feedback-highlight">$1</strong>');
}

function renderFeedbackCard(text, type) {
  return `
    <div class="feedback-card" data-feedback-type="${type}">
      <div class="feedback-card-body">
        <p>${formatFeedbackHtml(text)}</p>
        <div class="feedback-report-form" hidden>
          <label class="feedback-report-label">What's inaccurate about this feedback?</label>
          <textarea class="feedback-report-input" rows="3" placeholder="e.g. The transcript misheard a word I said…"></textarea>
          <div class="feedback-report-actions">
            <button type="button" class="btn btn-ghost btn-sm feedback-report-cancel">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm feedback-report-submit">Submit report</button>
          </div>
        </div>
        <p class="feedback-report-thanks" hidden>Thanks — we received your report and will review it.</p>
      </div>
      <button type="button" class="feedback-report-btn" title="Report inaccurate feedback" aria-label="Report inaccurate feedback" data-content="${encodeURIComponent(text)}" data-type="${type}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
      </button>
    </div>
  `;
}

function bindFeedbackReports(sessionId) {
  document.querySelectorAll('.feedback-card').forEach((card) => {
    const btn = card.querySelector('.feedback-report-btn');
    const form = card.querySelector('.feedback-report-form');
    const thanks = card.querySelector('.feedback-report-thanks');
    const input = card.querySelector('.feedback-report-input');
    const cancelBtn = card.querySelector('.feedback-report-cancel');
    const submitBtn = card.querySelector('.feedback-report-submit');
    if (!btn || !form || !input) return;

    btn.addEventListener('click', () => {
      if (card.classList.contains('reported')) return;
      form.hidden = false;
      btn.hidden = true;
      input.focus();
    });

    cancelBtn?.addEventListener('click', () => {
      form.hidden = true;
      btn.hidden = false;
      input.value = '';
    });

    submitBtn?.addEventListener('click', async () => {
      const reason = input.value.trim();
      if (!reason) {
        input.focus();
        input.placeholder = 'Please add a brief reason…';
        return;
      }

      const content = decodeURIComponent(btn.dataset.content || '');
      const feedbackType = btn.dataset.type;
      submitBtn.disabled = true;
      cancelBtn.disabled = true;

      try {
        await API.reportFeedback(sessionId, {
          feedback_type: feedbackType,
          content,
          reason,
        });
        card.classList.add('reported');
        form.hidden = true;
        thanks.hidden = false;
      } catch {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        showToast('Could not submit report. Try again.', 3000);
      }
    });
  });
}

function animateXpGain({
  barEl,
  earnedEl,
  previousXp,
  newXp,
  xpEarned,
  previousXpForCurrentLevel,
  previousXpForNextLevel,
  xpForCurrentLevel,
  xpForNextLevel,
  leveledUp,
  duration = 1400,
}) {
  const prevRange = previousXpForNextLevel - previousXpForCurrentLevel;
  const startPercent = prevRange > 0
    ? Math.max(0, ((previousXp - previousXpForCurrentLevel) / prevRange) * 100)
    : 0;
  const newRange = xpForNextLevel - xpForCurrentLevel;
  const endPercent = newRange > 0
    ? Math.min(100, ((newXp - xpForCurrentLevel) / newRange) * 100)
    : 0;

  barEl.classList.add('is-animating');
  barEl.style.width = `${startPercent}%`;
  earnedEl.textContent = '+0 XP';

  if (document.documentElement.classList.contains('reduce-motion')) {
    barEl.style.width = `${endPercent}%`;
    earnedEl.textContent = `+${xpEarned} XP`;
    barEl.classList.remove('is-animating');
    return;
  }

  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    if (leveledUp && startPercent < 100) {
      if (progress < 0.55) {
        const phase = progress / 0.55;
        const phaseEased = 1 - Math.pow(1 - phase, 3);
        barEl.style.width = `${startPercent + (100 - startPercent) * phaseEased}%`;
      } else {
        const phase = (progress - 0.55) / 0.45;
        const phaseEased = 1 - Math.pow(1 - phase, 3);
        barEl.style.width = `${endPercent * phaseEased}%`;
      }
    } else {
      barEl.style.width = `${startPercent + (endPercent - startPercent) * eased}%`;
    }

    earnedEl.textContent = `+${Math.round(xpEarned * eased)} XP`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      earnedEl.textContent = `+${xpEarned} XP`;
      barEl.classList.remove('is-animating');
    }
  }

  requestAnimationFrame(tick);
}

function updateDepthEvalUI(progress) {
  const dotsEl = document.getElementById('eval-dots');
  const depthEl = document.getElementById('eval-depth');
  if (!dotsEl || !depthEl) return;

  const activeDots = Math.min(DEPTH_DOTS, Math.floor((progress / 100) * DEPTH_DOTS));
  dotsEl.querySelectorAll('.depth-eval-dot').forEach((dot, i) => {
    const isActive = i < activeDots;
    dot.classList.toggle('active', isActive);
    dot.classList.toggle('current', isActive && i === activeDots - 1);
  });

  depthEl.textContent = `${Math.max(MIN_FATHOMS, Math.min(MAX_FATHOMS, Math.round((progress / 100) * (MAX_FATHOMS - MIN_FATHOMS) + MIN_FATHOMS)))} fathoms`;
}

function startEvalAnimation() {
  const statusEl = document.getElementById('eval-status');
  const dotsEl = document.getElementById('eval-dots');
  const processing = document.getElementById('processing');

  evalProgress = 0;
  evalTargetProgress = 85;

  dotsEl.innerHTML = Array.from({ length: DEPTH_DOTS }, () => '<span class="depth-eval-dot"></span>').join('');
  statusEl.textContent = EVAL_MESSAGES[0];
  updateDepthEvalUI(0);

  processing.hidden = false;
  processing.setAttribute('aria-busy', 'true');
  document.body.classList.add('depth-eval-open');

  let msgIdx = 0;
  evalMsgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % EVAL_MESSAGES.length;
    statusEl.textContent = EVAL_MESSAGES[msgIdx];
  }, 2600);

  evalAnimInterval = setInterval(() => {
    if (evalProgress < evalTargetProgress) {
      evalProgress = Math.min(evalTargetProgress, evalProgress + 1.2);
      updateDepthEvalUI(evalProgress);
    }
  }, 45);
}

function setEvalTargetProgress(target) {
  evalTargetProgress = target;
}

function waitForEvalProgress(target, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (evalProgress >= target || Date.now() - start > timeoutMs) {
        evalProgress = target;
        updateDepthEvalUI(evalProgress);
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function stopEvalAnimation() {
  clearInterval(evalAnimInterval);
  clearInterval(evalMsgInterval);
  evalAnimInterval = null;
  evalMsgInterval = null;

  const processing = document.getElementById('processing');
  if (processing) {
    processing.hidden = true;
    processing.setAttribute('aria-busy', 'false');
  }
  document.body.classList.remove('depth-eval-open');
}

async function initResults(state) {
  document.getElementById('results-content').style.display = 'none';
  startEvalAnimation();

  const minWait = 3600;

  try {
    const result = await Promise.all([
      API.evaluateSession(state.session.id, {
        research_duration: state.researchDuration,
        speaking_duration: state.speakingDuration,
        notes_length: state.notesLength || (state.transcript?.length || 0),
        transcript: state.transcript || '',
      }),
      new Promise((r) => setTimeout(r, minWait)),
    ]).then(([res]) => res);

    document.getElementById('eval-status').textContent = 'Surfacing your results…';
    setEvalTargetProgress(100);
    await waitForEvalProgress(100);
    await new Promise((r) => setTimeout(r, 500));

    stopEvalAnimation();
    document.getElementById('results-content').style.display = 'block';

    const ev = result.evaluation;
    const xp = result.xp;

    const scoreEl = document.getElementById('overall-score');
    animateNumber(scoreEl, ev.overall, 900);
    scoreEl.classList.add('score-reveal');

    document.getElementById('score-label').textContent = ev.assessment || (
      ev.overall >= 90 ? 'Exceptional' :
      ev.overall >= 80 ? 'Strong' :
      ev.overall >= 70 ? 'Solid' :
      ev.overall >= 60 ? 'Developing' : 'Early'
    );

    const visibleSkills = RUBRIC_SKILLS.filter((skill) => {
      if (!skill.optional) return true;
      return ev.deliveryScored && ev[skill.key] != null;
    });

    animateXpGain({
      barEl: document.getElementById('results-xp-bar'),
      earnedEl: document.getElementById('xp-earned'),
      previousXp: xp.previousXp ?? (xp.newXp - xp.xpEarned),
      newXp: xp.newXp,
      xpEarned: xp.xpEarned,
      previousXpForCurrentLevel: xp.previousXpForCurrentLevel ?? xp.xpForCurrentLevel,
      previousXpForNextLevel: xp.previousXpForNextLevel ?? xp.xpForNextLevel,
      xpForCurrentLevel: xp.xpForCurrentLevel,
      xpForNextLevel: xp.xpForNextLevel,
      leveledUp: xp.leveledUp,
    });

    document.getElementById('results-xp-text').textContent = `Level ${xp.newLevel} · ${xp.newXp - xp.xpForCurrentLevel} / ${xp.xpForNextLevel - xp.xpForCurrentLevel} XP`;

    if (xp.leveledUp) {
      const modal = document.getElementById('level-up-modal');
      document.getElementById('level-up-text').textContent = `You reached Level ${xp.newLevel}`;
      modal.classList.add('show');
      document.getElementById('level-up-close').onclick = () => modal.classList.remove('show');
    }

    const tbody = document.querySelector('#skill-table tbody');
    tbody.innerHTML = visibleSkills.map((skill) => `
      <tr><td>${skill.label}</td><td>${ev[skill.key]}</td></tr>
    `).join('');

    document.getElementById('strengths-list').innerHTML = (ev.strengths || [])
      .map((s) => renderFeedbackCard(s, 'strength'))
      .join('');

    document.getElementById('improvements-list').innerHTML = (ev.improvements || [])
      .map((s) => renderFeedbackCard(s, 'improvement'))
      .join('');

    bindFeedbackReports(state.session.id);

    const recEl = document.getElementById('recommendation');
    recEl.innerHTML = formatFeedbackHtml(ev.recommendation);

    if (result.attemptHistory && result.attemptHistory.length > 1) {
      document.getElementById('attempt-history-section').style.display = 'block';
      document.getElementById('attempt-history').innerHTML = result.attemptHistory.map((a, i) => {
        const improved = i > 0 && a.score > result.attemptHistory[i - 1].score;
        return `<div class="attempt-item${improved ? ' improved' : ''}">Attempt ${a.attempt} — ${a.score}</div>`;
      }).join('');
    }

    if (result.newAchievements && result.newAchievements.length) {
      result.newAchievements.forEach((a) => {
        showToast(`Achievement unlocked: ${a.name}`, 4000);
      });
    }

    document.getElementById('next-fathom').onclick = () => {
      const nextAttempt = state.attemptNumber + 1;
      window.location.href = `/practice?retry=${state.topic.id}&attempt=${nextAttempt}`;
    };

    document.getElementById('back-to-dashboard').onclick = () => {
      window.location.href = '/stats';
    };
  } catch (err) {
    stopEvalAnimation();
    document.getElementById('processing').hidden = false;
    document.getElementById('processing').innerHTML = `
      <div class="depth-eval-error">
        <p>Evaluation failed: ${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Try again</button>
      </div>
    `;
  }
}
