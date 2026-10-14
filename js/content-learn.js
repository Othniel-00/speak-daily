// Learning content for the five pillars (version 1.2). Works fully offline.

// Grammar Academy: three levels. Numbers are positions in C.GRAMMAR (content.js + content-extra.js + EXTRA_GRAMMAR below).
export const LEVELS = [
  { id: 1, name: 'Foundations', goal: 'Correct, simple sentences every time.', units: [0, 1, 2, 3, 8] },
  { id: 2, name: 'Building sentences', goal: 'Longer, connected sentences and clear questions.', units: [5, 4, 7, 9, 10] },
  { id: 3, name: 'Precision', goal: 'The details that make English sound educated.', units: [6, 11, 12, 13, 14] },
];
export const MASTERY = 0.75; // 6 of 8 right = mastered

export const EXTRA_GRAMMAR = [
  {
    title: 'If sentences (conditionals)',
    rule: 'For real possibilities, use "if" + present, then "will": If it rains, I will stay home. For imagined situations, use "if" + past, then "would": If I had a car, I would drive to work. Do not put "will" or "would" after "if".',
    examples: [['If you will come, I will cook.', 'If you come, I will cook.'], ['If I would have money, I would buy a laptop.', 'If I had money, I would buy a laptop.'], ['If he study, he will pass.', 'If he studies, he will pass.']],
    quiz: [
      { q: 'If it ___ tomorrow, the match will be cancelled.', o: ['will rain', 'rains', 'rained'], a: 1 },
      { q: 'If I ___ rich, I would build a school.', o: ['am', 'was', 'were'], a: 2 },
      { q: 'If you heat ice, it ___.', o: ['melts', 'melted', 'would melt'], a: 0 },
      { q: 'If she calls, I ___ tell her.', o: ['would', 'will', 'am'], a: 1 },
      { q: 'If we ___ earlier, we would catch the bus.', o: ['left', 'leave', 'will leave'], a: 0 },
      { q: 'I ___ help you if I had time.', o: ['will', 'would', 'am'], a: 1 },
      { q: 'If he ___ hard, he will pass the exam.', o: ['study', 'studies', 'would study'], a: 1 },
      { q: 'What would you do if you ___ the president?', o: ['are', 'were', 'will be'], a: 1 },
    ],
  },
  {
    title: 'Passive voice (it was done)',
    rule: 'Use the passive when the action matters more than the person who did it: form of "be" + past participle. The road was built in 2020. English is spoken in Liberia. Add "by" only if the person is important: The book was written by a Liberian author.',
    examples: [['The bridge was build last year.', 'The bridge was built last year.'], ['English is speak in Liberia.', 'English is spoken in Liberia.'], ['The results will announced tomorrow.', 'The results will be announced tomorrow.']],
    quiz: [
      { q: 'The letters ___ yesterday.', o: ['was sent', 'were sent', 'were send'], a: 1 },
      { q: 'Rice ___ in many parts of Liberia.', o: ['is grown', 'is grow', 'grown'], a: 0 },
      { q: 'The exam results ___ next week.', o: ['will announce', 'will be announced', 'are announce'], a: 1 },
      { q: 'This phone ___ in China.', o: ['was made', 'was make', 'made'], a: 0 },
      { q: 'The classroom ___ every morning.', o: ['is cleaned', 'is clean', 'cleaned'], a: 0 },
      { q: 'The thief ___ by the police.', o: ['was caught', 'was catched', 'caught'], a: 0 },
      { q: 'A new road ___ now.', o: ['is being built', 'is building', 'built'], a: 0 },
      { q: 'The song ___ by millions of people.', o: ['has been heard', 'has heard', 'have been hear'], a: 0 },
    ],
  },
  {
    title: 'Reporting what people said',
    rule: 'When you report someone\'s words later, move the verb one step back in time and change the pronouns: "I am tired," she said → She said (that) she was tired. Use "told" with a person: He told me… Use "said" without one: He said… For questions, use normal word order: She asked where I lived (not "where did I live").',
    examples: [['He said me that he is busy.', 'He told me that he was busy.'], ['She asked where do I live.', 'She asked where I lived.'], ['They told that they will come.', 'They said that they would come.']],
    quiz: [
      { q: '"I am hungry," he said. → He said he ___ hungry.', o: ['is', 'was', 'were'], a: 1 },
      { q: 'She ___ me she was leaving.', o: ['said', 'told', 'say'], a: 1 },
      { q: 'He ___ that the class was cancelled.', o: ['told', 'said', 'tell'], a: 1 },
      { q: '"Where do you live?" → She asked where I ___.', o: ['live', 'lived', 'did live'], a: 1 },
      { q: '"I will call you," he said. → He said he ___ call me.', o: ['will', 'would', 'can'], a: 1 },
      { q: '"Are you ready?" → They asked ___ I was ready.', o: ['if', 'that', 'are'], a: 0 },
      { q: '"We finished the project." → They said they ___ the project.', o: ['had finished', 'finish', 'have finish'], a: 0 },
      { q: 'The teacher ___ us to open our books.', o: ['said', 'told', 'asked that'], a: 1 },
    ],
  },
];

