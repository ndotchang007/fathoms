const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const SKILLS = ['speaking', 'comprehension', 'depth', 'reasoning', 'organization', 'clarity', 'vocabulary'];
const MAX_TRANSCRIPT_WORDS = 800;

const CATEGORY_TO_SKILL = {
  understanding_accuracy: 'comprehension',
  clarity: 'clarity',
  reasoning: 'reasoning',
  structure: 'organization',
  conciseness: 'vocabulary',
  audience_effectiveness: 'depth',
  delivery: 'speaking',
};

const GRADING_PROMPT = `Grade this speech using the Fathoms rubric.

Evaluate:
- Understanding & accuracy
- Clarity
- Reasoning
- Structure
- Conciseness
- Audience effectiveness
- Delivery only if supported by the provided data

Return:
- Overall score (0–100)
- Score for each category
- 2 strongest aspects, with specific evidence
- 2–3 growth opportunities, with specific evidence
- One concise overall assessment
- One specific goal for the speaker's next attempt

Tone and approach:
- Be warm, encouraging, and constructive. Lead with what the speaker did well.
- Frame improvements as opportunities: use phrasing like "You could've also…" or "To take this further…" — never pile on criticism.
- Prioritize meaningful communication over vocabulary flash or complexity.
- Do not invent problems or give generic feedback.

Scoring calibration (use consistently — category scores MUST align with your written feedback):
- 90–100: Excellent, polished explanation that would impress an informed listener
- 80–89: Strong, clear explanation with minor gaps
- 70–79: Solid effort with a coherent message and room to grow
- 60–69: Developing — shows understanding but missing key pieces
- Below 60: Only for responses that fundamentally miss the topic or are incoherent
- A competent, accurate explanation of the topic should score 78–88 overall
- A strong explanation (like a well-informed person explaining clearly) should score 85–93
- Reserve 94+ for truly exceptional delivery of content
- If your written feedback praises someone's grasp of a topic, their Understanding & accuracy score must reflect that (typically 75+)
- Category scores should be within 15 points of each other unless one area is clearly exceptional or weak
- The overall score should be close to the average of category scores (within 5 points)

Transcript accuracy:
- The transcript is auto-generated from speech recognition and may contain homophone or terminology errors (e.g. "essentialism" instead of "existentialism").
- Infer the speaker's intended meaning from context. Do not penalize understanding for likely transcription mistakes unless the underlying idea itself is wrong.

Return only the requested JSON.`;

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(val, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(val)));
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getScoreLabel(score) {
  if (score >= 90) return 'Exceptional Fathom';
  if (score >= 80) return 'Strong Fathom';
  if (score >= 70) return 'Solid Fathom';
  if (score >= 60) return 'Developing Fathom';
  return 'Early Fathom';
}

function parseJsonResponse(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

function formatFeedbackItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  const aspect = item.aspect?.trim();
  const evidence = item.evidence?.trim();
  if (aspect && evidence) return `${aspect}: ${evidence}`;
  return aspect || evidence || '';
}

function reconcileScores(parsed) {
  const categoryKeys = [
    'understanding_accuracy', 'clarity', 'reasoning', 'structure',
    'conciseness', 'audience_effectiveness', 'delivery',
  ];

  const categoryScores = categoryKeys
    .map((key) => parsed[key])
    .filter((v) => v != null);

  if (!categoryScores.length) return parsed;

  const avg = categoryScores.reduce((sum, v) => sum + v, 0) / categoryScores.length;
  const reconciledOverall = parsed.overall != null
    ? clamp(Math.round((parsed.overall + avg) / 2))
    : clamp(Math.round(avg));

  return { ...parsed, overall: reconciledOverall };
}

function buildUserMessage({ topic, transcript, speakingDuration, researchDuration, notesLength }) {
  const lines = [
    `Topic: ${topic.title}`,
    `Prompt: ${topic.prompt}`,
  ];

  if (topic.description) lines.push(`Description: ${topic.description}`);
  if (topic.category) lines.push(`Category: ${topic.category}`);
  if (topic.difficulty) lines.push(`Difficulty: ${topic.difficulty}`);
  if (speakingDuration) lines.push(`Speaking duration: ${speakingDuration} seconds`);
  if (researchDuration) lines.push(`Research duration: ${researchDuration} seconds`);
  if (notesLength) lines.push(`Research notes length: ${notesLength} characters`);

  lines.push(
    '',
    'Speech transcript:',
    '"""',
    transcript.trim(),
    '"""',
    '',
    'Return JSON with these fields:',
    '{',
    '  "overall": number,',
    '  "understanding_accuracy": number,',
    '  "clarity": number,',
    '  "reasoning": number,',
    '  "structure": number,',
    '  "conciseness": number,',
    '  "audience_effectiveness": number,',
    '  "delivery": number | null,',
    '  "strengths": [{"aspect": string, "evidence": string}, {"aspect": string, "evidence": string}],',
    '  "improvements": [{"aspect": string, "evidence": string}, ...],',
    '  "assessment": string,',
    '  "next_goal": string',
    '}',
  );

  return lines.join('\n');
}

