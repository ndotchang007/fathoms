const { SKILLS } = require('./aiService');
const { getXpForLevel, getNextLevelXp } = require('./xpService');

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
}

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().split('T')[0];
}

function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
}

function isSameDay(value, dateKey) {
  return toDateKey(value) === dateKey;
}

function groupByDate(items, dateField = 'created_at') {
  const map = {};
  for (const item of items) {
    const date = toDateKey(item[dateField]);
    if (!map[date]) map[date] = [];
    map[date].push(item);
  }
  return map;
}

function getDateRange(days) {
  const dates = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

async function getDashboardData(db, userId) {
  const user = await db.getUser(userId);
  const sessions = await db.getSessions(userId, { limit: 50 });
  const evaluations = await db.getEvaluationsForUser(userId);
  const topics = await db.getTopics();
  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t]));

  const evalMap = Object.fromEntries(evaluations.map((e) => [e.session_id, e]));
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const today = new Date().toISOString().split('T')[0];
  const todaySessions = completedSessions.filter(
    (s) => isSameDay(s.completed_at, today)
  );
  const todayEvals = todaySessions.map((s) => evalMap[s.id]).filter(Boolean);

  const skillAvgs = {};
  for (const skill of SKILLS) {
    const vals = evaluations.map((e) => e[skill]).filter(Boolean);
    skillAvgs[skill] = avg(vals);
  }

  const weeklyDates = getDateRange(7);
  const weeklyActivity = weeklyDates.map((date) => ({
    date,
    count: completedSessions.filter(
      (s) => isSameDay(s.completed_at, date)
    ).length,
  }));

  const recentFathoms = completedSessions.slice(0, 5).map((s) => {
    const ev = evalMap[s.id];
    const topic = topicMap[s.topic_id];
    return {
      id: s.id,
      topic: topic?.title || 'Unknown',
      category: topic?.category || '',
      score: ev?.overall || 0,
      xp: s.xp_earned,
      date: toIsoString(s.completed_at),
    };
  });

  const allScores = evaluations.map((e) => e.overall);
  const xpForLevel = getXpForLevel(user.level);
  const xpForNext = getNextLevelXp(user.level);

  return {
    user: {
      id: user.id,
      username: user.username,
      xp: user.xp,
      level: user.level,
      streak: user.streak,
      settings: user.settings,
    },
    progress: {
      level: user.level,
      xp: user.xp,
      xpForLevel,
      xpForNext,
      xpProgress: user.xp - xpForLevel,
      xpNeeded: xpForNext - xpForLevel,
      totalFathoms: completedSessions.length,
      streak: user.streak,
      bestScore: allScores.length ? Math.max(...allScores) : 0,
      averageScore: avg(allScores),
    },
    today: {
      fathoms: todaySessions.length,
      xp: todaySessions.reduce((s, sess) => s + (sess.xp_earned || 0), 0),
      averageScore: avg(todayEvals.map((e) => e.overall)),
    },
    skills: skillAvgs,
    recentFathoms,
    focus: buildFocus(skillAvgs, evaluations),
    weeklyActivity,
  };
}

const FOCUS_MESSAGES = {
  depth: 'Your explanations tend to be strong on facts but weaker on depth.',
  clarity: 'Your ideas are solid but could be expressed more clearly.',
  organization: 'Your content is good but the structure could be tighter.',
  reasoning: 'You cover topics well but could strengthen causal reasoning.',
  vocabulary: 'Your explanations work but vocabulary could be more precise.',
  speaking: 'Your knowledge shows but delivery could be more confident.',
  comprehension: 'You communicate well but could demonstrate deeper comprehension.',
};

const FOCUS_RECOMMENDATIONS = {
  depth: 'Practice supporting your claims with specific evidence.',
  clarity: 'Lead with your main point, then add supporting details.',
  organization: 'Outline three key points before you start speaking.',
  reasoning: 'Explicitly connect causes to their effects.',
  vocabulary: 'Replace vague words with precise terminology.',
  speaking: 'Pause between sections to signal transitions.',
  comprehension: 'Re-read the prompt and address each part directly.',
};

function buildFocus(skillAvgs, evaluations) {
  const hasData = evaluations.length > 0;
  const weakestSkill = hasData
    ? SKILLS.reduce((min, s) => (skillAvgs[s] < skillAvgs[min] ? s : min), SKILLS[0])
    : null;

  if (!hasData) {
    return {
      skill: null,
      message: 'Complete your first Fathom to unlock personalized focus areas.',
      recommendation: 'Start a session and explain a topic out loud.',
    };
  }

  return {
    skill: weakestSkill,
    message: FOCUS_MESSAGES[weakestSkill],
    recommendation: FOCUS_RECOMMENDATIONS[weakestSkill],
  };
}