// Pronunciation: focus sounds. Tips describe standard clear English; any accent is fine as long as words are clear.
export const SOUNDS = [
  {
    id: 'th', title: 'The "th" sounds', tip: 'Put the tip of your tongue lightly between your teeth and blow air out. Quiet for "think", buzzing for "this". Keep "three" different from "tree".',
    words: ['think', 'three', 'thank you', 'this', 'that', 'mother', 'birthday', 'together'],
    pairs: [['tree', 'three'], ['dis', 'this'], ['tank', 'thank'], ['den', 'then']],
    sentence: 'I think these three things will help us together this Thursday.',
  },
  {
    id: 'endings', title: 'Word endings: -ed, -t, -d', tip: 'Finish every word. The last sound often carries the meaning: "walk" is now, "walked" is the past. Say the ending clearly before the next word.',
    words: ['walked', 'asked', 'helped', 'finished', 'first', 'last night', 'old', 'world'],
    pairs: [['walk', 'walked'], ['ask', 'asked'], ['fine', 'find'], ['pass', 'passed']],
    sentence: 'Last night I asked my friend, and he helped me finish the first test.',
  },
  {
    id: 's', title: 'Word endings: -s and -es', tip: 'Do not drop the final "s". It shows more than one (books) or he/she (he works). After s, sh, ch, x, add an extra small syllable: watches, boxes.',
    words: ['books', 'students', 'works', 'watches', 'boxes', 'months', 'texts', 'costs'],
    pairs: [['book', 'books'], ['work', 'works'], ['cost', 'costs'], ['month', 'months']],
    sentence: 'She works hard and reads two books every month for her classes.',
  },
  {
    id: 'vb', title: '"v" and "b", "f" and "p"', tip: 'For "v" and "f", touch your top teeth to your bottom lip and push air through. For "b" and "p", close both lips, then open them.',
    words: ['very', 'voice', 'video', 'have', 'office', 'phone', 'value', 'never'],
    pairs: [['berry', 'very'], ['ban', 'van'], ['pan', 'fan'], ['best', 'vest']],
    sentence: 'Your voice is very valuable, so never be afraid to speak.',
  },
  {
    id: 'stress', title: 'Word stress', tip: 'In long English words, one part is louder and longer. Saying the wrong part makes words hard to recognise. Clap on the strong part.',
    words: ['PHOtograph', 'phoTOgraphy', 'deVELopment', 'ecoNOmic', 'comMUnicate', 'eDUcation', 'imPORtant', 'TEchnology'],
    pairs: [['PREsent (gift)', 'preSENT (to show)'], ['REcord (noun)', 'reCORD (verb)'], ['OBject', 'obJECT'], ['CONtract', 'conTRACT']],
    sentence: 'Education is important for the economic development of every community.',
  },
  {
    id: 'pace', title: 'Pausing and pace', tip: 'Pause at commas and full stops. Slow down for important words. Speaking a little slower almost always sounds more confident, not less.',
    words: ['First,', 'However,', 'In my opinion,', 'For example,', 'Finally,', 'To sum up,', 'Most importantly,', 'On the other hand,'],
    pairs: [],
    sentence: 'First, I will explain the problem. Then, I will share two ideas. Finally, I will answer your questions.',
  },
];

