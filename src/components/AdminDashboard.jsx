import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../context/authContext.js'

function adminErrorMessage(error) {
  const code = error?.message || error?.code
  if (code?.includes('admin_required') || error?.status === 403) return 'Tài khoản này không có quyền quản trị.'
  if (code?.includes('last_admin')) return 'Không thể gỡ quyền của admin cuối cùng.'
  if (code?.includes('user_not_found')) return 'Không tìm thấy tài khoản với email đó.'
  if (error?.status === 404 || error?.status === 400) return 'Chưa áp dụng migration phân quyền admin trên Supabase.'
  return 'Không tải hoặc cập nhật được danh sách tài khoản. Kiểm tra kết nối rồi thử lại.'
}

export default function AdminDashboard() {
  const { client, user } = useAuth()
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await client.listAdminUsers()
      if (!Array.isArray(rows)) throw new Error('invalid_response')
      setUsers(rows)
      setNotice(null)
      return true
    } catch (error) { setNotice({ error: true, text: adminErrorMessage(error) }); return false }
    finally { setLoading(false) }
  }, [client])

  useEffect(() => { loadUsers() }, [loadUsers])

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return users
    return users.filter(item => `${item.email} ${item.display_name}`.toLocaleLowerCase().includes(term))
  }, [users, query])

  const changeRole = async (account) => {
    const next = !account.is_admin
    const action = next ? 'cấp quyền admin cho' : 'thu hồi quyền admin của'
    if (!window.confirm(`Bạn muốn ${action} ${account.email}?`)) return
    setBusyId(account.user_id)
    setNotice(null)
    try {
      await client.setAdminRole(account.email, next)
      if (await loadUsers()) setNotice({ error: false, text: next ? `Đã cấp quyền admin cho ${account.email}.` : `Đã thu hồi quyền admin của ${account.email}.` })
    } catch (error) { setNotice({ error: true, text: adminErrorMessage(error) }) }
    finally { setBusyId('') }
  }

  const formatDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

  return <div className="page-shell admin-page">
    <div className="page-heading"><div><p className="eyebrow">QUẢN TRỊ</p><h1>Quản lý tài khoản</h1><p className="page-description">Cấp hoặc thu hồi quyền admin. Thay đổi được kiểm tra lại ở Supabase.</p></div><Link to="/" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Tổng quan</Link></div>
    {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'} mb-5`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    <section className="panel admin-users-panel">
      <div className="admin-users-toolbar"><label htmlFor="admin-user-search">Tìm theo tên hoặc email</label><input id="admin-user-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="name@example.com" /><button type="button" className="btn btn-secondary" disabled={loading} onClick={loadUsers}><RefreshCw size={16} aria-hidden="true" />Tải lại</button></div>
      {loading ? <p className="loading-state" role="status">Đang tải danh sách tài khoản…</p> : visibleUsers.length ? <div className="admin-table-scroll"><table className="admin-users-table"><thead><tr><th>Tài khoản</th><th>Ngày tạo</th><th>Xác minh</th><th>Quyền</th><th>Thao tác</th></tr></thead><tbody>{visibleUsers.map(account => <tr key={account.user_id}><td><strong>{account.display_name || 'Người học'}</strong><small>{account.email}</small></td><td>{formatDate(account.created_at)}</td><td><span className={`admin-confirmed ${account.email_confirmed ? 'is-confirmed' : ''}`}>{account.email_confirmed ? 'Đã xác minh' : 'Chưa xác minh'}</span></td><td>{account.is_admin ? <span className="admin-role-badge"><ShieldCheck size={14} aria-hidden="true" />Admin</span> : 'Người học'}</td><td><button type="button" className={`btn ${account.is_admin ? 'btn-secondary' : 'btn-primary'}`} disabled={Boolean(busyId)} onClick={() => changeRole(account)}>{busyId === account.user_id ? 'Đang lưu…' : account.is_admin ? 'Thu hồi quyền' : 'Cấp quyền admin'}</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><UserRound size={28} aria-hidden="true" /><p>{query ? 'Không tìm thấy tài khoản phù hợp.' : 'Chưa có tài khoản người học.'}</p></div>}
      {!loading && <p className="admin-list-count">Hiển thị {visibleUsers.length} / {users.length} tài khoản · Đang đăng nhập: {user?.email}</p>}
    </section>
  </div>
}
