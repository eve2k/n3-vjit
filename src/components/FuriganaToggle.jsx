import useFurigana from '../hooks/useFurigana.js'

export default function FuriganaToggle({ disabled = false }) {
  const [visible, toggle] = useFurigana()
  return <button type="button" className="btn btn-secondary furigana-toggle" disabled={disabled} aria-pressed={!disabled && visible} onClick={toggle} title={disabled ? 'Ẩn furigana trong câu hỏi Kanji để không lộ đáp án' : undefined}>
    <span aria-hidden="true">あ</span>{disabled ? 'Furigana: Khóa' : `Furigana: ${visible ? 'Bật' : 'Tắt'}`}
  </button>
}
