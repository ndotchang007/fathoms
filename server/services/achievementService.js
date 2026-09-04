const { getDb } = require('../database');

async function checkAchievements(userId, context = {}) {
  const db = getDb();
  const achievements = await db.getAchievements();
  const userAchievements = await db.getUserAchievements(userId);
  const alreadyUnlocked = new Set(
    userAchievements.filter((a) => a.unlocked).map((a) => a.id)
  );

  const sessionCount = context.sessionCount ?? await db.getCompletedSessionCount(userId);
  const newlyUnlocked = [];

  for (const ach of achievements) {
    if (alreadyUnlocked.has(ach.id)) continue;

    let earned = false;
    switch (ach.requirement_type) {
      case 'sessions':
        earned = sessionCount >= ach.requirement_value;
        break;
      case 'streak':
        earned = (context.streak ?? 0) >= ach.requirement_value;
        break;
      case 'skill_depth':
        earned = (context.evaluation?.depth ?? 0) >= ach.requirement_value;
        break;
      case 'skill_clarity':
        earned = (context.evaluation?.clarity ?? 0) >= ach.requirement_value;
        break;
      case 'improvement':
        earned = (context.improvement ?? 0) >= ach.requirement_value;
        break;
      default:
        break;
    }

    if (earned) {
      await db.unlockAchievement(userId, ach.id);
      newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}

module.exports = { checkAchievements };
