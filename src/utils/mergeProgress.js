import { newerSrsRecord } from './spacedRepetition.js';
import { mergeStudyRoadmaps } from './studyRoadmap.js';
const union = (left = [], right = []) => [...new Set([...left, ...right])];

export function mergeProgress(account, guest) {
  const merged = { ...guest, ...account };
  if (account.n3vjit_studyRoadmap || guest.n3vjit_studyRoadmap) merged.n3vjit_studyRoadmap = mergeStudyRoadmaps(account.n3vjit_studyRoadmap, guest.n3vjit_studyRoadmap);
  if (account.n3vjit_spacedRepetition || guest.n3vjit_spacedRepetition) {
    merged.n3vjit_spacedRepetition = Object.assign(Object.create(null), guest.n3vjit_spacedRepetition);
    for (const [key, item] of Object.entries(account.n3vjit_spacedRepetition || {})) merged.n3vjit_spacedRepetition[key] = newerSrsRecord(merged.n3vjit_spacedRepetition[key], item);
  }
  const completedKey = 'n3vjit_completedQuestions';
  merged[completedKey] = Object.assign(Object.create(null), guest[completedKey], account[completedKey]);
  for (const section of Object.keys(guest[completedKey] || {})) merged[completedKey][section] = union(account[completedKey]?.[section], guest[completedKey][section]);
  merged.n3vjit_masteredFlashcards = union(account.n3vjit_masteredFlashcards, guest.n3vjit_masteredFlashcards);
  merged.n3vjit_dokkaiProgress = { ...guest.n3vjit_dokkaiProgress, ...account.n3vjit_dokkaiProgress };
  for (const [id, done] of Object.entries(guest.n3vjit_dokkaiProgress || {})) if (done) merged.n3vjit_dokkaiProgress[id] = true;
  merged.n3vjit_customSakubun = { ...guest.n3vjit_customSakubun, ...account.n3vjit_customSakubun };
  for (const [id, item] of Object.entries(guest.n3vjit_customSakubun || {})) {
    const existing = account.n3vjit_customSakubun?.[id];
    if (!existing || Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)) merged.n3vjit_customSakubun[id] = item;
  }
  merged.n3vjit_userProfile = { ...guest.n3vjit_userProfile, ...account.n3vjit_userProfile };
  const history = new Map();
  for (const result of [...(guest.n3vjit_quizHistory || []), ...(account.n3vjit_quizHistory || [])]) history.set(result.id || JSON.stringify([result.date, result.mode, result.total, result.correct, result.elapsed]), result);
  merged.n3vjit_quizHistory = [...history.values()].sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  merged.n3vjit_wrongQuestions = Object.assign(Object.create(null), Object.fromEntries(Object.entries(account.n3vjit_wrongQuestions || {}).map(([section, questions]) => [section, Object.assign(Object.create(null), questions)])));
  for (const [section, questions] of Object.entries(guest.n3vjit_wrongQuestions || {})) {
    merged.n3vjit_wrongQuestions[section] ||= Object.create(null);
    for (const [id, item] of Object.entries(questions)) {
      const existing = merged.n3vjit_wrongQuestions[section][id];
      merged.n3vjit_wrongQuestions[section][id] = existing ? { count: Math.max(existing.count, item.count), correctStreak: Math.max(existing.correctStreak, item.correctStreak) } : item;
    }
  }
  return merged;
}
