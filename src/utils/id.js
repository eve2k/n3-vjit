// getRandomValues also works on HTTP LAN origins where randomUUID is unavailable.
export function createId(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.randomUUID === 'function') return cryptoImpl.randomUUID()
  if (typeof cryptoImpl?.getRandomValues !== 'function') throw new Error('Trình duyệt chưa hỗ trợ tạo mã phiên học. Hãy cập nhật trình duyệt rồi thử lại.')
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
