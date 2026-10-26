import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext.js'
import { authErrorMessage } from '../utils/authValidation.js'

export default function AuthCallback() {
  const { client } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const hash = useRef(location.hash)
  const search = useRef(location.search)
  const task = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    window.history.replaceState(window.history.state, '', window.location.pathname)
    task.current ||= client.acceptCallback(hash.current, search.current)
    task.current.then(({ recovery }) => { if (active) navigate(recovery ? '/reset-password' : '/account', { replace: true }) })
      .catch((failure) => { if (active) setError(authErrorMessage(failure)) })
    return () => { active = false }
  }, [client, navigate])

  return <div className="page-shell"><section className="panel auth-callback"><h1>{error ? 'Chưa xác nhận được tài khoản' : 'Đang xác nhận liên kết…'}</h1>{error ? <><p className="notice notice-error" role="alert">{error}</p><Link to="/login" className="btn btn-primary">Về đăng nhập</Link><Link to="/forgot-password" className="text-link">Yêu cầu liên kết đặt lại mật khẩu</Link></> : <p role="status">Vui lòng đợi trong giây lát.</p>}</section></div>
}
