import { validMasteryProgress } from './masteryLearning.js';
// localStorage utility for managing study progress
import { scheduleReview, srsKey, studyDay, validSrsRecord } from './spacedRepetition.js';
import { defaultExamDate, validStudyRoadmap } from './studyRoadmap.js';
import { createId } from './id.js';
import { canonicalReviewKey } from './reviewQuestionIds.js';
import { emptyReviewProgress, recordReviewResult, beginReview, answerReview, advanceReview, finishReview, closeReview, validReviewProgress } from './reviewProgress.js';

const STORAGE_KEYS = {
  COMPLETED_QUESTIONS: 'n3vjit_completedQuestions',
  WRONG_QUESTIONS: 'n3vjit_wrongQuestions',
  MASTERED_FLASHCARDS: 'n3vjit_masteredFlashcards',
  CUSTOM_SAKUBUN: 'n3vjit_customSakubun',
  USER_PROFILE: 'n3vjit_userProfile',
  THEME: 'n3vjit_theme',
  QUIZ_HISTORY: 'n3vjit_quizHistory',
  DOKKAI_PROGRESS: 'n3vjit_dokkaiProgress',
  LAST_LESSON: 'n3vjit_lastLesson',
  SPACED_REPETITION: 'n3vjit_spacedRepetition',
  STUDY_ROADMAP: 'n3vjit_studyRoadmap',
  POMODORO_LEARNING: 'n3vjit_pomodoroLearning',
  MASTERY: 'n3vjit_mastery',
  REVIEW: 'n3vjit_review',
};

let storageUserId = null;
const scopedKey = (key, userId = storageUserId) => key === STORAGE_KEYS.THEME || !userId ? key : `n3vjit_account:${encodeURIComponent(userId)}:${key}`;

export const setStorageUser = (userId) => { storageUserId = userId || null; };

function notifyProgressWrite(userId = storageUserId, key = null) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('n3vjit:progress-write', { detail: { userId, key } }));
}

// ===== Generic Helpers =====

const getItem = (key, defaultValue = null) => {
  if (!storageUserId && key !== STORAGE_KEYS.THEME) return defaultValue;
  try {
    const item = localStorage.getItem(scopedKey(key));
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return defaultValue;
  }
};

const setItem = (key, value) => {
  // Guests may finish a practice session, but never persist learning data.
  if (!storageUserId && key !== STORAGE_KEYS.THEME) return true;
  try {
    localStorage.setItem(scopedKey(key), JSON.stringify(value));
    notifyProgressWrite(storageUserId, key);
    return true;
  } catch (e) {
    console.error(`Error writing ${key} to localStorage:`, e);
    return false;
  }
};

export const getMasteryProgress = () => getItem(STORAGE_KEYS.MASTERY, { cards: {}, nodes: {} });
export const saveMasteryProgress = value => { if (!validMasteryProgress(value)) throw new Error('Tiến độ học không hợp lệ.'); if (!setItem(STORAGE_KEYS.MASTERY, value)) throw new Error('Không thể lưu tiến độ trên thiết bị.'); };

export const getReviewProgress = () => getItem(STORAGE_KEYS.REVIEW, emptyReviewProgress());

// Commit related records together and notify sync only after all writes succeed.
function setProgressItems(entries) {
  if (!storageUserId) return;
  for (const [key, value] of entries) if (!validators[key]?.(value)) throw new Error('Dữ liệu tiến độ không hợp lệ.');
  const previous = entries.map(([key]) => [scopedKey(key), localStorage.getItem(scopedKey(key))]);
  try {
    entries.forEach(([key, value]) => localStorage.setItem(scopedKey(key), JSON.stringify(value)));
  } catch {
    previous.forEach(([key, value]) => { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); });
    throw new Error('Không thể lưu tiến độ trên thiết bị. Chưa chốt kết quả kiểm tra.');
  }
  notifyProgressWrite();
}

