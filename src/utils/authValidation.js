export function validateAuthForm(mode, fields) {
  const errors = {}
  if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email?.trim() || '')) errors.email = 'Nhập địa chỉ email hợp lệ.'
  if (mode === 'register' && !fields.name?.trim()) errors.name = 'Nhập tên bạn muốn hiển thị.'
  if (mode !== 'forgot') {
    if (!fields.password) errors.password = 'Nhập mật khẩu.'
    else if (mode !== 'login' && fields.password.length < 8) errors.password = 'Mật khẩu cần ít nhất 8 ký tự.'
    if (['register', 'reset'].includes(mode) && fields.confirmPassword !== fields.password) errors.confirmPassword = 'Hai mật khẩu chưa khớp nhau.'
  }
  return errors
}

export function authErrorMessage(error) {
  const messages = {
    invalid_credentials: 'Email hoặc mật khẩu chưa đúng.',
    invalid_grant: 'Email hoặc mật khẩu chưa đúng, hoặc phiên đăng nhập đã hết hạn.',
    bad_jwt: 'Phiên hoặc liên kết đăng nhập không còn hợp lệ. Hãy đăng nhập lại.',
    email_not_confirmed: 'Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn.',
    user_already_exists: 'Không thể tạo tài khoản với email này. Hãy thử đăng nhập hoặc đặt lại mật khẩu.',
    email_exists: 'Không thể tạo tài khoản với email này. Hãy thử đăng nhập hoặc đặt lại mật khẩu.',
    weak_password: 'Mật khẩu chưa đáp ứng yêu cầu. Hãy dùng mật khẩu dài và khó đoán hơn.',
    over_email_send_rate_limit: 'Bạn vừa yêu cầu gửi email. Hãy đợi một lúc rồi thử lại.',
    over_request_rate_limit: 'Có quá nhiều yêu cầu. Hãy đợi một lúc rồi thử lại.',
    otp_expired: 'Liên kết xác nhận đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu email mới.',
    same_password: 'Mật khẩu mới cần khác mật khẩu cũ.',
    session_not_found: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
    refresh_token_not_found: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
    refresh_token_already_used: 'Phiên đăng nhập đã thay đổi. Hãy đăng nhập lại.',
    not_configured: 'Đăng nhập chưa sẵn sàng. Bạn vẫn có thể tiếp tục học với chế độ khách.',
    network_error: 'Chưa kết nối được với dịch vụ tài khoản. Kiểm tra mạng rồi thử lại.',
  }
  return messages[error?.code] || (error?.status === 429 ? 'Có quá nhiều yêu cầu. Hãy đợi một lúc rồi thử lại.' : 'Không thể hoàn tất yêu cầu. Hãy thử lại sau.')
}
