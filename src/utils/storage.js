// localStorage utility for managing study progress

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

export const addWrongQuestion = (section, questionId) => {
  const wrong = getWrongQuestions();
  if (!wrong[section]) {
    wrong[section] = {};
  }
  if (!wrong[section][questionId]) {
    wrong[section][questionId] = { count: 0, correctStreak: 0 };
  }
  wrong[section][questionId].count += 1;
  wrong[section][questionId].correctStreak = 0;
  setItem(STORAGE_KEYS.WRONG_QUESTIONS, wrong);
};

export const markWrongQuestionCorrect = (section, questionId) => {
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
    setItem(STORAGE_KEYS.WRONG_QUESTIONS, wrong);
  }
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
  Object.values(STORAGE_KEYS).forEach(key => {
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
