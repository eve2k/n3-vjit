# N3-VJIT Exam Mastery

Website ôn tập tiếng Nhật N3 bằng React và Vite, gồm 257 câu trắc nghiệm, đọc hiểu, luyện nghe, flashcard, ngữ pháp, hội thoại và viết bài.

## Chạy trên máy

Dùng Node.js 22.12 trở lên. Trong thư mục dự án:

```bash
npm ci --include=optional
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal, thường là `http://localhost:5173`.

Nếu chuyển dự án từ Windows sang Linux và gặp lỗi `Cannot find native binding`, chạy lại `npm ci --include=optional` để cài thư viện đúng hệ điều hành. Cần kết nối internet khi cài thư viện.

## Kiểm tra và build

```bash
npm test
npm run build
npm run preview
```

Kết quả build nằm trong `dist/`. Khi đưa lên hosting, cấu hình trả về `index.html` cho các đường dẫn ứng dụng như `/exam`, `/quiz`, `/grammar` và `/flashcards` để hỗ trợ mở liên kết trực tiếp.

Repository chỉ cần mã nguồn, tài nguyên trong `public/`, cấu hình và `package-lock.json`. Các thư mục `node_modules/`, `dist/`, cache, log và tệp môi trường riêng được bỏ qua; chạy `npm ci --include=optional` rồi `npm run build` sau khi clone.

## Thi thử tổng hợp

- 35 câu đọc hiểu từ ngân hàng trắc nghiệm, 2 bài đọc văn với câu hỏi đi kèm, 30 câu nghe và 1 chủ đề viết.
- Đọc hiểu, bài đọc văn và nghe chấm riêng trên thang 10. Phần nào dưới 3 điểm là **Không đạt**; đúng 3 điểm được tính là đạt. Kết quả chung chỉ đạt khi cả ba phần đạt, không dùng điểm trung bình để bù điểm liệt.
- Bài viết được lưu trong bài đã nộp để xem lại, **không tính điểm** và không ảnh hưởng kết quả đạt/không đạt.
- Đọc hiểu và bài đọc văn tự chấm theo tỉ lệ câu đúng; câu bỏ trống tính 0 điểm. Điểm liệt được so sánh trước khi làm tròn số hiển thị.
- Ngân hàng nghe hiện có 53 câu, chỉ 12 câu có đáp án và chưa có file nghe kèm theo. Đề chọn 30 câu không trùng. Có thể mở file âm thanh trên thiết bị nếu file đó khớp với các câu được chọn; ứng dụng chưa tự tạo hoặc ghép audio theo đề ngẫu nhiên.
- Do còn thiếu đáp án nghe, điểm toàn phần nghe cần nhập sau khi được chấm. Chưa nhập điểm sẽ hiển thị **Chờ chấm**; ứng dụng không tự suy đoán điểm của các câu thiếu đáp án.
- Lịch sử lưu cấu trúc đề, đáp án đã chọn, bài viết, thời gian, điểm và kết quả từng phần. Có thể mở lại bài từ trang tổng quan để cập nhật điểm nghe, không tạo thêm lịch sử trùng.

## Tiến độ học tập

- Trang tổng quan có tiến độ riêng từng chuyên đề, nút học tiếp và 5 kết quả thi gần nhất.
- Câu bỏ trống không được đánh dấu là đã hoàn thành; kết quả thi lưu cả thời gian làm bài.
- Sổ tay câu sai hỗ trợ câu trắc nghiệm, đọc hiểu và các câu nghe có đáp án. Trả lời đúng trong 2 lượt ôn để bỏ câu khỏi sổ tay.
- Flashcard có bộ lọc thẻ chưa thuộc; chuyển thẻ sẽ trở về mặt câu hỏi.
- Luyện câu hỏi, đọc hiểu, nghe và thi thử hỗ trợ phím 1–4 chọn đáp án theo thứ tự A–D (hoặc 1–4); Space xác nhận, Space lần nữa chuyển câu. Phím tắt không hoạt động khi nhập văn bản/điểm hoặc dùng nút điều khiển khác. Flashcard giữ Space để lật thẻ.
- Dữ liệu lưu trong `localStorage` của trình duyệt, chưa có tài khoản hay đồng bộ giữa các thiết bị.
- Dùng **Sao lưu** trên trang tổng quan để tải tệp JSON. **Khôi phục** hỗ trợ cả bản sao lưu cũ và định dạng có phiên bản mới, kiểm tra dữ liệu trước khi ghi. Các mục có trong tệp sẽ thay thế dữ liệu tương ứng trên máy.
- Dữ liệu của `localhost` và tên miền công khai được lưu riêng. Hãy xuất tệp sao lưu rồi nhập trên tên miền mới khi chuyển sang website đã triển khai.