async function getStatsData(db, userId) {
  const user = await db.getUser(userId);
  const sessions = await db.getSessions(userId);
  const evaluations = await db.getEvaluationsForUser(userId);
  const topics = await db.getTopics();
  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t]));
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const evalBySession = Object.fromEntries(evaluations.map((e) => [e.session_id, e]));

  const skillAvgs = {};
  for (const skill of SKILLS) {
    skillAvgs[skill] = avg(evaluations.map((e) => e[skill]));
  }

  const overallScore = avg(evaluations.map((e) => e.overall));
  const allScores = evaluations.map((e) => e.overall);
  const xpForLevel = getXpForLevel(user.level);
  const xpForNext = getNextLevelXp(user.level);

  const today = new Date().toISOString().split('T')[0];
  const todaySessions = completedSessions.filter((s) => isSameDay(s.completed_at, today));
  const todayEvals = todaySessions.map((s) => evalBySession[s.id]).filter(Boolean);

  const recentFathoms = completedSessions.slice(0, 5).map((s) => {
    const ev = evalBySession[s.id];
    const topic = topicMap[s.topic_id];
    return {
      id: s.id,
      topic: topic?.title || 'Unknown',
      category: topic?.category || '',
      score: ev?.overall || 0,
      xp: s.xp_earned,
      date: toIsoString(s.completed_at),
    };
  });

  function buildTimeSeries(days) {
    const dates = days ? getDateRange(days) : [...new Set(
      evaluations.map((e) => toDateKey(e.created_at))
    )].sort();
    return dates.map((date) => {
      const dayEvals = evaluations.filter((e) => isSameDay(e.created_at, date));
      return {
        date,
        score: avg(dayEvals.map((e) => e.overall)),
        xp: completedSessions
          .filter((s) => isSameDay(s.completed_at, date))
          .reduce((sum, s) => sum + (s.xp_earned || 0), 0),
        count: completedSessions.filter((s) => isSameDay(s.completed_at, date)).length,
      };
    });
  }

  const sortedSkills = [...SKILLS].sort((a, b) => skillAvgs[b] - skillAvgs[a]);
  const insights = [];

  if (evaluations.length >= 2) {
    const recent = evaluations.slice(0, Math.min(5, evaluations.length));
    const older = evaluations.slice(Math.min(5, evaluations.length));
    if (older.length) {
      const recentAvg = avg(recent.map((e) => e.comprehension));
      const olderAvg = avg(older.map((e) => e.comprehension));
      if (olderAvg > 0) {
        const pct = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
        if (pct !== 0) {
          insights.push(`Your comprehension has ${pct > 0 ? 'improved' : 'declined'} ${Math.abs(pct)}% over recent sessions.`);
        }
      }
    }
  }

  insights.push(`Your strongest skill is ${sortedSkills[0]}.`);
  insights.push(`Your biggest improvement opportunity is ${sortedSkills[sortedSkills.length - 1]}.`);

  const xpByDay = groupByDate(
    completedSessions.map((s) => ({ ...s, created_at: s.completed_at })),
    'created_at'
  );

  let mostXpDay = 0;
  let mostFathomsDay = 0;
  for (const [, daySessions] of Object.entries(xpByDay)) {
    const dayXp = daySessions.reduce((s, sess) => s + (sess.xp_earned || 0), 0);
    mostXpDay = Math.max(mostXpDay, dayXp);
    mostFathomsDay = Math.max(mostFathomsDay, daySessions.length);
  }

  let biggestImprovement = 0;
  const byTopic = {};
  for (const s of completedSessions) {
    if (!byTopic[s.topic_id]) byTopic[s.topic_id] = [];
    byTopic[s.topic_id].push({ session: s, eval: evalBySession[s.id] });
  }
  for (const attempts of Object.values(byTopic)) {
    if (attempts.length >= 2) {
      const sorted = attempts.sort((a, b) => a.session.attempt_number - b.session.attempt_number);
      const diff = (sorted[sorted.length - 1].eval?.overall || 0) - (sorted[0].eval?.overall || 0);
      biggestImprovement = Math.max(biggestImprovement, diff);
    }
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      level: user.level,
      xp: user.xp,
      streak: user.streak,
    },
    progress: {
      level: user.level,
      xp: user.xp,
      xpForLevel,
      xpForNext,
      xpProgress: user.xp - xpForLevel,
      xpNeeded: xpForNext - xpForLevel,
      totalFathoms: completedSessions.length,
      streak: user.streak,
      bestScore: allScores.length ? Math.max(...allScores) : 0,
      averageScore: avg(allScores),
    },
    today: {
      fathoms: todaySessions.length,
      xp: todaySessions.reduce((s, sess) => s + (sess.xp_earned || 0), 0),
      averageScore: avg(todayEvals.map((e) => e.overall)),
    },
    recentFathoms,
    focus: buildFocus(skillAvgs, evaluations),
    overallScore,
    skills: skillAvgs,
    timeSeries: {
      sevenDays: buildTimeSeries(7),
      thirtyDays: buildTimeSeries(30),
      allTime: buildTimeSeries(null),
    },
    insights,
    records: {
      highestScore: allScores.length ? Math.max(...allScores) : 0,
      highestDepth: evaluations.length ? Math.max(...evaluations.map((e) => e.depth)) : 0,
      highestSpeaking: evaluations.length ? Math.max(...evaluations.map((e) => e.speaking)) : 0,
      longestStreak: user.best_streak || user.streak,
      mostXpDay,
      mostFathomsDay,
      biggestImprovement,
      totalFathoms: completedSessions.length,
    },
  };
}

module.exports = { getDashboardData, getStatsData };
