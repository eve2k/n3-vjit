import { useEffect, useState } from 'react'
import { BellRing, Smartphone, Trash2 } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { DEFAULT_REMINDER, REMINDER_DAYS, REMINDER_TIMEZONE, validateReminder } from '../utils/studyReminders.js'

const decodeKey = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0))
const deviceId = () => {
  let id = localStorage.getItem('n3vjit_push_device')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('n3vjit_push_device', id) }
  return id
}
const deviceName = () => `${navigator.platform || 'Thiết bị'} · ${navigator.userAgent.includes('iPhone') ? 'iPhone' : navigator.userAgent.includes('Android') ? 'Android' : 'Trình duyệt'}`
const normalizeSettings = settings => ({ ...DEFAULT_REMINDER, ...settings, timezone: REMINDER_TIMEZONE,
  day_times: Array.from({ length: 7 }, (_, day) => settings?.day_times?.[day] || settings?.local_time || '20:00') })
const reminderMode = dayTimes => dayTimes.every(time => time === dayTimes[0]) ? 'common' : 'per-day'
const activeScheduleText = (value, { emailReady, pushReady } = {}) => {
  const channels = [
    value.enabled && (emailReady ? 'email' : 'email (dịch vụ chưa sẵn sàng)'),
    value.push_enabled && (pushReady ? 'push' : 'push (dịch vụ chưa sẵn sàng)'),
  ].filter(Boolean)
  const days = (value.weekdays || []).map(day => `${REMINDER_DAYS[day]} ${value.day_times?.[day] || value.local_time}`).filter(Boolean).join(', ')
  return `Lịch đang có hiệu lực: ${days} (giờ Việt Nam); kênh: ${channels.length ? channels.join(' + ') : 'chưa bật kênh nào'}.`
}
const requirePushAccepted = result => {
  if (result?.accepted > 0) return result
  const failure = new Error('push_not_accepted')
  failure.code = 'push_not_accepted'
  failure.result = result
  throw failure
}
const logPushFailure = (step, error) => {
  // Keep support diagnostics in the console without exposing endpoint or payload data.
  console.warn('Study reminder notification failed', {
    step,
    code: typeof error?.code === 'string' ? error.code : undefined,
    status: Number.isInteger(error?.status) ? error.status : undefined,
    name: typeof error?.name === 'string' ? error.name : undefined,
    failureStatuses: Array.isArray(error?.result?.failure_statuses) ? error.result.failure_statuses : undefined,
  })
}
const pushDeliveryError = error => {
  if (error.code === 'push_not_accepted') {
    return 'Thiết bị đã lưu, nhưng chưa gửi được thông báo. Hãy kiểm tra kết nối rồi thử lại sau.'
  }
  return 'Chưa gửi được thông báo. Hãy kiểm tra quyền thông báo trên thiết bị rồi thử lại sau.'
}