const reviewOptions = (options = {}, previous = null) => ({ ...options,
  now: options.now ?? Math.max(Date.now(), (Date.parse(previous?.updatedAt || '') || 0) + 1), updateId: options.updateId ?? createId() });
const requireReviewUser = () => { if (!storageUserId) throw new Error('Đăng nhập để kiểm tra và lưu tiến độ.'); };

export const recordQuestionResult = (section, questionId, correct, options = {}) => {
  if (!storageUserId) return;
  const progress = recordReviewResult(getReviewProgress(), `${section}:${questionId}`, correct, reviewOptions(options));
  setProgressItems([[STORAGE_KEYS.REVIEW, progress]]);
};

export const startReviewTest = (settings, options = {}) => {
  requireReviewUser();
  const previous = getReviewProgress();
  const progress = beginReview(previous, getMasteryProgress(), settings, reviewOptions(options, previous.session));
  setProgressItems([[STORAGE_KEYS.REVIEW, progress]]);
  return progress.session;
};

export const saveReviewAnswer = (sessionId, key, response, options = {}) => {
  requireReviewUser();
  const previous = getReviewProgress();
  const progress = answerReview(previous, sessionId, key, response, reviewOptions(options, previous.session));
  if (progress !== previous) setProgressItems([[STORAGE_KEYS.REVIEW, progress]]);
  return progress.session;
};

export const finishReviewTest = (sessionId, options = {}) => {
  requireReviewUser();
  const previous = getReviewProgress();
  const result = finishReview(previous, getMasteryProgress(), sessionId, reviewOptions(options, previous.session));
  if (result.summary) setProgressItems([[STORAGE_KEYS.MASTERY, result.mastery], [STORAGE_KEYS.REVIEW, result.progress]]);
  return result.summary;
};

export const advanceReviewQuestion = (sessionId, options = {}) => {
  requireReviewUser();
  const previous = getReviewProgress();
  const progress = advanceReview(previous, sessionId, reviewOptions(options, previous.session));
  if (progress !== previous) setProgressItems([[STORAGE_KEYS.REVIEW, progress]]);
  return progress.session;
};

export const cancelReviewTest = (sessionId, options = {}) => {
  requireReviewUser();
  const previous = getReviewProgress();
  const { now, updateId } = reviewOptions(options, previous.session);
  setProgressItems([[STORAGE_KEYS.REVIEW, closeReview(previous, sessionId, now, updateId)]]);
};

// Legacy completion and mistake IDs stay untouched. Only new actual answers
// create latest-result records; no inference/backfill from old progress.
function saveQuestionOutcome(wrong, section, questionId, correct, options) {
  const entries = [[STORAGE_KEYS.WRONG_QUESTIONS, wrong]];
  const key = canonicalReviewKey(`${section}:${questionId}`);
  if (storageUserId && (key.startsWith('renshuu4:') || key.startsWith('dokkai:'))) {
    entries.push([STORAGE_KEYS.REVIEW, recordReviewResult(getReviewProgress(), key, correct, reviewOptions(options))]);
  }
  setProgressItems(entries);
}

// ===== Completed Questions =====

export const getCompletedQuestions = () => {
  return getItem(STORAGE_KEYS.COMPLETED_QUESTIONS, {});
};

export const markQuestionCompleted = (section, questionId) => {
  const completed = getCompletedQuestions();
  if (!completed[section]) {
    completed[section] = [];
  }
  if (!completed[section].includes(questionId)) {
    completed[section].push(questionId);
  }
  setItem(STORAGE_KEYS.COMPLETED_QUESTIONS, completed);
};

export const getCompletedCount = (section = null) => {
  const completed = getCompletedQuestions();
  if (section) {
    return (completed[section] || []).length;
  }
  return Object.values(completed).reduce((sum, arr) => sum + arr.length, 0);
};

// ===== Wrong Questions (Mistake Notebook) =====