function mapClaudeEvaluation(parsed) {
  const reconciled = reconcileScores(parsed);
  const scores = {};
  for (const [category, skill] of Object.entries(CATEGORY_TO_SKILL)) {
    const value = reconciled[category];
    if (value != null) scores[skill] = clamp(value);
  }

  const deliveryScored = reconciled.delivery != null;
  if (!deliveryScored) {
    delete scores.speaking;
  }

  const strengths = (reconciled.strengths || [])
    .map(formatFeedbackItem)
    .filter(Boolean)
    .slice(0, 2);

  const improvements = (reconciled.improvements || [])
    .map(formatFeedbackItem)
    .filter(Boolean)
    .slice(0, 3);

  const overall = clamp(reconciled.overall ?? 0);

  return {
    overall,
    speaking: scores.speaking ?? null,
    comprehension: scores.comprehension ?? 0,
    depth: scores.depth ?? 0,
    reasoning: scores.reasoning ?? 0,
    organization: scores.organization ?? 0,
    clarity: scores.clarity ?? 0,
    vocabulary: scores.vocabulary ?? 0,
    strengths: strengths.length ? strengths : ['You engaged with the topic directly', 'You completed a full speaking attempt'],
    improvements: improvements.length ? improvements : ['You could\'ve also opened with your main point in one clear sentence', 'You could\'ve also added one concrete example to support your explanation'],
    recommendation: reconciled.next_goal?.trim() || 'Open with your main point in one sentence, then support it with one concrete example.',
    assessment: reconciled.assessment?.trim() || '',
    label: getScoreLabel(overall),
    deliveryScored,
    isDemo: false,
  };
}