// Communication: patterns for clear answers, stories, requests and messages.
export const COMMUNICATION = [
  {
    id: 'prep', title: 'Answer any question clearly', pattern: 'Point → Reason → Example → Point',
    explain: 'Say your answer first. Give one reason. Add a short example. Repeat your answer in different words. This keeps you from rambling and makes you sound confident.',
    model: 'I think every student should learn to type. The main reason is speed: typing saves hours of work. For example, I typed my midterm report in one evening instead of three days by hand. So typing is a small skill that gives back a lot of time.',
    phrases: ['I think…', 'The main reason is…', 'For example,…', 'So, in short,…'],
    task: 'Should phones be allowed in class? Answer in 45 seconds using Point, Reason, Example, Point.', mode: 'speak',
  },
  {
    id: 'story', title: 'Tell a short story', pattern: 'Situation → Problem → Action → Result',
    explain: 'People remember stories. Set the scene in one sentence, name the problem, say what you did, and finish with what happened and what you learned.',
    model: 'Last year, our group had to present a project, but our leader got sick the night before. I offered to present his part, so I stayed up and practised it four times. The next day the presentation went well, and I learned that preparation removes most fear.',
    phrases: ['Last year,…', 'The problem was…', 'So I decided to…', 'In the end,…', 'What I learned was…'],
    task: 'Tell a 1-minute story about a time you solved a problem.', mode: 'speak',
  },
  {
    id: 'intro', title: 'Introduce yourself', pattern: 'Who → What you do → What you care about → A question',
    explain: 'A good introduction is short and gives the other person something to ask about. End with a question so the conversation continues.',
    model: 'Hi, I\'m Othniel. I\'m a university student in Monrovia, and I\'m very interested in technology and business. Lately I\'ve been building small web apps. What about you, what are you working on?',
    phrases: ['Hi, I\'m…', 'I\'m studying…', 'I\'m really interested in…', 'What about you?'],
    task: 'Introduce yourself in 30 seconds as if you are meeting a new lecturer.', mode: 'speak',
  },
  {
    id: 'polite', title: 'Ask, agree and disagree politely', pattern: 'Soft start → Clear point → Reason',
    explain: 'Polite English uses soft openings. You can still be clear and firm. Disagree with the idea, never attack the person.',
    model: 'Could you help me with something? … I see your point, but I don\'t fully agree. I think the meeting should be on Friday, because more people are free then.',
    phrases: ['Could you please…?', 'Would you mind…?', 'I see your point, but…', 'I\'m not sure I agree, because…', 'That\'s a good idea. We could also…'],
    task: 'A classmate says group work is a waste of time. Politely disagree in 45 seconds.', mode: 'speak',
  },
  {
    id: 'present', title: 'Guide listeners through a talk', pattern: 'Preview → Signposts → Summary',
    explain: 'Tell people where you are going, use signpost words as you move, and end with a summary. Listeners relax when they know the plan.',
    model: 'Today I\'ll cover three things: what demand is, what supply is, and how prices are set. First, demand… Next, supply… Finally, price… To sum up, price is where demand and supply meet.',
    phrases: ['Today I\'ll cover…', 'First,…', 'Moving on to…', 'Finally,…', 'To sum up,…'],
    task: 'Give a 1-minute mini-presentation on a topic from one of your classes, using signposts.', mode: 'speak',
  },
  {
    id: 'message', title: 'Write a clear message or email', pattern: 'Greeting → Purpose → Details → Request → Thanks',
    explain: 'Put your purpose in the first sentence. Keep details short. End with exactly what you want the reader to do.',
    model: 'Good morning Mr. Johnson,\nI am writing to ask for an extension on the networking report. I was sick on Monday and Tuesday and have a doctor\'s note. Could I submit it on Friday instead of Wednesday?\nThank you for your understanding.\nOthniel',
    phrases: ['I am writing to…', 'Could you please…?', 'I would be grateful if…', 'Thank you for your time.'],
    task: 'Write a short email to a lecturer asking a question about an assignment.', mode: 'write',
  },
];

// Conversation practice scenarios (opened in the Coach in role-play mode).
export const SCENARIOS = [
  { id: 'interview', title: 'Job interview', start: 'Let\'s practise a job interview. You are the interviewer for an internship at a tech company in Monrovia. Ask me one question at a time.' },
  { id: 'class', title: 'Answer a lecturer', start: 'You are my lecturer. Ask me questions about a topic from my business and economics class, one at a time, and push me to explain clearly.' },
  { id: 'customer', title: 'Help a customer', start: 'You are a customer in my phone repair shop. Your phone will not charge. Start the conversation.' },
  { id: 'phone', title: 'Phone call', start: 'Let\'s practise a phone call. You are a receptionist at a hospital and I am calling to book an appointment. Start by answering the phone.' },
  { id: 'pitch', title: 'Pitch an idea', start: 'You are an investor. I will pitch you a small business idea in 1 minute. Then ask me 3 tough questions, one at a time.' },
  { id: 'debate', title: 'Friendly debate', start: 'Let\'s have a friendly debate. Pick a topic about technology in Africa, take the opposite side to me, and challenge my reasons politely.' },
];
