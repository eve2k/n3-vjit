import { fukushuu1 } from './fukushuu1.js';
import { renshuu2 } from './renshuu2.js';
import { renshuu3 } from './renshuu3.js';
import { renshuu4 } from './renshuu4.js';
import { renshuu5 } from './renshuu5.js';
import { dokkai } from './dokkai.js';
import { choukai } from './choukai.js';
import { kaiwa, sakubun } from './kaiwa_sakubun.js';
import { flashcards } from './flashcards.js';

export const QUIZ_SECTIONS = [
  { id: 'fukushuu1', label: '復習1', title: '復習1 · Câu đồng nghĩa', questions: fukushuu1 },
  { id: 'renshuu2', label: '練習2', title: '練習2 · Từ vựng & collocation', questions: renshuu2 },
  { id: 'renshuu3', label: '練習3', title: '練習3 · Kanji', questions: renshuu3 },
  { id: 'renshuu4', label: '練習4', title: '練習4 · Ngữ pháp', questions: renshuu4 },
  { id: 'renshuu5', label: '練習5', title: '練習5 · Chia thể', questions: renshuu5 },
];

export const quizSections = QUIZ_SECTIONS;
export const ALL_QUIZ_QUESTIONS = QUIZ_SECTIONS.flatMap((s) => s.questions);
export const allQuizQuestions = ALL_QUIZ_QUESTIONS;
export const QUIZ_TOTAL = ALL_QUIZ_QUESTIONS.length;

const DECK_META = {
  deck1: { title: 'Deck 1 · 44 câu đồng nghĩa', subtitle: '復習1' },
  deck2: { title: 'Deck 2 · 65 collocation', subtitle: '練習2' },
  deck3: { title: 'Deck 3 · 50 Kanji', subtitle: '練習3' },
  deck4: { title: 'Deck 4 · 30 ngữ pháp', subtitle: '練習4 & 練習5' },
};

export const flashcardDecks = Object.fromEntries(
  Object.entries(flashcards).map(([id, cards]) => [
    id,
    {
      id,
      title: DECK_META[id]?.title || id,
      subtitle: DECK_META[id]?.subtitle || '',
      cards: cards.map((c) => ({ ...c, extra: c.note || c.extra || '' })),
    },
  ]),
);

export const kaiwaSakubun = {
  kaiwa: kaiwa.map((k) => ({
    ...k,
    qa: k.items || k.qa || [],
    notes: (k.grammar || k.outline || []).join(' · '),
  })),
  sakubun,
};

export {
  fukushuu1,
  renshuu2,
  renshuu3,
  renshuu4,
  renshuu5,
  dokkai,
  choukai,
  kaiwa,
  sakubun,
  flashcards,
};
