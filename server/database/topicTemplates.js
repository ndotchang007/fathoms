const { getSourcesForTopic } = require('./sources');

const TOPIC_CATEGORIES = [
  { id: 'general', label: 'General', description: 'Broad topics anyone might encounter.' },
  { id: 'must-know', label: 'Must-Know', description: 'Terms people reference but rarely understand.' },
  { id: 'ultra-niche', label: 'Ultra-Niche', description: 'Obscure topics you probably have not heard of.' },
  { id: 'political', label: 'Political', description: 'Political debates and ideologies, explained in depth.' },
  { id: 'history', label: 'History', description: 'Civilizations, events, and historical debates.' },
  { id: 'mechanics', label: 'Mechanics', description: 'How things work — engineering, devices, and movements.' },
  { id: 'science', label: 'Science', description: 'Scientific concepts and natural phenomena.' },
  { id: 'culture', label: 'Culture', description: 'Arts, literature, media, and cultural ideas.' },
  { id: 'philosophy', label: 'Philosophy', description: 'Ethics, thought experiments, and big questions.' },
  { id: 'economics', label: 'Economics', description: 'Markets, policy, and economic theory.' },
];

const TOPIC_TEMPLATES = [
  // —— General ——
  { title: 'Why do airplanes fly?', category: 'general', difficulty: 'Medium', prompt: 'Explain the basic principles that allow an airplane to generate lift and remain in the air.', description: 'Aerodynamics, Bernoulli\'s principle, and wing design.' },
  { title: 'How does the internet work?', category: 'general', difficulty: 'Medium', prompt: 'Describe how data travels across the internet from one device to another.', description: 'TCP/IP, DNS, routers, and packet switching.' },
  { title: 'What is artificial intelligence?', category: 'general', difficulty: 'Medium', prompt: 'Explain what AI is and how modern machine learning systems work.', description: 'Neural networks, training data, and real-world applications.' },
  { title: 'Why do we need sleep?', category: 'general', difficulty: 'Easy', prompt: 'Explain why sleep is essential for health and cognition.', description: 'Restoration, memory consolidation, and immune function.' },
  { title: 'How do vaccines work?', category: 'general', difficulty: 'Medium', prompt: 'Explain how vaccines train the immune system to fight disease.', description: 'Immune memory, antibodies, and herd immunity.' },
  { title: 'What is climate change?', category: 'general', difficulty: 'Medium', prompt: 'Explain the causes and effects of global climate change.', description: 'Greenhouse gases, temperature rise, and environmental impact.' },
  { title: 'How does compounding interest work?', category: 'general', difficulty: 'Easy', prompt: 'Describe how compound interest grows savings over time.', description: 'Principal, rate, frequency, and the rule of 72.' },
  { title: 'What is critical thinking?', category: 'general', difficulty: 'Easy', prompt: 'Define critical thinking and explain why it matters in everyday life.', description: 'Analysis, evaluation, inference, and open-mindedness.' },
  { title: 'How do habits form?', category: 'general', difficulty: 'Medium', prompt: 'Describe the science behind habit formation and how habits can be changed.', description: 'Cue-routine-reward loops and neuroplasticity.' },
  { title: 'What makes a good argument?', category: 'general', difficulty: 'Medium', prompt: 'Explain the elements of a logical, persuasive argument.', description: 'Premises, conclusions, evidence, and common fallacies.' },

  // —— Must-Know ——
  { title: 'What is Manifest Destiny?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain what Manifest Destiny meant in American history and why the phrase still appears in debates today.', description: 'Westward expansion, ideology, and lasting political rhetoric.' },
  { title: 'What does "deus ex machina" mean?', category: 'must-know', difficulty: 'Easy', prompt: 'Explain the literary term deus ex machina and give examples of how it is used in stories and criticism.', description: 'Ancient Greek theater origins and modern narrative shortcuts.' },
  { title: 'What is a Catch-22?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain what a Catch-22 is, where the phrase comes from, and how it applies beyond the novel.', description: 'Joseph Heller, paradoxical rules, and bureaucratic traps.' },
  { title: 'What is juxtaposition?', category: 'must-know', difficulty: 'Easy', prompt: 'Define juxtaposition and explain how artists and writers use it to create meaning.', description: 'Contrast, emphasis, and examples in literature and visual art.' },
  { title: 'What is gaslighting?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain what gaslighting means in psychology and why the term has become widely used.', description: 'Manipulation, reality distortion, and the 1944 film origin.' },
  { title: 'What is Occam\'s razor?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain Occam\'s razor and how it is used — and misused — in science and everyday reasoning.', description: 'Parsimony, simpler explanations, and common misconceptions.' },
  { title: 'What makes something Kafkaesque?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain what people mean when they call a situation Kafkaesque.', description: 'Bureaucratic absurdity, alienation, and Franz Kafka\'s fiction.' },
  { title: 'What is the tragedy of the commons?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain the tragedy of the commons and how it applies to environmental and social problems.', description: 'Shared resources, incentives, and Garrett Hardin\'s essay.' },
  { title: 'What is Stockholm syndrome?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain Stockholm syndrome, its origins, and what psychologists think about the concept today.', description: 'Hostage cases, attachment under duress, and debate over the label.' },
  { title: 'What is a Pyrrhic victory?', category: 'must-know', difficulty: 'Easy', prompt: 'Explain what a Pyrrhic victory is and give historical or modern examples.', description: 'King Pyrrhus, winning at too high a cost.' },
  { title: 'What is Machiavellianism?', category: 'must-know', difficulty: 'Medium', prompt: 'Explain what it means to call someone Machiavellian and how that differs from reading Machiavelli himself.', description: 'The Prince, political realism, and personality psychology.' },
  { title: 'What is schadenfreude?', category: 'must-know', difficulty: 'Easy', prompt: 'Define schadenfreude and discuss why people experience pleasure in others\' misfortune.', description: 'German loanword, social comparison, and moral psychology.' },

  // —— Ultra-Niche ——
  { title: 'What is the Antikythera mechanism?', category: 'ultra-niche', difficulty: 'Hard', prompt: 'Explain what the Antikythera mechanism is and why it surprises historians of technology.', description: 'Ancient Greek analog computer recovered from a shipwreck.' },
  { title: 'What was the Great Emu War?', category: 'ultra-niche', difficulty: 'Medium', prompt: 'Describe Australia\'s Great Emu War and what it reveals about policy and ecology.', description: '1932 emu cull, military deployment, and wheat farming.' },
  { title: 'What was the Velikovsky affair?', category: 'ultra-niche', difficulty: 'Hard', prompt: 'Explain the Velikovsky affair and the clash between speculative history and scientific publishing.', description: 'Immanuel Velikovsky, Worlds in Collision, and peer review battles.' },
  { title: 'What is sonoluminescence?', category: 'ultra-niche', difficulty: 'Hard', prompt: 'Explain sonoluminescence and why it puzzles physicists.', description: 'Light from collapsing bubbles and extreme local temperatures.' },
  { title: 'What was the Kowloon Walled City?', category: 'ultra-niche', difficulty: 'Medium', prompt: 'Describe the Kowloon Walled City and its unique political and social status.', description: 'Dense Hong Kong enclave, extralegal governance, and demolition.' },
  { title: 'What is the doctrine of signatures?', category: 'ultra-niche', difficulty: 'Hard', prompt: 'Explain the doctrine of signatures and its role in pre-modern medicine.', description: 'Plants resembling body parts and symbolic healing theories.' },
  { title: 'What is the Voynich manuscript?', category: 'ultra-niche', difficulty: 'Hard', prompt: 'Describe the Voynich manuscript and the main theories about its origin.', description: 'Undeciphered medieval codex, cryptanalysis, and hoax debates.' },
  { title: 'What is the Baader-Meinhof phenomenon?', category: 'ultra-niche', difficulty: 'Easy', prompt: 'Explain the Baader-Meinhof phenomenon and the cognitive biases behind it.', description: 'Frequency illusion, selective attention, and recency effects.' },
  { title: 'What is the Codex Seraphinianus?', category: 'ultra-niche', difficulty: 'Hard', prompt: 'Describe the Codex Seraphinianus and why artists and linguists find it fascinating.', description: 'Luigi Serafini\'s illustrated encyclopedia of an imaginary world.' },
  { title: 'What is the Oak Island money pit mystery?', category: 'ultra-niche', difficulty: 'Medium', prompt: 'Summarize the Oak Island mystery and why treasure hunters keep digging.', description: 'Nova Scotia excavation lore, booby traps, and skepticism.' },

  // —— Political ——
  { title: 'Should universal basic income be adopted?', category: 'political', difficulty: 'Hard', prompt: 'Present the strongest arguments for and against universal basic income.', description: 'Automation, welfare design, pilot studies, and fiscal tradeoffs.' },
  { title: 'Is affirmative action justified?', category: 'political', difficulty: 'Hard', prompt: 'Explain the debate over affirmative action in education and employment.', description: 'Equality, historical disadvantage, and legal challenges.' },
  { title: 'Should the Electoral College be abolished?', category: 'political', difficulty: 'Medium', prompt: 'Argue both sides of whether the United States should keep the Electoral College.', description: 'Federalism, swing states, and popular vote alternatives.' },
  { title: 'Is free speech absolute?', category: 'political', difficulty: 'Hard', prompt: 'Explain how different societies balance free speech with harm, safety, and order.', description: 'Liberalism, hate speech laws, and platform moderation.' },
  { title: 'Should billionaires exist?', category: 'political', difficulty: 'Hard', prompt: 'Present the moral and economic arguments about extreme wealth concentration.', description: 'Inequality, philanthropy, taxation, and innovation incentives.' },
  { title: 'Is nationalism harmful or necessary?', category: 'political', difficulty: 'Hard', prompt: 'Debate whether nationalism is a constructive or destructive force in modern politics.', description: 'Identity, sovereignty, cosmopolitanism, and historical examples.' },
  { title: 'Should drug prohibition end?', category: 'political', difficulty: 'Hard', prompt: 'Explain the policy debate over decriminalization and legalization of drugs.', description: 'Public health, criminal justice, Portugal\'s model, and cartels.' },
  { title: 'Is NATO still relevant?', category: 'political', difficulty: 'Medium', prompt: 'Argue whether NATO remains necessary in the 21st century.', description: 'Collective defense, burden sharing, and post-Cold War missions.' },
  { title: 'Should AI development be government-regulated?', category: 'political', difficulty: 'Hard', prompt: 'Present the case for and against strong government regulation of AI.', description: 'Safety, innovation, geopolitics, and open-source models.' },
  { title: 'Is two-party democracy failing?', category: 'political', difficulty: 'Hard', prompt: 'Explain criticisms of two-party systems and alternatives proposed by reformers.', description: 'Polarization, Duverger\'s law, ranked choice, and multiparty models.' },

  // —— History ——
  { title: 'What caused the fall of the Roman Empire?', category: 'history', difficulty: 'Hard', prompt: 'Explain the major theories about why the Western Roman Empire collapsed.', description: 'Internal decay, barbarian migrations, economics, and climate.' },
  { title: 'What was the Bronze Age collapse?', category: 'history', difficulty: 'Hard', prompt: 'Describe the Bronze Age collapse and what historians think caused it.', description: 'Late Bronze Age kingdoms, Sea Peoples, and systemic fragility.' },
  { title: 'What was the Taiping Rebellion?', category: 'history', difficulty: 'Hard', prompt: 'Explain the Taiping Rebellion and its impact on Qing China.', description: 'Hong Xiuquan, civil war scale, and nineteenth-century upheaval.' },
  { title: 'What was the Haitian Revolution?', category: 'history', difficulty: 'Hard', prompt: 'Describe the Haitian Revolution and why it mattered globally.', description: 'Enslaved uprising, Toussaint Louverture, and abolition ripples.' },
  { title: 'What was the Columbian Exchange?', category: 'history', difficulty: 'Medium', prompt: 'Explain the Columbian Exchange and its biological and cultural consequences.', description: 'New World crops, Old World diseases, and demographic shifts.' },
  { title: 'What caused World War I?', category: 'history', difficulty: 'Medium', prompt: 'Explain the main causes and triggers of World War I.', description: 'Alliances, nationalism, imperialism, and the July Crisis.' },
  { title: 'What was the Meiji Restoration?', category: 'history', difficulty: 'Medium', prompt: 'Describe the Meiji Restoration and how Japan modernized so rapidly.', description: 'Samurai rule ending, industrialization, and state-led reform.' },
  { title: 'What was the Islamic Golden Age?', category: 'history', difficulty: 'Medium', prompt: 'Explain the Islamic Golden Age and its contributions to science and philosophy.', description: 'Abbasid Baghdad, translation movement, and cross-cultural scholarship.' },
  { title: 'What was the Scramble for Africa?', category: 'history', difficulty: 'Medium', prompt: 'Describe the Scramble for Africa and its long-term consequences.', description: 'Berlin Conference, colonial borders, and resistance movements.' },
  { title: 'What was Prohibition in the United States?', category: 'history', difficulty: 'Medium', prompt: 'Explain American Prohibition, why it passed, and why it failed.', description: 'Eighteenth Amendment, organized crime, and repeal politics.' },

  // —— Mechanics ——
  { title: 'How does a transistor work?', category: 'mechanics', difficulty: 'Hard', prompt: 'Explain how a transistor amplifies or switches electronic signals.', description: 'Semiconductors, gates, and the foundation of modern computing.' },
  { title: 'How does Grand Seiko\'s Spring Drive work?', category: 'mechanics', difficulty: 'Hard', prompt: 'Explain the Spring Drive movement and what makes it unique among watches.', description: 'Mechanical mainspring, glide wheel, and electromagnetic regulation.' },
  { title: 'How does a jet engine work?', category: 'mechanics', difficulty: 'Medium', prompt: 'Describe how a jet engine produces thrust.', description: 'Compression, combustion, turbines, and exhaust.' },
  { title: 'How does a mechanical watch escapement work?', category: 'mechanics', difficulty: 'Hard', prompt: 'Explain the escapement in a mechanical watch and why it matters.', description: 'Balance wheel, pallet fork, and controlled energy release.' },
  { title: 'How does a diesel engine differ from gasoline?', category: 'mechanics', difficulty: 'Medium', prompt: 'Compare diesel and gasoline engines and explain their different combustion cycles.', description: 'Compression ignition, efficiency, and torque characteristics.' },
  { title: 'How does a turbofan engine work?', category: 'mechanics', difficulty: 'Hard', prompt: 'Explain how a modern turbofan engine balances bypass air and core thrust.', description: 'Fan, bypass ratio, and fuel efficiency in commercial aviation.' },
  { title: 'How does a canal lock work?', category: 'mechanics', difficulty: 'Easy', prompt: 'Explain how canal locks raise and lower boats between different water levels.', description: 'Chambers, gates, and water displacement.' },
  { title: 'How does a differential gear work?', category: 'mechanics', difficulty: 'Hard', prompt: 'Explain how a differential allows car wheels to rotate at different speeds.', description: 'Cornering mechanics, ring gears, and torque distribution.' },
  { title: 'How does hydraulic braking work?', category: 'mechanics', difficulty: 'Medium', prompt: 'Describe how hydraulic brake systems transfer force from pedal to wheels.', description: 'Pascal\'s principle, brake fluid, and calipers.' },
  { title: 'How does a nuclear reactor control a chain reaction?', category: 'mechanics', difficulty: 'Hard', prompt: 'Explain how a nuclear reactor sustains and controls fission.', description: 'Control rods, moderators, coolant, and safety systems.' },

  // —— Science ——
  { title: 'How does photosynthesis work?', category: 'science', difficulty: 'Medium', prompt: 'Describe how plants convert sunlight into chemical energy.', description: 'Chlorophyll, light reactions, and the Calvin cycle.' },
  { title: 'What is quantum entanglement?', category: 'science', difficulty: 'Hard', prompt: 'Explain quantum entanglement in plain language and why it puzzled Einstein.', description: 'Correlated particles, measurement, and nonlocality.' },
  { title: 'How do black holes form?', category: 'science', difficulty: 'Hard', prompt: 'Explain how black holes are created and what makes them unique.', description: 'Stellar collapse, event horizons, and spacetime curvature.' },
  { title: 'What is CRISPR?', category: 'science', difficulty: 'Medium', prompt: 'Explain CRISPR gene editing and its promise and risks.', description: 'Guide RNA, Cas9, and therapeutic applications.' },
  { title: 'How does the immune system work?', category: 'science', difficulty: 'Medium', prompt: 'Explain how the human immune system defends against pathogens.', description: 'Innate immunity, adaptive immunity, and white blood cells.' },
  { title: 'What is plate tectonics?', category: 'science', difficulty: 'Medium', prompt: 'Describe plate tectonics and how it explains earthquakes and volcanoes.', description: 'Lithospheric plates, boundaries, and continental drift.' },
  { title: 'How does DNA replication work?', category: 'science', difficulty: 'Hard', prompt: 'Explain the process by which cells copy their DNA before division.', description: 'Helicase, polymerase, leading and lagging strands.' },
  { title: 'What is dark matter?', category: 'science', difficulty: 'Hard', prompt: 'Explain what dark matter is and why physicists think it exists.', description: 'Galaxy rotation curves, gravitational lensing, and detection efforts.' },

  // —— Culture ——
  { title: 'What defined Renaissance art?', category: 'culture', difficulty: 'Medium', prompt: 'Explain what defined Renaissance art and name its major figures.', description: 'Humanism, perspective, Michelangelo, and Da Vinci.' },
  { title: 'How did jazz originate?', category: 'culture', difficulty: 'Medium', prompt: 'Describe the origins and evolution of jazz music.', description: 'New Orleans, improvisation, blues influence, and global spread.' },
  { title: 'What is film noir?', category: 'culture', difficulty: 'Hard', prompt: 'Explain the characteristics and significance of film noir.', description: 'Visual style, moral ambiguity, and post-war American cinema.' },
  { title: 'What is magical realism?', category: 'culture', difficulty: 'Medium', prompt: 'Define magical realism and explain how it differs from fantasy.', description: 'Gabriel García Márquez, everyday wonder, and Latin American literature.' },
  { title: 'What is the hero\'s journey?', category: 'culture', difficulty: 'Medium', prompt: 'Explain Joseph Campbell\'s hero\'s journey and how storytellers use it.', description: 'Monomyth structure, departure-initiation-return, and modern films.' },
  { title: 'What is baroque music?', category: 'culture', difficulty: 'Medium', prompt: 'Describe the baroque period in music and its major composers.', description: 'Bach, Vivaldi, ornamentation, and basso continuo.' },
  { title: 'What is postmodernism in architecture?', category: 'culture', difficulty: 'Hard', prompt: 'Explain postmodern architecture and how it reacted against modernism.', description: 'Historical references, irony, and architects like Venturi and Graves.' },
  { title: 'What is the Bechdel test?', category: 'culture', difficulty: 'Easy', prompt: 'Explain the Bechdel test and what it does and does not measure about films.', description: 'Representation, narrative conventions, and feminist criticism.' },

  // —— Philosophy ——
  { title: 'What is the trolley problem?', category: 'philosophy', difficulty: 'Medium', prompt: 'Explain the trolley problem and what it reveals about ethics.', description: 'Utilitarianism, deontology, and moral dilemmas.' },
  { title: 'What is existentialism?', category: 'philosophy', difficulty: 'Hard', prompt: 'Describe the core ideas of existentialist philosophy.', description: 'Freedom, absurdity, authenticity, and thinkers like Sartre and Camus.' },
  { title: 'What is stoicism?', category: 'philosophy', difficulty: 'Medium', prompt: 'Explain the key principles of Stoic philosophy.', description: 'Virtue, control, acceptance, and Marcus Aurelius.' },
  { title: 'What is the free will vs determinism debate?', category: 'philosophy', difficulty: 'Hard', prompt: 'Discuss the philosophical debate around free will and determinism.', description: 'Compatibilism, libertarianism, and neuroscience.' },
  { title: 'What is utilitarianism?', category: 'philosophy', difficulty: 'Medium', prompt: 'Explain the ethical framework of utilitarianism.', description: 'Greatest good, consequences, and Bentham and Mill.' },
  { title: 'What is the veil of ignorance?', category: 'philosophy', difficulty: 'Medium', prompt: 'Explain John Rawls\' veil of ignorance and how it shapes theories of justice.', description: 'Original position, fairness, and distributive justice.' },
  { title: 'What is moral relativism?', category: 'philosophy', difficulty: 'Hard', prompt: 'Discuss moral relativism and its main criticisms.', description: 'Cultural context, universal ethics, and tolerance.' },
  { title: 'What is the ship of Theseus?', category: 'philosophy', difficulty: 'Medium', prompt: 'Explain the ship of Theseus paradox and what it asks about identity.', description: 'Persistence, replacement, and personal identity over time.' },

  // —— Economics ——
  { title: 'What is supply and demand?', category: 'economics', difficulty: 'Easy', prompt: 'Explain the basic economic principle of supply and demand.', description: 'Market equilibrium, price signals, and elasticity.' },
  { title: 'How does inflation work?', category: 'economics', difficulty: 'Medium', prompt: 'Describe what inflation is and what causes it.', description: 'Money supply, purchasing power, and central bank policy.' },
  { title: 'What is comparative advantage?', category: 'economics', difficulty: 'Hard', prompt: 'Explain comparative advantage in international trade.', description: 'Specialization, trade benefits, and Ricardo\'s theory.' },
  { title: 'What is game theory?', category: 'economics', difficulty: 'Hard', prompt: 'Describe game theory and how it applies to strategic decision-making.', description: 'Prisoner\'s dilemma, Nash equilibrium, and cooperation.' },
  { title: 'What is quantitative easing?', category: 'economics', difficulty: 'Hard', prompt: 'Explain quantitative easing and why central banks use it.', description: 'Bond buying, liquidity, and unconventional monetary policy.' },
  { title: 'What is the Laffer curve?', category: 'economics', difficulty: 'Medium', prompt: 'Explain the Laffer curve and the debate over tax cuts and revenue.', description: 'Tax rates, incentives, and supply-side economics.' },
  { title: 'What is the difference between monopoly and oligopoly?', category: 'economics', difficulty: 'Medium', prompt: 'Compare monopoly and oligopoly market structures with real-world examples.', description: 'Market power, barriers to entry, and antitrust.' },
  { title: 'What is GDP and what are its limits?', category: 'economics', difficulty: 'Medium', prompt: 'Explain what GDP measures and why economists criticize it.', description: 'Economic output, unpaid work, inequality, and well-being.' },
];

