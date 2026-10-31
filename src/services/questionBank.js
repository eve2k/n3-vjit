import { applyQuestionBank, QUIZ_SECTIONS } from '../data/index.js'
import { authClient } from './auth.js'

const CACHE_KEY = 'n3vjit_question_bank_v1'
export const QUESTION_BANK_SECTIONS = QUIZ_SECTIONS.map(({ id, label, title }) => ({ id, label, title }))
export const bundledQuestionBank = () => QUIZ_SECTIONS.flatMap(section => section.questions)

export async function refreshQuestionBank() {
  try {
    const rows = await authClient.loadQuestionBank()
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
    applyQuestionBank(rows)
    return rows
  } catch {
    try {
      const rows = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (Array.isArray(rows)) { applyQuestionBank(rows); return rows }
    } catch { /* Use bundled bank when cache is unavailable. */ }
    return bundledQuestionBank()
  }
}

export async function loadAdminQuestionBank() {
  try { return await authClient.loadQuestionBank() }
  catch {
    try { const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (Array.isArray(cached)) return cached }
    catch { /* Fall through to the bundled bank. */ }
    return bundledQuestionBank()
  }
}

export async function saveAdminQuestion(question) {
  await authClient.saveQuestion(question)
  const rows = await authClient.loadQuestionBank()
  localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
  applyQuestionBank(rows)
  return rows
}

export async function setQuestionArchived(id, archived) {
  await authClient.archiveQuestion(id, archived)
  const rows = await authClient.loadQuestionBank()
  localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
  applyQuestionBank(rows)
  return rows
}
