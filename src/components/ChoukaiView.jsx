import { useState } from 'react'
import { choukai } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { addWrongQuestion, markQuestionCompleted, markWrongQuestionCorrect } from '../utils/storage'
import useQuestionShortcuts from '../hooks/useQuestionShortcuts.js'

const groups = [
  { key: 'mondai1', title: '問題1 · 19 câu (có hình)' },
  { key: 'mondai2', title: '問題2 · 10 câu' },
  { key: 'mondai3', title: '問題3 · 12 câu phản xạ' },
  { key: 'mondai4', title: '問題4 · 4 tình huống' },
  { key: 'mondai5', title: '問題5 · 8 câu phản xạ' },
]

export default function ChoukaiView() {
  const [group, setGroup] = useState('mondai4')
  const [picks, setPicks] = useState({})
  const [activeIndex, setActiveIndex] = useState(0)
  const items = choukai[group]
  const activeQuestion = items?.[activeIndex]

  const choose = (q, letter) => {
    if (picks[q.id]) return
    setPicks((prev) => ({ ...prev, [q.id]: letter }))
    const section = q.section || group
    markQuestionCompleted(section, q.id)
    if (!q.correctAnswer) return
    if (String(letter) === String(q.correctAnswer)) markWrongQuestionCorrect(section, q.id)
    else addWrongQuestion(section, q.id)
  }

  const { pendingChoice, clearPending } = useQuestionShortcuts({
    question: activeQuestion,
    answer: picks[activeQuestion?.id],
    locked: Boolean(picks[activeQuestion?.id]),
    onAnswer: (letter) => choose(activeQuestion, letter),
    onNext: () => {
      const next = Math.min(items.length - 1, activeIndex + 1)
      setActiveIndex(next)
      document.getElementById(`choukai-question-${items[next].id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    },
  })

  return (
    <div className="page-shell content-page choukai-page">
      <div className="page-heading"><div><p className="eyebrow">KỸ NĂNG · 聴解</p><h1>Luyện nghe</h1></div></div>
      <p className="listening-note">
        Đề giấy không kèm file nghe. 問題4–5 có đáp án trong tài liệu tổng hợp; 問題1–3 chỉ có lựa chọn và hình. Nút giọng máy chỉ đọc lựa chọn, không phát bản thu của đề.
      </p>
      <div className="lesson-tabs mb-4 flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-pressed={group === g.key}
            className={`btn ${group === g.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setGroup(g.key); setActiveIndex(0); clearPending() }}
          >
            {g.title}
          </button>
        ))}
      </div>
      <h2 className="choukai-group-title">{groups.find((item) => item.key === group)?.title}</h2>
      <p className="keyboard-hint mb-4" aria-live="polite">Câu đang chọn: {activeIndex + 1} · {pendingChoice ? `Đáp án ${pendingChoice} · Space để trả lời` : '1–4 chọn đáp án · Space trả lời / chuyển câu'}</p>
      <div className="choukai-questions">
        {(items || []).map((q, index) => {
          const pick = picks[q.id]
          return (
            <div key={q.id} id={`choukai-question-${q.id}`} onFocus={() => setActiveIndex(index)} onPointerDown={() => setActiveIndex(index)} className={`panel choukai-question ${activeIndex === index ? 'shortcut-active' : ''}`}>
              <div className="mb-2 flex justify-between gap-2">
                <h3 className="choukai-question-heading">
                  {q.n ? `${q.n}ばん` : `${q.questionNumber}ばん`}
                  {q.situation ? ` · ${q.situation}` : ''}
                  {q.prompt ? ` · ${q.prompt}` : ''}
                  {q.questionText ? ` · ${q.questionText}` : ''}
                </h3>
                <SpeakButton text={Object.values(q.options || {}).join('。')} label="Nghe lựa chọn (giọng máy)" />
              </div>
              {!Object.hasOwn(q.options || {}, q.correctAnswer) && <p className="listening-unscored">Chưa có đáp án · Không chấm tự động</p>}
              {q.image && (
                <img src={q.image} alt={`Hình minh họa câu ${q.n || q.questionNumber}`} className="mb-2 max-h-56 rounded border border-[var(--line)] object-contain" />
              )}
              <div className="grid gap-1">
                {Object.entries(q.options || {}).map(([letter, text]) => {
                  let cls = 'border-[var(--line)]'
                  if (!pick && activeIndex === index && pendingChoice === letter) cls = 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  if (pick && q.correctAnswer) {
                    if (String(letter) === String(q.correctAnswer)) cls = 'border-[var(--ok)] bg-green-500/10'
                    else if (pick === letter) cls = 'border-[var(--bad)] bg-red-500/10'
                  } else if (pick === letter) cls = 'border-[var(--accent)]'
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={Boolean(pick)}
                      className={`answer-option rounded border px-2 py-1 text-left text-sm jp ${cls}`}
                      aria-pressed={(activeIndex === index ? pendingChoice || pick : pick) === letter}
                      onClick={() => { clearPending(); choose(q, letter) }}
                    >
                      {letter}. {text}
                    </button>
                  )
                })}
              </div>
              {pick && q.explanation && <p className="mt-2 text-sm text-[var(--muted)]">{q.explanation}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
