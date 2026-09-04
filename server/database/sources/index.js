const generalAndMustKnow = require('./generalAndMustKnow');
const nicheAndPolitical = require('./nicheAndPolitical');
const historyAndMechanics = require('./historyAndMechanics');
const scienceCulturePhilEcon = require('./scienceCulturePhilEcon');

const TOPIC_SOURCES = {
  ...generalAndMustKnow,
  ...nicheAndPolitical,
  ...historyAndMechanics,
  ...scienceCulturePhilEcon,
};

function normalizeSource(source) {
  return {
    title: source.title,
    site: source.site,
    url: source.url,
    description: source.description,
    bullets: Array.isArray(source.bullets) ? source.bullets.slice() : [],
  };
}

function getSourcesForTopic(title) {
  const sources = TOPIC_SOURCES[title];
  if (!Array.isArray(sources) || !sources.length) return null;
  return sources.map(normalizeSource);
}

module.exports = {
  TOPIC_SOURCES,
  getSourcesForTopic,
  normalizeSource,
};
