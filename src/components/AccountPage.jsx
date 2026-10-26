import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Cloud, Download, GitMerge, LogOut, RefreshCw, ShieldCheck, Upload, UserRound } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { readProgressSnapshot, writeProgressSnapshot } from '../utils/storage.js'
import { getQuizProgress } from '../utils/learning.js'
import { mergeProgress } from '../utils/mergeProgress.js'
import { authErrorMessage } from '../utils/authValidation.js'

export default function AccountPage() {
  const { user, client } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const location = useLocation()
  const [remote, setRemote] = useState(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(location.state?.passwordUpdated ? { text: 'Đã cập nhật mật khẩu của bạn.', error: false } : null)
  const [, refreshLocal] = useState(0)
  const [snapshotError, setSnapshotError] = useState(false)
  let local = {}
  let guest = {}
  try { local = readProgressSnapshot(user?.id); guest = readProgressSnapshot(null) } catch { /* The page still allows downloading a valid cloud backup. */ }
  const guestHasProgress = Object.keys(guest).length > 0
  const completed = getQuizProgress(local.n3vjit_completedQuestions || {})
  const mastered = local.n3vjit_masteredFlashcards?.length || 0
  const exams = local.n3vjit_quizHistory?.length || 0

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    client.loadProgress().then((data) => { if (active) { setRemote(data); setCloudReady(true) } })
      .catch(() => { if (active) setNotice({ text: 'Chưa tải được bản lưu trên tài khoản. Tiến độ trên thiết bị vẫn được giữ lại. Bạn có thể thử kết nối lại.', error: true }) })
    return () => { active = false }
  }, [client, userId])

  const retry = async () => {
    setBusy('retry'); setNotice(null)
    try { setRemote(await client.loadProgress()); setCloudReady(true) }
    catch { setCloudReady(false); setNotice({ text: 'Chưa kết nối được nơi lưu tiến độ. Hãy thử lại sau; bạn vẫn có thể học và sao lưu trên thiết bị.', error: true }) }
    finally { setBusy(null) }
  }

  const upload = async () => {
    if (busy || !cloudReady) return
    if (remote && !window.confirm('Thay thế bản lưu trên tài khoản bằng tiến độ hiện tại trên thiết bị này?')) return
    setBusy('upload'); setNotice(null)
    try {
      const snapshot = readProgressSnapshot(user.id)
      const saved = await client.saveProgress(snapshot, remote?.updated_at || null)
      setRemote(saved)
      setNotice({ text: 'Đã lưu tiến độ hiện tại lên tài khoản.', error: false })
    } catch (error) {
      if (error.status === 409) { setCloudReady(false); setNotice({ text: 'Bản lưu đã thay đổi trên thiết bị khác. Hãy kết nối lại để kiểm tra bản mới trước khi lưu.', error: true }) }
      else setNotice({ text: error.code === 'session_not_found' ? authErrorMessage(error) : 'Chưa lưu được tiến độ lên tài khoản. Tiến độ trên thiết bị vẫn được giữ lại.', error: true })
    } finally { setBusy(null) }
  }

  const download = async () => {
    if (busy || !remote || !cloudReady) return
    if (!window.confirm('Khôi phục tiến độ từ tài khoản sẽ thay thế tiến độ của tài khoản này trên thiết bị. Tiếp tục?')) return
    setBusy('download'); setNotice(null)
    try {
      const saved = await client.loadProgress()
      if (!saved) throw new Error('missing_progress')
      writeProgressSnapshot(saved.data, user.id)
      setSnapshotError(false)
      setRemote(saved)
      refreshLocal((value) => value + 1)
      window.dispatchEvent(new Event('n3vjit:progress'))
      setNotice({ text: 'Đã khôi phục tiến độ từ tài khoản về thiết bị này.', error: false })
    } catch { setNotice({ text: 'Không thể khôi phục bản lưu. Tiến độ hiện tại trên thiết bị được giữ lại.', error: true }) }
    finally { setBusy(null) }
  }

  const importGuest = () => {
    if (!window.confirm('Gộp tiến độ khách trên thiết bị này vào tài khoản đang đăng nhập? Bản tiến độ khách vẫn được giữ nguyên.')) return
    try {
      writeProgressSnapshot(mergeProgress(readProgressSnapshot(user.id), readProgressSnapshot(null)), user.id)
      refreshLocal((value) => value + 1)
      window.dispatchEvent(new Event('n3vjit:progress'))
      setNotice({ text: 'Đã gộp tiến độ khách vào tài khoản trên thiết bị. Nhấn “Lưu lên tài khoản” để cập nhật bản lưu trực tuyến.', error: false })
    } catch { setSnapshotError(true); setNotice({ text: 'Không thể gộp tiến độ. Dữ liệu hiện tại vẫn được giữ lại.', error: true }) }
  }

  if (!user) return <Navigate to="/login" replace />

  return <div className="page-shell account-page">
    <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN HỌC TẬP CỦA BẠN</p><h1>Tài khoản của tôi</h1><p className="page-description">Quản lý tài khoản và bản lưu tiến độ học tập.</p></div><Link to="/" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Về học tập</Link></div>
    {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'} mb-5`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    <section className="panel account-profile"><span className="account-avatar"><UserRound size={30} aria-hidden="true" /></span><div><h2>{user.user_metadata?.display_name || 'Người học N3'}</h2><p>{user.email}</p><span className="local-badge"><ShieldCheck size={14} aria-hidden="true" />{user.email_confirmed_at ? 'Email đã được xác nhận' : 'Đã đăng nhập'}</span></div><button type="button" className="btn btn-secondary" onClick={() => { client.signOut().catch(() => {}); navigate('/', { replace: true }) }}><LogOut size={16} aria-hidden="true" />Đăng xuất</button></section>
    <div className="account-stat-grid"><div className="panel"><strong>{completed}</strong><span>Câu hỏi đã làm</span></div><div className="panel"><strong>{mastered}</strong><span>Flashcard đã thuộc</span></div><div className="panel"><strong>{exams}</strong><span>Bài thi đã lưu</span></div></div>
    <section className="panel account-sync"><div className="account-section-heading"><span className="feature-icon"><Cloud size={22} aria-hidden="true" /></span><div><h2>Lưu tiến độ theo tài khoản</h2><p>Tiến độ tự lưu trên thiết bị, riêng cho tài khoản này. Bạn chủ động lưu lên tài khoản hoặc tải về khi đổi thiết bị.</p></div></div><p className="account-cloud-status">{!cloudReady ? 'Chưa kết nối được bản lưu trực tuyến.' : remote ? `Bản lưu gần nhất: ${new Date(remote.updated_at).toLocaleString('vi-VN')}` : 'Tài khoản chưa có bản lưu trực tuyến.'}</p><div className="flex flex-wrap gap-3"><button type="button" className="btn btn-primary" disabled={Boolean(busy) || !cloudReady} onClick={upload}><Upload size={16} aria-hidden="true" />{busy === 'upload' ? 'Đang lưu…' : 'Lưu lên tài khoản'}</button><button type="button" className="btn btn-secondary" disabled={Boolean(busy) || !cloudReady || !remote} onClick={download}><Download size={16} aria-hidden="true" />{busy === 'download' ? 'Đang tải…' : 'Tải tiến độ về máy'}</button><button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={retry}><RefreshCw size={16} aria-hidden="true" />{busy === 'retry' ? 'Đang kết nối…' : 'Kết nối lại'}</button></div><p className="auth-field-hint">Đăng xuất không xóa tiến độ đã lưu trên thiết bị. Người khác đăng nhập sẽ có dữ liệu riêng.</p></section>
    <section className="panel account-sync"><div className="account-section-heading"><span className="feature-icon"><GitMerge size={22} aria-hidden="true" /></span><div><h2>Tiếp nối tiến độ đã học khi là khách</h2><p>Gộp câu đã làm, flashcard, bài viết và lịch sử thi từ chế độ khách. Các mục trùng được hợp nhất; bản khách vẫn được giữ lại.</p></div></div><button type="button" className="btn btn-secondary mt-5" disabled={Boolean(busy) || !guestHasProgress || snapshotError} onClick={importGuest}><GitMerge size={16} aria-hidden="true" />{guestHasProgress ? 'Gộp tiến độ khách vào tài khoản' : 'Chưa có tiến độ khách để gộp'}</button></section>
  </div>
}
