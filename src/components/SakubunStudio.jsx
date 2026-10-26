import { useMemo, useState } from 'react'
import { kaiwaSakubun } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { useAuth } from '../context/authContext.js'
import { getCustomSakubun, getUserProfile, saveCustomSakubun, saveUserProfile } from '../utils/storage.js'

function personalize(text, profile) {
  return (text || '')
    .replaceAll('{{birthday}}', profile.birthday || 'Date')
    .replaceAll('{{major}}', profile.major || '情報技術（IT）')
    .replaceAll('{{familyMembers}}', profile.familyMembers || '4')
    .replaceAll('{{hobbies}}', profile.hobbies || '音楽')
}

export default function SakubunStudio() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(getUserProfile())
  const [topicId, setTopicId] = useState(kaiwaSakubun.sakubun[0].id)
  const saved = getCustomSakubun()
  const topic = kaiwaSakubun.sakubun.find((s) => s.id === topicId) || kaiwaSakubun.sakubun[0]
  const [text, setText] = useState(saved[topic.id]?.text || '')
  const [showSample, setShowSample] = useState(false)

  const sample = useMemo(() => personalize(topic.sample, profile), [topic, profile])

  const switchTopic = (id) => {
    const next = kaiwaSakubun.sakubun.find((s) => s.id === id)
    setTopicId(id)
    setText(getCustomSakubun()[id]?.text || '')
    setShowSample(false)
    return next
  }

  const saveProfile = (patch) => {
    const next = { ...profile, ...patch }
    setProfile(next)
    saveUserProfile(next)
  }

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24">
      <h1 className="mb-3 text-2xl font-semibold">作文 Studio</h1>
      <div className="mb-4 grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] p-3 sm:grid-cols-2">
        <input
          className="rounded border border-[var(--line)] bg-transparent px-2 py-1"
          placeholder="Sinh nhật (VD: 5月20日)"
          value={profile.birthday}
          onChange={(e) => saveProfile({ birthday: e.target.value })}
        />
        <input
          className="rounded border border-[var(--line)] bg-transparent px-2 py-1"
          placeholder="Ngành học"
          value={profile.major}
          onChange={(e) => saveProfile({ major: e.target.value })}
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {kaiwaSakubun.sakubun.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`rounded border px-2 py-1 text-sm ${topicId === s.id ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line)]'}`}
            onClick={() => switchTopic(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <aside className="space-y-2">
          <p className="font-medium">
            {topic.title} · {topic.titleVi}
          </p>
          {topic.prompts.map((p, i) => (
            <div key={p.q} className="rounded border border-[var(--line)] bg-[var(--card)] p-3">
              <p className="jp text-sm">
                {i + 1}) {p.q}
              </p>
              {p.hint && <p className="jp mt-1 text-xs text-[var(--muted)]">{personalize(p.hint, profile)}</p>}
            </div>
          ))}
        </aside>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-[var(--muted)]">{text.length} chữ</span>
            <div className="flex gap-2">
              <SpeakButton text={text || sample} />
              <button
                type="button"
                className="rounded border border-[var(--line)] px-2 py-1 text-sm"
                disabled={!user}
                title={!user ? 'Đăng nhập để lưu bài viết' : undefined}
                onClick={() => {
                  saveCustomSakubun(topic.id, text)
                }}
              >
                Lưu bài
              </button>
              <button
                type="button"
                className="rounded border border-[var(--line)] px-2 py-1 text-sm"
                onClick={() => setShowSample((v) => !v)}
              >
                {showSample ? 'Ẩn bài mẫu' : 'Đối chiếu bài mẫu'}
              </button>
            </div>
          </div>
          <textarea
            className="jp min-h-80 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] p-3 leading-8"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Viết bài tiếng Nhật tại đây…"
          />
          {showSample && (
            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
              <p className="jp whitespace-pre-wrap leading-8">{sample}</p>
              {topic.sampleVi && <p className="mt-3 text-sm text-[var(--muted)] whitespace-pre-wrap">{personalize(topic.sampleVi, profile)}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