export default function StudyReminderSettings() {
  const { user, client } = useAuth()
  const [settings, setSettings] = useState({ ...DEFAULT_REMINDER, push_enabled: false })
  const [timeMode, setTimeMode] = useState('common')
  const [commonTime, setCommonTime] = useState('20:00')
  const [ready, setReady] = useState(false)
  const [pushReady, setPushReady] = useState(false)
  const [vapidKey, setVapidKey] = useState('')
  const [devices, setDevices] = useState([])
  const [pushClientStatus, setPushClientStatus] = useState('checking')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const refresh = async () => {
    const data = await client.loadStudyReminder()
    const normalized = normalizeSettings(data.settings)
    setSettings({ ...normalized, push_enabled: data.settings?.push_enabled === true })
    setTimeMode(reminderMode(normalized.day_times)); setCommonTime(normalized.day_times[0])
    setReady(data.ready === true); setPushReady(data.push_ready === true)
    setVapidKey(data.vapid_public_key || ''); setDevices(data.devices || []); setLoaded(true)
  }
  const inspectPushClient = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported'
    if (Notification.permission === 'denied') return 'denied'
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      return subscription ? 'ready' : 'missing'
    } catch { return 'missing' }
  }
  useEffect(() => {
    let active = true
    client.loadStudyReminder().then(data => {
      if (!active) return
      const normalized = normalizeSettings(data.settings)
      setSettings({ ...normalized, push_enabled: data.settings?.push_enabled === true })
      setTimeMode(reminderMode(normalized.day_times)); setCommonTime(normalized.day_times[0])
      setReady(data.ready === true); setPushReady(data.push_ready === true)
      setVapidKey(data.vapid_public_key || ''); setDevices(data.devices || []); setLoaded(true); setNotice(null)
      inspectPushClient().then(status => { if (active) setPushClientStatus(status) })
    }).catch(() => { if (active) setNotice({ error: true, text: 'Chưa tải được cài đặt nhắc học. Hãy thử tải lại sau.' }) })
    return () => { active = false }
  }, [client, user.id, attempt])

  useEffect(() => {
    const onMessage = async event => {
      if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED') return
      if (!event.data.subscription) { setNotice({ error: true, text: 'Đăng ký push của trình duyệt đã thay đổi. Hãy bật lại thông báo trên thiết bị này.' }); return }
      try {
        const data = await client.savePushSubscription(event.data.subscription, { id: deviceId(), name: `${navigator.platform || 'Thiết bị'} · Trình duyệt` })
        setDevices(data.devices || [])
      } catch { setNotice({ error: true, text: 'Chưa cập nhật được đăng ký push mới. Hãy mở lại quyền thông báo trong Tài khoản.' }) }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [client])

  const saveEmail = async event => {
    event.preventDefault()
    const payload = { ...settings, day_times: timeMode === 'common' ? Array(7).fill(commonTime) : settings.day_times }
    const invalid = validateReminder(payload)
    if (invalid) { setNotice({ error: true, text: invalid }); return }
    setBusy(true); setNotice(null)
    try {
      const data = await client.saveStudyReminder(payload)
      const saved = { ...payload, ...data.settings }
      setSettings(value => ({ ...value, ...saved }))
      setNotice({ error: false, text: `Đã lưu lịch nhắc thành công. ${activeScheduleText(saved, { emailReady: data.ready === true, pushReady: data.push_ready === true })}` })
    } catch { setNotice({ error: true, text: 'Chưa lưu được lịch nhắc. Hãy kiểm tra kết nối và trạng thái xác nhận email.' }) }
    finally { setBusy(false) }
  }

  const sendTest = async () => {
    setBusy(true); setNotice(null)
    try {
      const result = await ensurePushSubscription()
      setDevices(result.devices || [])
      setSettings(value => ({ ...value, push_enabled: true }))
      requirePushAccepted(await client.sendPushTest())
      setNotice({ error: false, text: 'Dịch vụ push đã nhận yêu cầu gửi thử. Điều này chưa bảo đảm điện thoại đã hiển thị thông báo.' })
    } catch (error) {
      const wait = error.retryAfter || Number(String(error.message).match(/retry_after=(\d+)/)?.[1])
      logPushFailure('send_test', error)
      const text = wait ? `Bạn có thể gửi thử lại sau ${wait} giây.`
        : error.code === 'permission_denied' ? 'Quyền thông báo chưa được cấp. Hãy mở Cài đặt iPhone → Thông báo, cho phép thông báo cho ứng dụng web này rồi thử lại.'
          : error.code === 'permission_dismissed' ? 'Bạn chưa cho phép thông báo. Hãy bấm gửi thử lại rồi chọn Cho phép khi iPhone hỏi.'
            : error.code === 'unsupported' ? 'Push chưa sẵn sàng trên trình duyệt này. Trên iPhone, hãy thêm website vào Màn hình chính rồi mở ứng dụng từ đó.'
              : pushDeliveryError(error)
      setNotice({ error: true, text }); setPushClientStatus(await inspectPushClient())
    } finally { setBusy(false); refresh().catch(() => {}) }
  }

  const enablePush = async () => {
    setBusy(true); setNotice(null)
    let failedStep = 'kiểm tra hỗ trợ thông báo'
    try {
      const data = await ensurePushSubscription()
      setSettings(value => ({ ...value, timezone: REMINDER_TIMEZONE, push_enabled: true, enabled: value.enabled }))
      setDevices(data.devices || []); setNotice({ error: false, text: 'Đã đăng ký thiết bị. Đang gửi thông báo xác nhận…' })
      try {
        requirePushAccepted(await client.sendPushTest())
        setNotice({ error: false, text: 'Dịch vụ push đã nhận yêu cầu gửi xác nhận. Điện thoại có thể mất ít phút để hiển thị.' })
      } catch (error) { logPushFailure('send_confirmation', error); setNotice({ error: true, text: `Thiết bị đã đăng ký. ${pushDeliveryError(error)} Bạn có thể dùng nút “Gửi thông báo thử ngay” sau.` }) }
      await refresh()
    } catch (error) {
      logPushFailure(failedStep, error)
      const text = error.code === 'permission_denied' ? 'Quyền thông báo chưa được cấp. Hãy mở Cài đặt iPhone → Thông báo, cho phép thông báo cho ứng dụng web này rồi thử lại.'
        : error.code === 'permission_dismissed' ? 'Bạn chưa cho phép thông báo. Hãy bật lại bằng nút push rồi chọn Cho phép khi iPhone hỏi.'
          : error.code === 'unsupported' ? 'Push chưa sẵn sàng trên trình duyệt này. Trên iPhone, hãy thêm website vào Màn hình chính rồi mở ứng dụng từ đó.'
          : error.message?.includes('Device limit') ? 'Đã đạt giới hạn 5 thiết bị. Xóa một thiết bị bên dưới rồi đăng ký lại.'
            : 'Chưa bật được thông báo trên thiết bị này. Hãy kiểm tra kết nối và quyền thông báo, rồi thử lại. Nếu vẫn chưa được, hãy liên hệ người quản lý ứng dụng.'
      setNotice({ error: true, text })
      setPushClientStatus(await inspectPushClient())
    } finally { setBusy(false) }
  }

  const ensurePushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidKey || typeof Notification === 'undefined') {
      const error = new Error('unsupported'); error.code = 'unsupported'; throw error
    }
    if (Notification.permission === 'denied') { const error = new Error('permission_denied'); error.code = 'permission_denied'; throw error }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') { const error = new Error('permission_dismissed'); error.code = 'permission_dismissed'; throw error }
    setPushClientStatus('checking')
    const registration = await navigator.serviceWorker.register('/sw.js')
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(vapidKey) })
    const data = await client.savePushSubscription(subscription.toJSON(), { id: deviceId(), name: deviceName() })
    setPushClientStatus('ready')
    return data
  }

  const removeDevice = async id => {
    setBusy(true); setNotice(null)
    try { const data = await client.deletePushSubscription(id); setDevices(data.devices || []); setSettings(value => ({ ...value, push_enabled: data.settings?.push_enabled === true })); setNotice({ error: false, text: 'Đã xóa thiết bị.' }) }
    catch { setNotice({ error: true, text: 'Chưa xóa được thiết bị. Hãy thử lại.' }) }
    finally { setBusy(false) }
  }

  const togglePush = async enabled => {
    if (enabled) return enablePush()
    setBusy(true)
    try { const data = await client.setPushEnabled(enabled); setSettings(value => ({ ...value, push_enabled: data.settings?.push_enabled === true })); setNotice({ error: false, text: enabled ? 'Đã bật nhắc học qua push.' : 'Đã tắt nhắc học qua push.' }) }
    catch { setNotice({ error: true, text: 'Chưa cập nhật được kênh push.' }) }
    finally { setBusy(false) }
  }

  const canEnableEmail = ready && Boolean(user.email_confirmed_at)
  return <section className="panel account-sync reminder-panel">
    <div className="account-section-heading"><span className="feature-icon"><BellRing size={22} aria-hidden="true" /></span><div><h2>Nhắc giờ học</h2><p>Chọn email, thông báo trên thiết bị, hoặc cả hai. Mỗi kênh có thể bật tắt riêng.</p></div></div>
    {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'} mt-5`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {!loaded ? <button type="button" className="btn btn-secondary mt-5" onClick={() => setAttempt(value => value + 1)}>Tải lại cài đặt</button> : <>
      <form onSubmit={saveEmail} className="reminder-form">
        <p className="auth-field-hint">Email nhận: <strong>{user.email}</strong></p>
        {!ready && <p className="notice">Dịch vụ email chưa được kích hoạt. Push vẫn hoạt động độc lập khi đã cấu hình.</p>}
        {!user.email_confirmed_at && <p className="notice">Hãy xác nhận email trước khi bật nhắc qua email.</p>}
        <fieldset disabled={busy} className="reminder-fields">
          <label className="reminder-toggle"><input type="checkbox" checked={settings.enabled} disabled={!canEnableEmail && !settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} />Nhắc qua email</label>
          <fieldset className="reminder-days">
            <legend>Ngày và giờ nhắc (giờ Việt Nam)</legend>
            <div className="reminder-toggle">
              <label><input type="radio" name="reminder-time-mode" checked={timeMode === 'common'} onChange={() => { const firstEnabled = settings.weekdays[0]; setCommonTime(firstEnabled === undefined ? '20:00' : settings.day_times[firstEnabled]); setTimeMode('common') }} />Cùng giờ mỗi ngày</label>
              <label><input type="radio" name="reminder-time-mode" checked={timeMode === 'per-day'} onChange={() => setTimeMode('per-day')} />Giờ riêng từng ngày</label>
            </div>
            {timeMode === 'common' ? <>
              <div className="reminder-day-row"><label htmlFor="common-reminder-time">Giờ nhắc</label><input id="common-reminder-time" aria-label="Giờ nhắc chung" type="time" required value={commonTime} onChange={e => setCommonTime(e.target.value)} /></div>
              {REMINDER_DAYS.map((day, index) => <div className="reminder-day-row" key={day}><label><input type="checkbox" checked={settings.weekdays.includes(index)} onChange={e => setSettings({ ...settings, weekdays: e.target.checked ? [...settings.weekdays, index].sort() : settings.weekdays.filter(value => value !== index) })} /><span>{day}</span></label></div>)}
            </> : REMINDER_DAYS.map((day, index) => <div className="reminder-day-row" key={day}>
              <label><input type="checkbox" checked={settings.weekdays.includes(index)} onChange={e => setSettings({ ...settings, weekdays: e.target.checked ? [...settings.weekdays, index].sort() : settings.weekdays.filter(value => value !== index), day_times: e.target.checked && !settings.weekdays.includes(index) ? settings.day_times.map((time, dayIndex) => dayIndex === index ? '20:00' : time) : settings.day_times })} /><span>{day}</span></label>
              <input aria-label={`Giờ nhắc ${day}`} type="time" required value={settings.day_times[index]} onChange={e => setSettings({ ...settings, day_times: settings.day_times.map((time, dayIndex) => dayIndex === index ? e.target.value : time) })} />
            </div>)}
          </fieldset>
          <button className="btn btn-primary" type="submit">{busy ? 'Đang lưu…' : 'Lưu lịch nhắc'}</button>
        </fieldset>
      </form>
      <p className="auth-field-hint" role="status">{activeScheduleText(settings, { emailReady: ready, pushReady })}</p>
      <div className="reminder-form">
        <label className="reminder-toggle"><input type="checkbox" checked={settings.push_enabled} disabled={busy || (!pushReady && !settings.push_enabled)} onChange={e => togglePush(e.target.checked)} />Nhắc bằng thông báo push</label>
        {!pushReady && <p className="auth-field-hint">Dịch vụ push chưa được cấu hình. Trên iPhone, thêm website vào Màn hình chính trước khi bật thông báo.</p>}
        {pushReady && settings.push_enabled && pushClientStatus === 'missing' && <p className="notice">Thiết bị này chưa có đăng ký push trên trình duyệt. Bấm “Gửi thông báo thử ngay” để kiểm tra quyền và tự đăng ký lại.</p>}
        {pushReady && settings.push_enabled && pushClientStatus === 'denied' && <p className="notice">Quyền thông báo của thiết bị này đang bị tắt. Hãy cho phép lại trong Cài đặt iPhone rồi bấm gửi thử để đồng bộ.</p>}
        {settings.push_enabled && <><p className="auth-field-hint">Thông báo theo lịch ở trên: {(settings.weekdays || []).map(day => `${REMINDER_DAYS[day]} ${settings.day_times[day]}`).join(', ')} (giờ Việt Nam).</p>
          <div className="reminder-devices"><h3>Thiết bị đã đăng ký ({devices.length}/5)</h3>{devices.map(device => <div className="reminder-device" key={device.id}><span><Smartphone size={16} aria-hidden="true" />{device.device_name}<small>{device.last_success_at ? `Được dịch vụ push nhận gần nhất ${new Date(device.last_success_at).toLocaleDateString('vi-VN')}` : `Đã thêm ${new Date(device.created_at).toLocaleDateString('vi-VN')}`}</small></span><button type="button" className="text-link" disabled={busy} aria-label={`Xóa thiết bị ${device.device_name}`} onClick={() => removeDevice(device.id)}><Trash2 size={16} />Xóa</button></div>)}</div>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={sendTest}>{busy ? 'Đang gửi…' : 'Gửi thông báo thử ngay'}</button>
        </>}
        {typeof Notification !== 'undefined' && Notification.permission === 'denied' && <p className="auth-field-hint">Quyền bị từ chối. Mở lại quyền thông báo trong cài đặt website của trình duyệt.</p>}
      </div>
      <p className="auth-field-hint">Lịch chạy ngay cả khi bạn đóng website. “Đã nhận” nghĩa là dịch vụ push nhận yêu cầu, không bảo đảm điện thoại đã hiển thị.</p>
    </>}
  </section>
}
