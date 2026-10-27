import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Cloud, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { readProgressSnapshot } from '../utils/storage.js'
import { getQuizProgress } from '../utils/learning.js'
import StudyReminderSettings from './StudyReminderSettings.jsx'
import SyncStatus from './SyncStatus.jsx'

export default function AccountPage() {
  const { user, client, sync, syncNow, isAdmin, adminLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [notice] = useState(location.state?.passwordUpdated ? { text: 'Đã cập nhật mật khẩu của bạn.', error: false } : null)
  let local = {}
  try { local = readProgressSnapshot(user?.id) } catch { /* Show sync errors without blocking account access. */ }
  const completed = getQuizProgress(local.n3vjit_completedQuestions || {})
  const mastered = local.n3vjit_masteredFlashcards?.length || 0
  const exams = local.n3vjit_quizHistory?.length || 0

  if (!user) return <Navigate to="/login" replace />

  return <div className="page-shell account-page">
    <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN HỌC TẬP CỦA BẠN</p><h1>Tài khoản của tôi</h1><p className="page-description">Đăng nhập một lần, tiếp tục học trên các thiết bị của bạn.</p></div><Link to="/" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Về học tập</Link></div>
    {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'} mb-5`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    <section className="panel account-profile"><span className="account-avatar"><UserRound size={30} aria-hidden="true" /></span><div><h2>{user.user_metadata?.display_name || user.user_metadata?.full_name || 'Người học N3'}</h2><p>{user.email}</p><span className="local-badge"><ShieldCheck size={14} aria-hidden="true" />{user.email_confirmed_at ? 'Email đã được xác nhận' : 'Đã đăng nhập'}</span>{!adminLoading && isAdmin && <Link to="/admin" className="admin-role-badge account-admin-link"><ShieldCheck size={14} aria-hidden="true" />Admin · Mở trang quản trị</Link>}</div><button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); await syncNow(); client.signOut().catch(() => {}); navigate('/', { replace: true }) }}><LogOut size={16} aria-hidden="true" />{busy ? 'Đang lưu…' : 'Đăng xuất'}</button></section>
    <div className="account-stat-grid"><div className="panel"><strong>{completed}</strong><span>Câu hỏi đã làm</span></div><div className="panel"><strong>{mastered}</strong><span>Flashcard đã thuộc</span></div><div className="panel"><strong>{exams}</strong><span>Bài thi đã lưu</span></div></div>
    <section className="panel account-sync"><div className="account-section-heading"><span className="feature-icon"><Cloud size={22} aria-hidden="true" /></span><div><h2>Tiến độ tự đồng bộ</h2><p>Câu đã làm, flashcard, bài viết đã lưu và kết quả thi tự lưu lên tài khoản. Đăng nhập cùng tài khoản trên thiết bị khác để học tiếp.</p></div></div><div className="account-cloud-status"><SyncStatus /></div>{sync.updatedAt && <p className="auth-field-hint">Lần đồng bộ gần nhất: {new Date(sync.updatedAt).toLocaleString('vi-VN')}</p>}{['offline', 'error'].includes(sync.status) && <p className="notice notice-error" role="alert">Chưa kết nối được nơi lưu tiến độ. Dữ liệu vẫn được giữ trên thiết bị; ứng dụng sẽ tự thử lại. Nếu lỗi kéo dài, quản trị viên cần kiểm tra bảng lưu tiến độ trên Supabase.</p>}<button type="button" className="btn btn-secondary" disabled={busy || ['loading', 'saving'].includes(sync.status)} onClick={() => syncNow()}><RefreshCw size={16} aria-hidden="true" />Đồng bộ ngay</button><p className="auth-field-hint">Khi mất mạng, bạn vẫn có thể học. Hãy đợi trạng thái “Đã đồng bộ” trước khi chuyển thiết bị. Đăng xuất không xóa tiến độ trên máy.</p></section>
    <StudyReminderSettings key={user.id} />
  </div>
}
