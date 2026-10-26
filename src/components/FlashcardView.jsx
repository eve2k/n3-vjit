import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Layers, RotateCcw } from 'lucide-react'
import { flashcardDecks } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { getMasteredFlashcards, toggleFlashcardMastered } from '../utils/storage.js'
import { useAuth } from '../context/authContext.js'

export default function FlashcardView() {
  useAuth()
  const decks = Object.values(flashcardDecks)
  const [deckId, setDeckId] = useState('deck1')
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [unmasteredOnly, setUnmasteredOnly] = useState(false)
  const [, refresh] = useState(0)
  const deck = decks.find((item) => item.id === deckId) || decks[0]
  const mastered = new Set(getMasteredFlashcards())
  const masteredCount = deck.cards.filter((card) => mastered.has(card.id)).length
  const cards = unmasteredOnly ? deck.cards.filter((card) => !mastered.has(card.id)) : deck.cards
  const index = Math.min(position, Math.max(0, cards.length - 1))
  const card = cards[index]

  const move = (step) => {
    setPosition(Math.max(0, Math.min(cards.length - 1, index + step)))
    setFlipped(false)
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
      if (event.code === 'Space') { event.preventDefault(); setFlipped((value) => !value) }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault()
        setPosition((value) => Math.max(0, Math.min(cards.length - 1, value + (event.key === 'ArrowRight' ? 1 : -1))))
        setFlipped(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards.length])

  const mark = (advance) => {
    if (!card) return
    if (!advance || !mastered.has(card.id)) toggleFlashcardMastered(card.id)
    refresh((value) => value + 1)
    if (advance && !unmasteredOnly) setPosition(Math.min(cards.length - 1, index + 1))
    setFlipped(false)
  }

  return (
    <div className="page-shell flashcard-page">
      <div className="page-heading"><div><p className="eyebrow">ÔN NGẮN, NHỚ LÂU</p><h1>Ghi nhớ với flashcard</h1><p className="page-description">Lật thẻ, nhớ lại kiến thức rồi đánh dấu những gì bạn đã thuộc.</p></div><span className="feature-icon"><Layers size={23} aria-hidden="true" /></span></div>
      <div className="flashcard-decks" aria-label="Chọn bộ thẻ">{decks.map((item) => <button key={item.id} type="button" aria-pressed={deck.id === item.id} className={`panel deck-button ${deck.id === item.id ? 'is-active' : ''}`} onClick={() => { setDeckId(item.id); setPosition(0); setFlipped(false) }}><span className="jp">{item.subtitle}</span><strong>{item.title.replace(/^Deck \d+ · /, '')}</strong></button>)}</div>
      <div className="panel flashcard-status"><div><strong>{masteredCount}/{deck.cards.length}</strong><span> thẻ đã thuộc trong bộ này</span></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unmasteredOnly} onChange={(event) => { setUnmasteredOnly(event.target.checked); setPosition(0); setFlipped(false) }} />Chỉ thẻ chưa thuộc</label><div className="progress-track w-full"><span style={{ width: `${masteredCount / deck.cards.length * 100}%` }} /></div></div>
      {card ? <>
        <div className="flashcard-meta"><span>Thẻ {index + 1}/{cards.length}</span><span>{mastered.has(card.id) ? <><CheckCircle2 size={15} aria-hidden="true" />Đã thuộc</> : 'Đang ôn tập'}</span></div>
        <button type="button" className={`panel learning-flashcard ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped((value) => !value)} aria-label={`${flipped ? 'Mặt đáp án' : 'Mặt câu hỏi'}: ${flipped ? card.back : card.front}. Nhấn để lật thẻ.`}>
          <span className="eyebrow">{flipped ? 'ĐÁP ÁN & GHI NHỚ' : 'BẠN CÒN NHỚ KHÔNG?'}</span><span className="jp flashcard-text">{flipped ? card.back : card.front}</span>{flipped && card.extra && <span className="jp flashcard-extra">{card.extra}</span>}<span className="flashcard-flip-hint"><RotateCcw size={14} aria-hidden="true" />{flipped ? 'Nhấn để xem lại câu hỏi' : 'Nhấn để xem đáp án'}</span>
        </button>
        <div className="flashcard-actions"><SpeakButton text={flipped ? `${card.back} ${card.extra || ''}` : card.front} /><button type="button" className="btn btn-secondary" onClick={() => mark(false)}>{mastered.has(card.id) ? 'Cần ôn lại' : 'Đánh dấu đã thuộc'}</button><button type="button" className="btn btn-primary" onClick={() => mark(true)}><CheckCircle2 size={17} aria-hidden="true" />Đã thuộc, thẻ tiếp</button></div>
        <div className="quiz-navigation"><button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => move(-1)}><ArrowLeft size={16} aria-hidden="true" />Thẻ trước</button><span>{index + 1}/{cards.length}</span><button type="button" className="btn btn-secondary" disabled={index === cards.length - 1} onClick={() => move(1)}>Thẻ tiếp<ArrowRight size={16} aria-hidden="true" /></button></div>
        <p className="keyboard-hint">Space để lật thẻ · ← / → để chuyển thẻ khi không chọn nút hoặc ô nhập.</p>
      </> : <section className="panel empty-state"><CheckCircle2 size={42} aria-hidden="true" /><h2 className="text-lg font-semibold text-[var(--text)]">Bạn đã thuộc toàn bộ bộ thẻ này!</h2><p>Chọn bộ khác hoặc xem lại tất cả để củng cố kiến thức.</p><button type="button" className="btn btn-primary" onClick={() => { setUnmasteredOnly(false); setPosition(0) }}>Xem lại tất cả thẻ</button></section>}
    </div>
  )
}
