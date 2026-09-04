const LEVEL_THRESHOLDS = [0, 500, 1100, 1800, 2600, 3500, 4500, 5600, 6800, 8100, 9500, 11000];

function getLevelForXp(xp) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

function getXpForLevel(level) {
  const idx = Math.min(level - 1, LEVEL_THRESHOLDS.length - 1);
  return LEVEL_THRESHOLDS[idx] || 0;
}

function getNextLevelXp(level) {
  const idx = level;
  if (idx >= LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length + 1) * 1500;
  }
  return LEVEL_THRESHOLDS[idx];
}

function calculateXpEarned({ overall, previousOverall = null, achievementCount = 0 }) {
  let xp = 25 + 50 + Math.round(overall * 1.5);

  if (previousOverall !== null && overall > previousOverall) {
    const improvement = overall - previousOverall;
    xp += Math.min(improvement * 10, 100);
  }

  xp += achievementCount * 100;
  return xp;
}

function applyXp(currentXp, xpEarned) {
  const oldLevel = getLevelForXp(currentXp);
  const newXp = currentXp + xpEarned;
  const newLevel = getLevelForXp(newXp);

  return {
    xpEarned,
    newXp,
    newLevel,
    leveledUp: newLevel > oldLevel,
    oldLevel,
    xpForCurrentLevel: getXpForLevel(newLevel),
    xpForNextLevel: getNextLevelXp(newLevel),
  };
}

module.exports = {
  LEVEL_THRESHOLDS,
  getLevelForXp,
  getXpForLevel,
  getNextLevelXp,
  calculateXpEarned,
  applyXp,
};
