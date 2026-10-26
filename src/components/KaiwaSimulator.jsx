import { useMemo, useState } from 'react'
import { kaiwaSakubun } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { speakJapanese } from '../utils/tts'
import { getUserProfile, saveUserProfile } from '../utils/storage'

function personalize(text, profile) {
  return text
    .replaceAll('{{birthday}}', profile.birthday || 'Date')
    .replaceAll('{{major}}', profile.major || '情報技術（IT）')
    .replaceAll('{{familyMembers}}', profile.familyMembers || '4')
    .replaceAll('{{hobbies}}', profile.hobbies || '音楽')
    .replaceAll('Date', profile.birthday || 'Date')
}

export default function KaiwaSimulator() {
  const [profile, setProfile] = useState(getUserProfile())
  const [topicId, setTopicId] = useState('kaiwa1')
  const [i, setI] = useState(0)
  const [hideQ, setHideQ] = useState(false)
  const [showA, setShowA] = useState(false)
  const [mix, setMix] = useState(false)

  const bank = useMemo(() => {
    if (!mix) return kaiwaSakubun.kaiwa.find((k) => k.id === topicId)
    const qa = kaiwaSakubun.kaiwa.flatMap((k) => (k.qa || []).map((item) => ({ ...item, topic: k.title })))
    for (let n = qa.length - 1; n > 0; n -= 1) {
      const j = Math.floor(Math.random() * (n + 1))
      ;[qa[n], qa[j]] = [qa[j], qa[n]]
    }
    return { id: 'mix', title: 'Trộn 4 chủ đề', theme: 'Mock interview', notes: '', qa }
  }, [topicId, mix])

  const item = bank?.qa?.[i]
  const answer = personalize(item?.a || '', profile)

  if (!item) {
    return <p className="p-4">Chưa có câu hỏi hội thoại.</p>
  }

  const save = (patch) => {
    const next = { ...profile, ...patch }
    setProfile(next)
    saveUserProfile(next)
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24">
      <h1 className="mb-3 text-2xl font-semibold">会話 Simulator</h1>
      <div className="mb-4 grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] p-3 sm:grid-cols-2">
        <input className="rounded border border-[var(--line)] bg-transparent px-2 py-1" placeholder="Tên" value={profile.name} onChange={(e) => save({ name: e.target.value })} />
        <input className="rounded border border-[var(--line)] bg-transparent px-2 py-1" placeholder="Sinh nhật (VD: 5月20日)" value={profile.birthday} onChange={(e) => save({ birthday: e.target.value })} />
        <input className="rounded border border-[var(--line)] bg-transparent px-2 py-1" placeholder="Ngành (IT / 経営)" value={profile.major} onChange={(e) => save({ major: e.target.value })} />
        <input className="rounded border border-[var(--line)] bg-transparent px-2 py-1" placeholder="Số người trong gia đình" value={profile.familyMembers} onChange={(e) => save({ familyMembers: e.target.value })} />
        <input className="sm:col-span-2 rounded border border-[var(--line)] bg-transparent px-2 py-1" placeholder="Sở thích" value={profile.hobbies} onChange={(e) => save({ hobbies: e.target.value })} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {kaiwaSakubun.kaiwa.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`rounded border px-2 py-1 text-sm ${!mix && topicId === k.id ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line)]'}`}
            onClick={() => {
              setMix(false)
              setTopicId(k.id)
              setI(0)
              setShowA(false)
            }}
          >
            {k.title}
          </button>
        ))}
        <button
          type="button"
          className={`rounded border px-2 py-1 text-sm ${mix ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line)]'}`}
          onClick={() => {
            setMix(true)
            setI(0)
            setShowA(false)
          }}
        >
          Trộn ngẫu nhiên
        </button>
      </div>
      <p className="mb-2 text-sm text-[var(--muted)]">
        {bank.title} · {i + 1}/{bank.qa.length} {bank.notes}
      </p>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-[var(--accent)] px-3 py-1 text-[var(--accent-ink)]"
            onClick={() => speakJapanese(item.q, 0.85)}
          >
            Giám khảo hỏi
          </button>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={hideQ} onChange={(e) => setHideQ(e.target.checked)} />
            Ẩn chữ câu hỏi
          </label>
        </div>
        <p className="jp mt-4 text-xl">{hideQ ? '（Đang ẩn câu hỏi — hãy nghe）' : item.q}</p>
        <button type="button" className="mt-4 rounded border border-[var(--line)] px-3 py-1" onClick={() => setShowA(true)}>
          Xem câu trả lời mẫu & nghe
        </button>
        {showA && (
          <div className="mt-3 rounded border border-[var(--line)] p-3">
            <div className="mb-2 flex justify-end">
              <SpeakButton text={answer} />
            </div>
            <p className="jp">{answer}</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="rounded border border-[var(--line)] px-3 py-1" disabled={i === 0} onClick={() => { setI((n) => n - 1); setShowA(false) }}>
          Trước
        </button>
        <button type="button" className="rounded border border-[var(--line)] px-3 py-1" disabled={i >= bank.qa.length - 1} onClick={() => { setI((n) => n + 1); setShowA(false) }}>
          Sau
        </button>
      </div>
    </div>
  )
}