export const getWrongQuestions = () => {
  return getItem(STORAGE_KEYS.WRONG_QUESTIONS, {});
};

export const addWrongQuestion = (section, questionId, options = {}) => {
  const wrong = getWrongQuestions();
  if (!wrong[section]) {
    wrong[section] = {};
  }
  if (!wrong[section][questionId]) {
    wrong[section][questionId] = { count: 0, correctStreak: 0 };
  }
  wrong[section][questionId].count += 1;
  wrong[section][questionId].correctStreak = 0;
  saveQuestionOutcome(wrong, section, questionId, false, options);
};

export const markWrongQuestionCorrect = (section, questionId, options = {}) => {
  const wrong = getWrongQuestions();
  if (wrong[section] && wrong[section][questionId]) {
    wrong[section][questionId].correctStreak += 1;
    // Remove from wrong list after 2 consecutive correct answers
    if (wrong[section][questionId].correctStreak >= 2) {
      delete wrong[section][questionId];
      if (Object.keys(wrong[section]).length === 0) {
        delete wrong[section];
      }
    }
  }
  saveQuestionOutcome(wrong, section, questionId, true, options);
};

export const getWrongQuestionCount = () => {
  const wrong = getWrongQuestions();
  return Object.values(wrong).reduce(
    (sum, section) => sum + Object.keys(section).length, 0
  );
};

export const getAllWrongQuestionIds = () => {
  const wrong = getWrongQuestions();
  const ids = [];
  Object.entries(wrong).forEach(([section, questions]) => {
    Object.keys(questions).forEach(qId => {
      ids.push({ section, questionId: qId });
    });
  });
  return ids;
};

// ===== Mastered Flashcards =====

export const getMasteredFlashcards = () => {
  return getItem(STORAGE_KEYS.MASTERED_FLASHCARDS, []);
};

export const toggleFlashcardMastered = (cardId) => {
  const mastered = getMasteredFlashcards();
  const index = mastered.indexOf(cardId);
  if (index === -1) {
    mastered.push(cardId);
  } else {
    mastered.splice(index, 1);
  }
  setItem(STORAGE_KEYS.MASTERED_FLASHCARDS, mastered);
  return mastered;
};

export const isFlashcardMastered = (cardId) => {
  return getMasteredFlashcards().includes(cardId);
};

// ===== Custom Sakubun (User writings) =====

export const getCustomSakubun = () => {
  return getItem(STORAGE_KEYS.CUSTOM_SAKUBUN, {});
};

export const saveCustomSakubun = (topicId, text) => {
  const sakubun = getCustomSakubun();
  sakubun[topicId] = { text, updatedAt: new Date().toISOString() };
  setItem(STORAGE_KEYS.CUSTOM_SAKUBUN, sakubun);
};

// ===== User Profile (for Kaiwa/Sakubun personalization) =====

export const getUserProfile = () => {
  return {
    name: '',
    birthday: '',
    major: '',
    familyMembers: '',
    hobbies: '',
    ...getItem(STORAGE_KEYS.USER_PROFILE, {}),
  };
};

export const saveUserProfile = (profile) => {
  setItem(STORAGE_KEYS.USER_PROFILE, profile);
};

// ===== Theme =====

export const getTheme = () => {
  const theme = getItem(STORAGE_KEYS.THEME, 'modern');
  return theme === 'dark' || theme === 'yorha' ? 'dark' : 'modern';
};

export const setTheme = (theme) => {
  setItem(STORAGE_KEYS.THEME, theme === 'dark' || theme === 'yorha' ? 'dark' : 'modern');
};

// ===== Quiz History =====

export const getQuizHistory = () => {
  return getItem(STORAGE_KEYS.QUIZ_HISTORY, []);
};

export const addQuizResult = (result) => {
  const history = getQuizHistory();
  history.push({ ...result, date: new Date().toISOString() });
  setItem(STORAGE_KEYS.QUIZ_HISTORY, history);
};

