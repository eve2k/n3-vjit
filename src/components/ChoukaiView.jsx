import { useState } from 'react'
import { choukai } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { addWrongQuestion, markQuestionCompleted, markWrongQuestionCorrect } from '../utils/storage'

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
  const items = choukai[group]

  const choose = (q, letter) => {
    if (picks[q.id]) return
    setPicks((prev) => ({ ...prev, [q.id]: letter }))
    const section = q.section || group
    markQuestionCompleted(section, q.id)
    if (!q.correctAnswer) return
    if (String(letter) === String(q.correctAnswer)) markWrongQuestionCorrect(section, q.id)
    else addWrongQuestion(section, q.id)
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24">
      <h1 className="mb-2 text-2xl font-semibold">聴解</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Đề giấy không kèm file nghe. 問題4–5 có đáp án trong tài liệu tổng hợp; 問題1–3 dùng để xem lựa chọn/hình và gắn audio nếu bạn có.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`rounded border px-2 py-1 text-sm ${group === g.key ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line)]'}`}
            onClick={() => setGroup(g.key)}
          >
            {g.title}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {(items || []).map((q) => {
          const pick = picks[q.id]
          return (
            <div key={q.id} className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
              <div className="mb-2 flex justify-between gap-2">
                <p className="font-medium">
                  {q.n ? `${q.n}ばん` : `${q.questionNumber}ばん`}
                  {q.situation ? ` · ${q.situation}` : ''}
                  {q.prompt ? ` · ${q.prompt}` : ''}
                  {q.questionText ? ` · ${q.questionText}` : ''}
                </p>
                <SpeakButton text={Object.values(q.options || {}).join('。')} />
              </div>
              {q.image && (
                <img src={q.image} alt="" className="mb-2 max-h-56 rounded border border-[var(--line)] object-contain" />
              )}
              <div className="grid gap-1">
                {Object.entries(q.options || {}).map(([letter, text]) => {
                  let cls = 'border-[var(--line)]'
                  if (pick && q.correctAnswer) {
                    if (String(letter) === String(q.correctAnswer)) cls = 'border-[var(--ok)] bg-green-500/10'
                    else if (pick === letter) cls = 'border-[var(--bad)] bg-red-500/10'
                  } else if (pick === letter) cls = 'border-[var(--accent)]'
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={Boolean(pick)}
                      className={`rounded border px-2 py-1 text-left text-sm jp ${cls}`}
                      onClick={() => choose(q, letter)}
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