function cleanTopicQuery(title) {
  return String(title || '')
    .replace(/^(why do|why does|why is|why are|how do|how does|how did|how is|what is|what are|what was|what were|what caused|what makes|what defined|what does|should|is|are)\s+/i, '')
    .replace(/\?+$/, '')
    .trim();
}

function makeSources(title, description) {
  const curated = getSourcesForTopic(title);
  if (curated && curated.length) return curated;

  // Fallback if a topic is missing curated sources — still avoid Wikipedia.
  const cleaned = cleanTopicQuery(title) || title;
  const angles = String(description || '')
    .split(/[,;]/)
    .map((s) => s.trim().replace(/^and\s+/i, '').replace(/\.+$/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const labels = (angles.length ? angles : [cleaned]).slice(0, 4);
  return labels.map((label, i) => ({
    title: i === 0 ? `${title} — Overview` : label,
    site: 'Encyclopædia Britannica',
    url: `https://www.britannica.com/search?query=${encodeURIComponent(label)}`,
    description: 'Curated research notes unavailable; open Britannica for background.',
    bullets: [
      `Search Britannica for “${label}” related to ${cleaned}.`,
      'Prioritize peer-reviewed .gov and .edu explainers when taking notes.',
      'Record definitions, mechanisms, dates, and competing explanations.',
    ],
  }));
}

function generateTopics() {
  return TOPIC_TEMPLATES.map((t, i) => ({
    id: `topic-${String(i + 1).padStart(3, '0')}`,
    title: t.title,
    prompt: t.prompt,
    category: t.category,
    difficulty: t.difficulty,
    description: t.description,
    research_time: t.difficulty === 'Easy' ? 180 : t.difficulty === 'Hard' ? 420 : 300,
    sources: makeSources(t.title, t.description),
  }));
}

function formatTopicsReference() {
  const lines = ['Fathoms Practice Topics', `Generated: ${new Date().toISOString().slice(0, 10)}`, ''];
  for (const cat of TOPIC_CATEGORIES) {
    const topics = TOPIC_TEMPLATES.filter((t) => t.category === cat.id);
    lines.push(`=== ${cat.label.toUpperCase()} (${cat.id}) ===`);
    lines.push(cat.description);
    lines.push('');
    topics.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}`);
      lines.push(`   Prompt: ${t.prompt}`);
      lines.push(`   Difficulty: ${t.difficulty}`);
      lines.push('');
    });
    lines.push('');
  }
  lines.push(`Total topics: ${TOPIC_TEMPLATES.length}`);
  return lines.join('\n');
}

module.exports = {
  TOPIC_CATEGORIES,
  TOPIC_TEMPLATES,
  generateTopics,
  formatTopicsReference,
  makeSources,
};