export const saveQuizAttempt = (result) => {
  const history = getQuizHistory();
  const index = history.findIndex((attempt) => attempt.id === result.id);
  const entry = { ...result, date: index === -1 ? new Date().toISOString() : history[index].date };
  if (index === -1) history.push(entry);
  else history[index] = entry;
  if (!setItem(STORAGE_KEYS.QUIZ_HISTORY, history)) throw new Error('Không lưu được kết quả. Hãy kiểm tra dung lượng lưu trữ của trình duyệt rồi thử lại.');
  return entry;
};

export const getLastLesson = () => getItem(STORAGE_KEYS.LAST_LESSON, null);

export const saveLastLesson = (sectionId, questionId) => {
  setItem(STORAGE_KEYS.LAST_LESSON, { sectionId, questionId });
};

export const getSpacedRepetition = () => getItem(STORAGE_KEYS.SPACED_REPETITION, {});

export const getStudyRoadmap = () => getItem(STORAGE_KEYS.STUDY_ROADMAP, null);

export const getPomodoroLearning = () => getItem(STORAGE_KEYS.POMODORO_LEARNING, { cycles: [], events: [] });

export const savePomodoroLearning = (progress) => {
  if (!validPomodoroLearning(progress)) throw new Error('Dữ liệu học Pomodoro không hợp lệ.');
  if (!setItem(STORAGE_KEYS.POMODORO_LEARNING, progress)) throw new Error('Chưa lưu được tiến độ Pomodoro.');
  return progress;
};

export const ensureStudyRoadmap = (loginAt, now = Date.now()) => {
  if (!storageUserId || getStudyRoadmap()) return;
  const today = studyDay(now);
  const login = Date.parse(loginAt);
  const startDate = Number.isFinite(login) && login <= now ? studyDay(login) : today;
  const plan = { startDate, examDate: defaultExamDate(today), customExam: false, updatedAt: new Date(now).toISOString() };
  if (!setItem(STORAGE_KEYS.STUDY_ROADMAP, plan)) throw new Error('Chưa lưu được lộ trình học.');
};

export const saveStudyExamDate = (examDate, now = Date.now()) => {
  if (!storageUserId) throw new Error('Đăng nhập để lưu ngày thi.');
  const previous = getStudyRoadmap();
  const plan = { startDate: previous?.startDate || studyDay(now), examDate, customExam: true, updatedAt: new Date(now).toISOString() };
  if (!validStudyRoadmap(plan) || examDate <= studyDay(now)) throw new Error('Chọn ngày thi từ ngày mai trở đi.');
  if (!setItem(STORAGE_KEYS.STUDY_ROADMAP, plan)) throw new Error('Chưa lưu được ngày thi.');
  return plan;
};

export const recordSpacedAnswer = (question, correct, options) => {
  if (!storageUserId) return null;
  const records = getSpacedRepetition();
  const key = srsKey(question);
  const previous = records[key];
  const isNew = !(getCompletedQuestions()[question.section] || []).includes(question.id);
  const next = scheduleReview(previous, correct, { ...options, isNew, studyPlan: getStudyRoadmap(), questionKey: key });
  if (next !== previous) {
    const updated = Object.assign(Object.create(null), records, { [key]: next });
    if (!setItem(STORAGE_KEYS.SPACED_REPETITION, updated)) throw new Error('Chưa lưu được lịch ôn. Hãy kiểm tra dung lượng lưu trữ rồi thử lại.');
  }
  return next;
};

// ===== Dokkai Progress =====

export const getDokkaiProgress = () => {
  return getItem(STORAGE_KEYS.DOKKAI_PROGRESS, {});
};

export const markDokkaiCompleted = (passageId) => {
  const progress = getDokkaiProgress();
  progress[passageId] = true;
  setItem(STORAGE_KEYS.DOKKAI_PROGRESS, progress);
};

// ===== Export/Import Progress =====

