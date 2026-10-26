import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/authContext.js'

const labels = { loading: 'Đang tải tiến độ', pending: 'Chờ đồng bộ', saving: 'Đang đồng bộ', synced: 'Đã đồng bộ', offline: 'Chưa đồng bộ · Ngoại tuyến', error: 'Chưa đồng bộ · Cần kết nối lại' }
export default function SyncStatus({ compact = false }) {
  const { user, sync } = useAuth()
  if (!user) return null
  const Icon = ['offline', 'error'].includes(sync.status) ? CloudOff : ['saving', 'loading'].includes(sync.status) ? RefreshCw : Cloud
  return <span className={`sync-status ${compact ? 'sync-status-compact' : ''}`} data-status={sync.status} title={labels[sync.status]} role="status"><Icon size={15} aria-hidden="true" /><span>{labels[sync.status]}</span></span>
}
