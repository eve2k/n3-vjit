import { useMemo, useState } from 'react'
import { dokkai } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import QuestionText from './QuestionText.jsx'
import { markDokkaiCompleted, markQuestionCompleted, addWrongQuestion, markWrongQuestionCorrect } from '../utils/storage'
import useQuestionShortcuts from '../hooks/useQuestionShortcuts.js'

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
  const [activeIndex, setActiveIndex] = useState(0)
  const activeQuestion = passage.questions[activeIndex]

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

  const { pendingChoice, clearPending } = useQuestionShortcuts({
    question: activeQuestion,
    answer: picks[activeQuestion?.id],
    locked: Boolean(picks[activeQuestion?.id]),
    onAnswer: (letter) => choose(activeQuestion, letter),
    onNext: () => {
      const next = Math.min(passage.questions.length - 1, activeIndex + 1)
      setActiveIndex(next)
      document.getElementById(`dokkai-question-${passage.questions[next].id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    },
  })

  return (
    <div className="page-shell content-page dokkai-page">
      <FuriganaToggle />
      <div className="page-heading"><div><p className="eyebrow">KỸ NĂNG · 読解</p><h1>Đọc hiểu</h1><p className="page-description">Đọc đoạn văn, tìm thông tin và luyện cách suy luận theo ngữ cảnh.</p></div></div>
      <div className="lesson-tabs mb-3 flex flex-wrap gap-2">
        {dokkai.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setN(p.number)
              setPicks({})
              setActiveIndex(0)
              clearPending()
            }}
            aria-pressed={n === p.number}
            className={`btn ${n === p.number ? 'btn-primary' : 'btn-secondary'}`}
          >
            Bài {p.number}
          </button>
        ))}
      </div>
      <h2 className="mb-3 text-xl font-semibold">
        読解 ({passage.number}) · {passage.title}
      </h2>
      <p className="keyboard-hint mb-4" aria-live="polite">Câu đang chọn: {activeIndex + 1} · {pendingChoice ? `Đáp án ${pendingChoice} · Space để trả lời` : '1–4 chọn đáp án · Space trả lời / chuyển câu'}</p>
      <div className="dokkai-content">
        <article className="panel dokkai-passage">
          <div className="dokkai-passage-heading"><span className="eyebrow">ĐOẠN VĂN</span><SpeakButton text={passage.passage} rate={0.85} label="Nghe đoạn văn (giọng máy)" /></div>
          <p className="jp dokkai-passage-text"><QuestionText text={filled} /></p>
        </article>
        <div className="dokkai-questions">
          {passage.questions.map((q, index) => {
            const pick = picks[q.id]
            return (
              <div key={q.id} id={`dokkai-question-${q.id}`} onFocus={() => setActiveIndex(index)} onPointerDown={() => setActiveIndex(index)} className={`panel dokkai-question ${activeIndex === index ? 'shortcut-active' : ''}`}>
                <div className="mb-2 flex justify-between gap-2">
                  <p className="jp font-medium">
                    問{q.questionNumber}. {q.questionText}
                  </p>
                  <SpeakButton text={q.questionText} />
                </div>
                <div className="grid gap-1">
                  {Object.entries(q.options).map(([letter, text]) => {
                    let cls = 'border-[var(--line)]'
                    if (!pick && activeIndex === index && pendingChoice === letter) cls = 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    if (pick) {
                      if (letter === q.correctAnswer) cls = 'border-[var(--ok)] bg-green-500/10'
                      else if (pick === letter) cls = 'border-[var(--bad)] bg-red-500/10'
                    }
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
import FuriganaToggle from './FuriganaToggle.jsx'
