export const REMINDER_TIMEZONE = 'Asia/Ho_Chi_Minh'
export const DEFAULT_REMINDER = { enabled: false, local_time: '20:00', timezone: REMINDER_TIMEZONE, weekdays: [0, 1, 2, 3, 4, 5, 6], day_times: Array(7).fill('20:00') }
export const REMINDER_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export function validateReminder(value) {
  if (typeof value?.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.local_time || '')) return 'Giờ học chưa hợp lệ.'
  if (!value.timezone || !Array.isArray(value.weekdays) || !value.weekdays.length || value.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(value.weekdays).size !== value.weekdays.length) return 'Chọn ít nhất một ngày học trong tuần.'
  if (!Array.isArray(value.day_times) || value.day_times.length !== 7 || value.day_times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || ''))) return 'Giờ nhắc chưa hợp lệ.'
  return ''
}
