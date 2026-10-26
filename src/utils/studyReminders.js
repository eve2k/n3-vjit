export const DEFAULT_REMINDER = { enabled: false, local_time: '20:00', timezone: 'Asia/Ho_Chi_Minh', weekdays: [0, 1, 2, 3, 4, 5, 6] }
export const REMINDER_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export function validateReminder(value) {
  if (typeof value?.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.local_time || '')) return 'Giờ học chưa hợp lệ.'
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: value.timezone }).format() } catch { return 'Múi giờ chưa hợp lệ.' }
  if (!value.timezone || !Array.isArray(value.weekdays) || !value.weekdays.length || value.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(value.weekdays).size !== value.weekdays.length) return 'Chọn ít nhất một ngày học trong tuần.'
  return ''
}
