import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { DEFAULT_REMINDER, REMINDER_DAYS, validateReminder } from '../utils/studyReminders.js'

export default function StudyReminderSettings() {
  const { user, client } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_REMINDER)
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    client.loadStudyReminder().then(data => {
      if (!active) return
      setSettings(data.settings || DEFAULT_REMINDER)
      setReady(data.ready === true)
      setLoaded(true)
      setNotice(null)
    }).catch(() => { if (active) setNotice({ error: true, text: 'Chưa tải được lịch nhắc học. Quản trị viên cần cấu hình tính năng email; bạn có thể thử tải lại.' }) })
    return () => { active = false }
  }, [client, user.id, attempt])

  const save = async event => {
    event.preventDefault()
    const invalid = validateReminder(settings)
    if (invalid) { setNotice({ error: true, text: invalid }); return }
    setBusy(true); setNotice(null)
    try {
      const data = await client.saveStudyReminder(settings)
      setSettings(data.settings); setReady(data.ready === true)
      setNotice({ error: false, text: data.settings.enabled ? 'Đã bật nhắc học qua email theo lịch đã chọn.' : 'Đã lưu lịch. Nhắc học qua email đang tắt.' })
    } catch { setNotice({ error: true, text: 'Chưa lưu được lịch. Hãy kiểm tra kết nối, xác nhận email và thử lại.' }) }
    finally { setBusy(false) }
  }
  const canEnable = ready && Boolean(user.email_confirmed_at)
  return <section className="panel account-sync">
    <div className="account-section-heading"><span className="feature-icon"><BellRing size={22} aria-hidden="true" /></span><div><h2>Nhắc giờ học qua email</h2><p>Chọn những ngày và giờ bạn muốn dành cho tiếng Nhật. Bạn có thể tắt bất cứ lúc nào.</p></div></div>
    {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'} mt-5`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {!loaded ? <button type="button" className="btn btn-secondary mt-5" onClick={() => setAttempt(value => value + 1)}>Tải lại cài đặt</button> : <form onSubmit={save} className="reminder-form">
      <p className="auth-field-hint">Email nhận: <strong>{user.email}</strong></p>
      {!ready && <div className="notice" role="status"><p>Dịch vụ email chưa được kích hoạt. Bạn có thể lưu giờ học để dùng khi dịch vụ sẵn sàng.</p><button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Kiểm tra lại dịch vụ</button></div>}
      {!user.email_confirmed_at && <p className="notice">Hãy xác nhận địa chỉ email trước khi bật nhắc học.</p>}
      <fieldset disabled={busy} className="reminder-fields">
        <label className="reminder-toggle"><input type="checkbox" checked={settings.enabled} disabled={!canEnable && !settings.enabled} onChange={event => setSettings({ ...settings, enabled: event.target.checked })} />Bật email nhắc học</label>
        <div className="reminder-time-grid"><label>Giờ học<input aria-label="Giờ học" type="time" required value={settings.local_time} onChange={event => setSettings({ ...settings, local_time: event.target.value })} /></label><label>Múi giờ<input aria-label="Múi giờ" list="reminder-timezones" required maxLength={80} value={settings.timezone} onChange={event => setSettings({ ...settings, timezone: event.target.value })} /><datalist id="reminder-timezones"><option value="Asia/Ho_Chi_Minh" /><option value="Asia/Tokyo" /><option value="UTC" /></datalist></label></div>
        <fieldset className="reminder-days"><legend>Ngày học trong tuần</legend>{REMINDER_DAYS.map((day, index) => <label key={day}><input type="checkbox" checked={settings.weekdays.includes(index)} onChange={event => setSettings({ ...settings, weekdays: event.target.checked ? [...settings.weekdays, index].sort() : settings.weekdays.filter(value => value !== index) })} /><span>{day}</span></label>)}</fieldset>
        <button className="btn btn-primary" type="submit">{busy ? 'Đang lưu…' : 'Lưu lịch nhắc học'}</button>
      </fieldset>
      <p className="auth-field-hint">Lịch chạy ngay cả khi bạn đóng website. Email có thể đến trễ vài phút; nếu hệ thống ngừng lâu, lịch cũ sẽ được bỏ qua.</p>
    </form>}
  </section>
}
