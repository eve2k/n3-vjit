import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search } from 'lucide-react'
import { grammarGuide } from '../data/grammarGuide.js'
import SpeakButton from './SpeakButton.jsx'

const tabs = [
  { id: 'grammar', label: 'Ngữ pháp 練習4' },
  { id: 'forms', label: 'Các thể 練習5・会話' },
]

export default function GrammarGuide() {
  const [tab, setTab] = useState('grammar')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const inTab = useMemo(() => grammarGuide.filter((item) => item.group === tab), [tab])
  const categories = useMemo(() => [...new Set(inTab.map((item) => item.category))], [inTab])
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return inTab.filter((item) => {
      if (category !== 'all' && item.category !== category) return false
      if (!term) return true
      return [item.title, item.form, item.meaning, item.example, item.translation, item.note, item.category]
        .some((value) => value?.toLocaleLowerCase().includes(term))
    })
  }, [inTab, category, search])

  return (
    <main className="mx-auto max-w-6xl p-4 pb-24">
      <div className="mb-5 flex items-start gap-3">
        <BookOpen className="mt-1 shrink-0 text-[var(--accent)]" size={26} aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Tra cứu ngữ pháp và các thể</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Các mẫu xuất hiện trong đề cương của trường: 練習4, 練習5 và cấu trúc bắt buộc của 会話 sinh nhật.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Nhóm kiến thức">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => { setTab(item.id); setCategory('all') }}
            className={`rounded border px-4 py-2 text-sm font-medium ${tab === item.id ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line)] bg-[var(--card)]'}`}
          >
            {item.label} <span className="opacity-75">({grammarGuide.filter((entry) => entry.group === item.id).length})</span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
        <label htmlFor="grammar-search" className="mb-1 block text-sm font-medium">Tìm mẫu, ý nghĩa hoặc ví dụ</label>
        <div className="flex items-center gap-2 rounded border border-[var(--line)] px-3">
          <Search size={17} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            id="grammar-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ví dụ: そうだ, bị động, nhờ có…"
            className="w-full bg-transparent py-2 outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Lọc theo chủ đề">
          <FilterButton active={category === 'all'} onClick={() => setCategory('all')}>Tất cả</FilterButton>
          {categories.map((name) => (
            <FilterButton key={name} active={category === name} onClick={() => setCategory(name)}>{name}</FilterButton>
          ))}
        </div>
      </div>

      <p className="my-4 text-sm text-[var(--muted)]" aria-live="polite">Hiển thị {visible.length}/{inTab.length} mục</p>
      {visible.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">Không tìm thấy mẫu phù hợp.</p>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {visible.map((item) => <GuideCard key={item.id} item={item} />)}
        </div>
      )}
    </main>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs ${active ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line)]'}`}
    >
      {children}
    </button>
  )
}

function GuideCard({ item }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{item.category} · {item.source || (item.group === 'grammar' ? '練習4' : '練習5')}</p>
      <h2 className="jp text-xl font-semibold">{item.title}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div><dt className="font-medium">Cấu trúc</dt><dd className="jp mt-0.5">{item.form}</dd></div>
        <div><dt className="font-medium">Ý nghĩa</dt><dd className="mt-0.5">{item.meaning}</dd></div>
        <div>
          <dt className="font-medium">Ví dụ</dt>
          <dd className="mt-1 flex items-start justify-between gap-2">
            <span><span className="jp block">{item.example}</span><span className="mt-0.5 block text-[var(--muted)]">{item.translation}</span></span>
            <SpeakButton text={item.example} />
          </dd>
        </div>
      </dl>
      {item.note && <p className="mt-3 border-t border-[var(--line)] pt-2 text-sm text-[var(--muted)]">Lưu ý: {item.note}</p>}
      {(item.refs?.length > 0 || item.formRefs?.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-3 text-xs">
          <span className="mr-1 text-[var(--muted)]">Luyện câu:</span>
          {item.refs?.map((number) => <QuestionLink key={`r4-${number}`} section="renshuu4" number={number} />)}
          {item.formRefs?.map((number) => <QuestionLink key={`r5-${number}`} section="renshuu5" number={number} />)}
        </div>
      )}
    </article>
  )
}

function QuestionLink({ section, number }) {
  const prefix = section === 'renshuu4' ? 'r4' : 'r5'
  return (
    <Link
      to={`/quiz?section=${section}&question=${prefix}_q${number}`}
      className="rounded border border-[var(--line)] px-2 py-1 hover:border-[var(--accent)] hover:text-[var(--accent)]"
      aria-label={`${section === 'renshuu4' ? '練習4' : '練習5'} câu ${number}`}
    >
      {section === 'renshuu4' ? '練習4' : '練習5'} · 問{number}
    </Link>
  )
}
