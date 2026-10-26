import { useMemo, useState } from 'react'
import { dokkai } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { markDokkaiCompleted, markQuestionCompleted, addWrongQuestion, markWrongQuestionCorrect } from '../utils/storage'

function fillPassage(passage, answersByBlank) {
  let text = passage
  Object.entries(answersByBlank).forEach(([num, word]) => {
    const filled = `【${word}】`
    const patterns = [
      new RegExp(`[［\\[]\\s*${num}\\s*[］\\]]`, 'g'),
      new RegExp(`[（(]\\s*${num}\\s*[）)]`, 'g'),
    ]
    patterns.forEach((re) => {
      text = text.replace(re, filled)
    })
  })
  return text
}

export default function DokkaiView() {
  const [n, setN] = useState(1)
  const passage = dokkai.find((p) => p.number === n) || dokkai[0]
  const [picks, setPicks] = useState({})

  const filled = useMemo(() => {
    const blanks = {}
    passage.questions.forEach((q) => {
      const letter = picks[q.id]
      const blankNo = q.blank ?? q.questionNumber
      if (letter && q.options[letter]) blanks[blankNo] = q.options[letter]
    })
    return fillPassage(passage.passage, blanks)
  }, [passage, picks])

  const choose = (q, letter) => {
    if (picks[q.id]) return
    setPicks((prev) => ({ ...prev, [q.id]: letter }))
    const section = q.section || passage.id
    markQuestionCompleted(section, q.id)
    if (letter === q.correctAnswer) markWrongQuestionCorrect(section, q.id)
    else addWrongQuestion(section, q.id)
    const next = { ...picks, [q.id]: letter }
    const done = passage.questions.every((item) => next[item.id])
    if (done) markDokkaiCompleted(passage.id)
  }

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24">
      <div className="mb-3 flex flex-wrap gap-2">
        {dokkai.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setN(p.number)
              setPicks({})
            }}
            className={`rounded border px-2 py-1 text-sm ${n === p.number ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line)]'}`}
          >
            Bài {p.number}
          </button>
        ))}
      </div>
      <h1 className="mb-3 text-xl font-semibold">
        読解 ({passage.number}) · {passage.title}
      </h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="h-fit rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 lg:sticky lg:top-24">
          <div className="mb-2 flex justify-end">
            <SpeakButton text={passage.passage} rate={0.85} />
          </div>
          <p className="jp whitespace-pre-wrap text-[15px] leading-8">{filled}</p>
        </article>
        <div className="space-y-3">
          {passage.questions.map((q) => {
            const pick = picks[q.id]
            return (
              <div key={q.id} className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
                <div className="mb-2 flex justify-between gap-2">
                  <p className="jp font-medium">
                    問{q.questionNumber}. {q.questionText}
                  </p>
                  <SpeakButton text={q.questionText} />
                </div>
                <div className="grid gap-1">
                  {Object.entries(q.options).map(([letter, text]) => {
                    let cls = 'border-[var(--line)]'
                    if (pick) {
                      if (letter === q.correctAnswer) cls = 'border-[var(--ok)] bg-green-500/10'
                      else if (pick === letter) cls = 'border-[var(--bad)] bg-red-500/10'
                    }
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
                {pick && (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Đáp án {q.correctAnswer}. {q.explanation}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