export const exportProgress = () => {
  if (!storageUserId) throw new Error('Đăng nhập để sao lưu tiến độ.');
  const data = {};
  Object.values(STORAGE_KEYS).forEach(key => {
    const value = localStorage.getItem(scopedKey(key));
    if (value) {
      data[key] = JSON.parse(value);
    }
  });
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `n3vjit_progress_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isStringArray = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const isCount = value => Number.isInteger(value) && value >= 0;
const isScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
const validPomodoroLearning = value => isRecord(value) && Array.isArray(value.cycles) && value.cycles.every(cycle =>
  isRecord(cycle) && typeof cycle.id === 'string' && typeof cycle.startedAt === 'string' &&
  (cycle.completedAt === null || typeof cycle.completedAt === 'string')) && Array.isArray(value.events) && value.events.every(event =>
  isRecord(event) && typeof event.id === 'string' && typeof event.unitId === 'string' && typeof event.cycleId === 'string' &&
  ['quiz', 'reading', 'flashcard'].includes(event.contentType) && typeof event.correct === 'boolean' && typeof event.at === 'string' && isCount(event.dueAtStep));
const isMockAttempt = item => {
  if (item.mode !== 'mock-exam') return true;
  const parts = ['reading', 'passages', 'listening', 'writing'];
  return typeof item.id === 'string' && isRecord(item.exam) && item.exam.id === item.id &&
    isStringArray(item.exam.reading) && item.exam.reading.length === 35 &&
    isStringArray(item.exam.passages) && item.exam.passages.length === 2 &&
    isStringArray(item.exam.listening) && item.exam.listening.length === 30 && typeof item.exam.writing === 'string' &&
    isRecord(item.answers) && Object.values(item.answers).every(value => typeof value === 'string') &&
    typeof item.writingText === 'string' && isRecord(item.manualScores) && Object.values(item.manualScores).every(isScore) &&
    Array.isArray(item.sections) && item.sections.length === 4 && new Set(item.sections.map(part => part?.id)).size === 4 &&
    item.sections.every(part => isRecord(part) && parts.includes(part.id) && typeof part.label === 'string' &&
      (part.score === null || isScore(part.score)) && (['passed', 'failed', 'pending'].includes(part.status) || (part.id === 'writing' && part.status === 'excluded'))) &&
    ['passed', 'failed', 'pending'].includes(item.status) && isCount(item.elapsed);
};

const validators = {
  [STORAGE_KEYS.SPACED_REPETITION]: value => isRecord(value) && Object.values(value).every(validSrsRecord),
  [STORAGE_KEYS.STUDY_ROADMAP]: validStudyRoadmap,
  [STORAGE_KEYS.POMODORO_LEARNING]: validPomodoroLearning,
  [STORAGE_KEYS.MASTERY]: validMasteryProgress,
  [STORAGE_KEYS.REVIEW]: validReviewProgress,
  [STORAGE_KEYS.COMPLETED_QUESTIONS]: value => isRecord(value) && Object.values(value).every(isStringArray),
  [STORAGE_KEYS.WRONG_QUESTIONS]: value => isRecord(value) && Object.values(value).every(section =>
    isRecord(section) && Object.values(section).every(item => isRecord(item) && isCount(item.count) && isCount(item.correctStreak))),
  [STORAGE_KEYS.MASTERED_FLASHCARDS]: isStringArray,
  [STORAGE_KEYS.CUSTOM_SAKUBUN]: value => isRecord(value) && Object.values(value).every(item =>
    isRecord(item) && typeof item.text === 'string' && typeof item.updatedAt === 'string'),
  [STORAGE_KEYS.USER_PROFILE]: value => isRecord(value) && ['name', 'birthday', 'major', 'familyMembers', 'hobbies']
    .every(key => value[key] === undefined || typeof value[key] === 'string'),
  [STORAGE_KEYS.THEME]: value => ['modern', 'dark', 'yorha'].includes(value),
  [STORAGE_KEYS.QUIZ_HISTORY]: value => Array.isArray(value) && value.every(item =>
    isRecord(item) && isCount(item.total) && item.total > 0 && isCount(item.correct) && item.correct <= item.total &&
    typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)) && isMockAttempt(item)),
  [STORAGE_KEYS.DOKKAI_PROGRESS]: value => isRecord(value) && Object.values(value).every(item => typeof item === 'boolean'),
  [STORAGE_KEYS.LAST_LESSON]: value => isRecord(value) && typeof value.sectionId === 'string' && typeof value.questionId === 'string',
};

export const parseProgressBackup = (text) => {
  const parsed = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('Tệp sao lưu không hợp lệ.');
  if (Object.hasOwn(parsed, 'version') && parsed.version !== 1) throw new Error('Phiên bản sao lưu chưa được hỗ trợ.');
  const data = Object.hasOwn(parsed, 'version') ? parsed.data : parsed;
  if (!isRecord(data)) throw new Error('Tệp sao lưu không có dữ liệu tiến độ.');
  const entries = Object.entries(data).filter(([key]) => Object.hasOwn(validators, key));
  if (!entries.length) throw new Error('Không tìm thấy tiến độ N3-VJIT trong tệp này.');
  for (const [key, value] of entries) {
    if (!validators[key](value)) throw new Error('Dữ liệu tiến độ không hợp lệ. Chưa có dữ liệu nào được thay đổi.');
  }
  return entries;
};

export const importProgress = (file) => {
  const targetUserId = storageUserId;
  if (!targetUserId) return Promise.reject(new Error('Đăng nhập để khôi phục tiến độ.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const entries = parseProgressBackup(e.target.result);
        const previous = entries.map(([key]) => [scopedKey(key, targetUserId), localStorage.getItem(scopedKey(key, targetUserId))]);
        try {
          entries.forEach(([key, value]) => localStorage.setItem(scopedKey(key, targetUserId), JSON.stringify(value)));
          notifyProgressWrite(targetUserId);
        } catch (error) {
          previous.forEach(([key]) => localStorage.removeItem(key));
          previous.forEach(([key, value]) => {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          });
          throw error;
        }
        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Không đọc được tệp sao lưu.'));
    reader.readAsText(file);
  });
};

// ===== Reset All Data =====

export const resetAllProgress = () => {
  if (!storageUserId) return;
  Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.STUDY_ROADMAP).forEach(key => {
    localStorage.removeItem(scopedKey(key));
  });
  notifyProgressWrite();
};

export const readProgressSnapshot = (userId = storageUserId) => {
  if (!userId) return {};
  const snapshot = {};
  for (const key of Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.THEME)) {
    const value = localStorage.getItem(scopedKey(key, userId));
    if (value !== null) snapshot[key] = JSON.parse(value);
  }
  if (Object.keys(snapshot).length) parseProgressBackup(JSON.stringify(snapshot));
  return snapshot;
};

export const writeProgressSnapshot = (snapshot, userId = storageUserId, { notify = true } = {}) => {
  if (!userId) throw new Error('Đăng nhập để lưu tiến độ.');
  if (!isRecord(snapshot)) throw new Error('Dữ liệu tiến độ không hợp lệ.');
  const entries = Object.keys(snapshot).length ? parseProgressBackup(JSON.stringify(snapshot)).filter(([key]) => key !== STORAGE_KEYS.THEME) : [];
  const keys = Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.THEME).map(key => scopedKey(key, userId));
  const previous = keys.map(key => [key, localStorage.getItem(key)]);
  try {
    keys.forEach(key => localStorage.removeItem(key));
    entries.forEach(([key, value]) => localStorage.setItem(scopedKey(key, userId), JSON.stringify(value)));
  } catch (error) {
    keys.forEach(key => localStorage.removeItem(key));
    previous.forEach(([key, value]) => { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); });
    throw error;
  }
  if (notify) notifyProgressWrite(userId);
};
