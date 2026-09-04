const { TOPIC_CATEGORIES, generateTopics } = require('./topicTemplates');

const ACHIEVEMENTS = [
  { id: 'ach-first', slug: 'first-fathom', name: 'First Fathom', description: 'Complete your first Fathom.', requirement_type: 'sessions', requirement_value: 1 },
  { id: 'ach-5', slug: 'five-fathoms', name: '5 Fathoms', description: 'Complete 5 sessions.', requirement_type: 'sessions', requirement_value: 5 },
  { id: 'ach-10', slug: 'ten-fathoms', name: '10 Fathoms', description: 'Complete 10 sessions.', requirement_type: 'sessions', requirement_value: 10 },
  { id: 'ach-50', slug: 'scholar', name: 'Scholar', description: 'Complete 50 Fathoms.', requirement_type: 'sessions', requirement_value: 50 },
  { id: 'ach-depth', slug: 'deep-thinker', name: 'Deep Thinker', description: 'Score 90+ on Depth.', requirement_type: 'skill_depth', requirement_value: 90 },
  { id: 'ach-clarity', slug: 'clear-speaker', name: 'Clear Speaker', description: 'Score 90+ on Clarity.', requirement_type: 'skill_clarity', requirement_value: 90 },
  { id: 'ach-streak', slug: 'week-strong', name: 'Week Strong', description: 'Maintain a 7-day streak.', requirement_type: 'streak', requirement_value: 7 },
  { id: 'ach-breakthrough', slug: 'breakthrough', name: 'Breakthrough', description: 'Improve by 15+ points between attempts.', requirement_type: 'improvement', requirement_value: 15 },
];

/** Seed topics + achievements only — no fake users or session history. */
function generateSeedData() {
  return {
    users: [],
    topics: generateTopics(),
    sessions: [],
    evaluations: [],
    achievements: ACHIEVEMENTS,
    user_achievements: [],
  };
}

module.exports = { generateSeedData, ACHIEVEMENTS, TOPIC_CATEGORIES, generateTopics };
