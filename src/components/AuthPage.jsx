import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { authErrorMessage, validateAuthForm } from '../utils/authValidation.js'

const COPY = {
  login: { title: 'Chào mừng bạn trở lại', description: 'Đăng nhập để tiếp tục hành trình học của riêng bạn.', action: 'Đăng nhập' },
  register: { title: 'Bắt đầu cùng N3-VJIT', description: 'Tạo tài khoản để giữ lại những bước tiến mỗi ngày.', action: 'Tạo tài khoản' },
  forgot: { title: 'Bạn quên mật khẩu?', description: 'Nhập email để nhận liên kết đặt lại mật khẩu.', action: 'Gửi liên kết đặt lại' },
  reset: { title: 'Đặt mật khẩu mới', description: 'Chọn mật khẩu mới cho tài khoản của bạn.', action: 'Lưu mật khẩu mới' },
}

export default function AuthPage({ mode = 'login' }) {
  const { user, client, configured, restoreError } = useAuth()
  const navigate = useNavigate()
  const [fields, setFields] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [resendAfter, setResendAfter] = useState(0)
  const copy = COPY[mode]

  const change = (name, value) => {
    setFields((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: null }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const nextErrors = validateAuthForm(mode, fields)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true); setNotice(null)
    const redirect = new URL('/auth/callback', window.location.origin).href
    try {
      if (mode === 'login') { await client.signIn(fields.email, fields.password); navigate('/account', { replace: true }) }
      else if (mode === 'register') {
        const result = await client.signUp(fields.name, fields.email, fields.password, redirect)
        if (result.needsConfirmation) {
          setConfirmationSent(true)
          setNotice({ text: 'Hãy kiểm tra email để xác nhận đăng ký. Nếu không thấy thư, kiểm tra mục thư rác hoặc thử đăng nhập nếu bạn đã có tài khoản.', error: false })
        } else navigate('/account', { replace: true })
      } else if (mode === 'forgot') {
        await client.sendRecovery(fields.email, redirect)
        setNotice({ text: 'Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư và mục thư rác.', error: false })
      } else { await client.setPassword(fields.password); navigate('/account', { replace: true, state: { passwordUpdated: true } }) }
      setFields((previous) => ({ ...previous, password: '', confirmPassword: '' }))
    } catch (error) {
      setNotice({ text: authErrorMessage(error), error: true })
      if (error.code === 'email_not_confirmed') setConfirmationSent(true)
    } finally { setBusy(false) }
  }

  const resend = async () => {
    if (busy || Date.now() < resendAfter) return
    setBusy(true); setNotice(null)
    try {
      await client.resendConfirmation(fields.email, new URL('/auth/callback', window.location.origin).href)
      setResendAfter(Date.now() + 60000)
      setNotice({ text: 'Đã yêu cầu gửi lại email xác nhận. Hãy đợi một phút trước khi gửi lại lần nữa.', error: false })
    } catch (error) { setNotice({ text: authErrorMessage(error), error: true }) }
    finally { setBusy(false) }
  }

  if (user && ['login', 'register'].includes(mode)) return <Navigate to="/account" replace />

  return <div className="page-shell auth-page">
    <aside className="auth-story"><span className="auth-story-icon"><GraduationCap size={30} aria-hidden="true" /></span><p className="eyebrow">HỌC ĐỀU MỖI NGÀY</p><h1>Mỗi lần quay lại,<br />một bước gần N3 hơn.</h1><p>Từ những câu hỏi đầu tiên đến lúc tự tin làm đề — giữ lại hành trình học theo cách của bạn.</p><div className="auth-benefit"><CheckCircle2 size={19} aria-hidden="true" /><span>Tiến độ riêng cho từng tài khoản</span></div><div className="auth-benefit"><ShieldCheck size={19} aria-hidden="true" /><span>Tự đồng bộ để học tiếp trên thiết bị khác</span></div><div className="auth-benefit"><BookOpen size={19} aria-hidden="true" /><span>Vẫn có thể học ngay với chế độ khách</span></div><Link to="/" className="text-link"><ArrowLeft size={16} aria-hidden="true" />Tiếp tục học với chế độ khách</Link></aside>
    <section className="panel auth-form-panel" aria-labelledby="auth-form-heading">
      {['login', 'register'].includes(mode) && <nav className="auth-form-tabs" aria-label="Tài khoản"><Link to="/login" className={mode === 'login' ? 'is-active' : ''}>Đăng nhập</Link><Link to="/register" className={mode === 'register' ? 'is-active' : ''}>Đăng ký</Link></nav>}
      <h2 id="auth-form-heading">{copy.title}</h2><p className="auth-description">{copy.description}</p>
      {!configured && <p className="notice notice-error" role="status">Đăng nhập chưa sẵn sàng. Bạn vẫn có thể học với chế độ khách.</p>}
      {restoreError && <p className="notice notice-error" role="status">Chưa khôi phục được phiên đăng nhập trước. Hãy kiểm tra mạng hoặc đăng nhập lại.</p>}
      {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {mode === 'reset' && !user ? <div className="empty-state"><p>Hãy mở liên kết đặt lại mật khẩu trong email để tiếp tục.</p><Link to="/forgot-password" className="btn btn-primary">Yêu cầu liên kết mới</Link></div> : <form onSubmit={submit} noValidate aria-busy={busy}>
        {mode === 'register' && <AuthField name="name" label="Tên hiển thị" autoComplete="name" maxLength={80} value={fields.name} error={errors.name} disabled={busy} onChange={change} />}
        {mode !== 'reset' && <AuthField name="email" label="Email" type="email" autoComplete="username" maxLength={254} value={fields.email} error={errors.email} disabled={busy} onChange={change} />}
        {mode !== 'forgot' && <PasswordField name="password" label={mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={fields.password} error={errors.password} disabled={busy} onChange={change} />}
        {['register', 'reset'].includes(mode) && <><p className="auth-field-hint">Dùng ít nhất 8 ký tự. Không dùng lại mật khẩu ở dịch vụ khác.</p><PasswordField name="confirmPassword" label="Nhập lại mật khẩu" autoComplete="new-password" value={fields.confirmPassword} error={errors.confirmPassword} disabled={busy} onChange={change} /></>}
        {mode === 'login' && <Link to="/forgot-password" className="text-link auth-forgot-link">Quên mật khẩu?</Link>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !configured}>{busy ? 'Đang xử lý…' : copy.action}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>}
      {confirmationSent && <button type="button" className="btn btn-secondary w-full mt-3" disabled={busy} onClick={resend}>Gửi lại email xác nhận</button>}
      {!['login', 'register'].includes(mode) && <Link to="/login" className="text-link mt-5"><ArrowLeft size={15} aria-hidden="true" />Trở về đăng nhập</Link>}
      <p className="auth-footer">Khách có thể học thử; đăng nhập trước khi học để lưu tiến độ.</p>
    </section>
  </div>
}

function AuthField({ name, label, error, value, onChange, ...props }) {
  return <div className="auth-field"><label htmlFor={`auth-${name}`}>{label}</label><input id={`auth-${name}`} name={name} value={value} onChange={(event) => onChange(name, event.target.value)} required aria-invalid={Boolean(error)} aria-describedby={error ? `auth-${name}-error` : undefined} {...props} />{error && <p id={`auth-${name}-error`} className="auth-field-error">{error}</p>}</div>
}

function PasswordField({ name, label, error, value, onChange, ...props }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-field"><label htmlFor={`auth-${name}`}>{label}</label><div className="auth-password"><input id={`auth-${name}`} name={name} type={visible ? 'text' : 'password'} maxLength={128} value={value} onChange={(event) => onChange(name, event.target.value)} required aria-invalid={Boolean(error)} aria-describedby={error ? `auth-${name}-error` : undefined} {...props} /><button type="button" aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{error && <p id={`auth-${name}-error`} className="auth-field-error">{error}</p>}</div>
}