async function evaluateWithClaude({
  topic,
  transcript,
  speakingDuration = 0,
  researchDuration = 0,
  notesLength = 0,
}) {
  const wordCount = countWords(transcript);
  if (wordCount > MAX_TRANSCRIPT_WORDS) {
    const err = new Error(`Speech transcript exceeds the ${MAX_TRANSCRIPT_WORDS}-word limit (${wordCount} words). Please submit a shorter recording.`);
    err.status = 400;
    throw err;
  }

  const client = new Anthropic({ apiKey: config.claudeApiKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    temperature: 0.2,
    system: GRADING_PROMPT,
    messages: [{
      role: 'user',
      content: buildUserMessage({ topic, transcript, speakingDuration, researchDuration, notesLength }),
    }],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('No evaluation returned from Claude');
  }

  const parsed = parseJsonResponse(textBlock.text);
  return mapClaudeEvaluation(parsed);
}

async function evaluateWithMock({
  topic,
  sessionId,
  attemptNumber = 1,
  previousEvaluation = null,
  researchDuration = 0,
  speakingDuration = 0,
  notesLength = 0,
}) {
  const seed = hashCode(sessionId || topic?.id || 'default');
  const difficultyMod = { Easy: 5, Medium: 0, Hard: -5 }[topic?.difficulty] || 0;

  const researchBonus = Math.min(8, Math.floor(researchDuration / 30));
  const notesBonus = Math.min(10, Math.floor(notesLength / 50));
  const speakingBonus = speakingDuration >= 45 && speakingDuration <= 120 ? 8
    : speakingDuration >= 30 && speakingDuration <= 180 ? 4
    : speakingDuration > 15 ? 0 : -8;

  let base = 75 + difficultyMod + researchBonus + notesBonus + speakingBonus;
  base += (seed % 7) - 3;

  const scores = {};
  for (const skill of SKILLS) {
    const skillSeed = hashCode(sessionId + skill) % 9 - 4;
    scores[skill] = clamp(base + skillSeed, 65, 95);
  }

  if (attemptNumber > 1 && previousEvaluation) {
    const improvement = 3 + (seed % 7);
    for (const skill of SKILLS) {
      scores[skill] = clamp(Math.max(scores[skill], (previousEvaluation[skill] || 0) + 2), 65, 95);
    }
  }

  scores.overall = clamp(
    Math.round(SKILLS.reduce((sum, s) => sum + scores[s], 0) / SKILLS.length),
    65,
    95,
  );

  const sorted = [...SKILLS].sort((a, b) => scores[a] - scores[b]);
  const weakest = sorted[0];

  const STRENGTH_TEMPLATES = {
    speaking: ['Confident delivery', 'Steady pacing throughout your explanation'],
    comprehension: ['Strong grasp of the core concept', 'Accurate understanding of key ideas'],
    depth: ['Thoughtful exploration of the topic', 'Good use of underlying principles'],
    reasoning: ['Logical connections between ideas', 'Sound causal reasoning'],
    organization: ['Clear beginning, middle, and end', 'Strong logical structure'],
    clarity: ['Clear central explanation', 'Easy-to-follow language'],
    vocabulary: ['Appropriate terminology', 'Precise word choices'],
  };

  const IMPROVEMENT_TEMPLATES = {
    speaking: ['You could\'ve also varied your pacing', 'You could\'ve also reduced filler words'],
    comprehension: ['You could\'ve also addressed more aspects of the prompt', 'You could\'ve also covered additional key concepts'],
    depth: ['You could\'ve also gone deeper on mechanisms', 'You could\'ve also added more specific evidence'],
    reasoning: ['You could\'ve also strengthened causal links', 'You could\'ve also explained why, not just what'],
    organization: ['You could\'ve also used clearer transitions', 'You could\'ve also grouped related ideas together'],
    clarity: ['You could\'ve also simplified complex sentences', 'You could\'ve also defined technical terms'],
    vocabulary: ['You could\'ve also used more precise terms', 'You could\'ve also expanded your descriptive language'],
  };

  const RECOMMENDATIONS = {
    depth: 'After making a claim, immediately support it with a specific example or piece of evidence.',
    clarity: 'Lead with your main point in one sentence, then unpack the details.',
    organization: 'Outline three key points before speaking, then address each in order.',
    reasoning: 'When explaining a cause, explicitly connect it to its effect.',
    vocabulary: 'Replace general words like "thing" or "stuff" with specific terminology.',
    speaking: 'Pause briefly between major sections to signal transitions.',
    comprehension: 'Re-read the prompt and ensure each part is addressed in your response.',
  };

  const strengths = [
    STRENGTH_TEMPLATES[sorted[sorted.length - 1]][seed % 2],
    STRENGTH_TEMPLATES[sorted[sorted.length - 2]][(seed + 1) % 2],
  ];

  const improvements = [
    IMPROVEMENT_TEMPLATES[weakest][seed % 2],
    IMPROVEMENT_TEMPLATES[sorted[1]][(seed + 2) % 2],
  ];

  return {
    overall: scores.overall,
    speaking: scores.speaking,
    comprehension: scores.comprehension,
    depth: scores.depth,
    reasoning: scores.reasoning,
    organization: scores.organization,
    clarity: scores.clarity,
    vocabulary: scores.vocabulary,
    strengths,
    improvements,
    recommendation: RECOMMENDATIONS[weakest] || RECOMMENDATIONS.depth,
    assessment: '',
    label: getScoreLabel(scores.overall),
    deliveryScored: true,
    isDemo: true,
  };
}

async function evaluate({
  topic,
  sessionId,
  attemptNumber = 1,
  previousEvaluation = null,
  researchDuration = 0,
  speakingDuration = 0,
  notesLength = 0,
  transcript = '',
}) {
  if (config.claudeApiKey) {
    if (!transcript?.trim()) {
      const err = new Error('Speech transcript is required for AI evaluation');
      err.status = 400;
      throw err;
    }

    return evaluateWithClaude({
      topic,
      transcript,
      speakingDuration,
      researchDuration,
      notesLength,
    });
  }

  return evaluateWithMock({
    topic,
    sessionId,
    attemptNumber,
    previousEvaluation,
    researchDuration,
    speakingDuration,
    notesLength,
  });
}

module.exports = { evaluate, SKILLS, getScoreLabel, CATEGORY_TO_SKILL, MAX_TRANSCRIPT_WORDS };
