# Lộ trình học tới ngày thi và ôn tập giãn cách

Trang Luyện câu hỏi (`/quiz`) dùng các phiên ngắn, tối đa 20 câu. Không mở toàn bộ chuyên đề trong một lượt nữa. Người học đăng nhập bằng email để lưu lịch; khách chỉ học thử, không lưu ngày bắt đầu, ngày thi hoặc tiến độ.

## Tính kế hoạch theo ngày

- Lần đầu thiết lập lộ trình cho tài khoản, lấy ngày của phiên đăng nhập (`last_sign_in_at`, hoặc ngày hiện tại nếu không có), theo `Asia/Ho_Chi_Minh`. Lưu ngày bắt đầu và không đổi nó trong các lần đăng nhập tiếp theo.
- Ngày thi mặc định hiện tại là **21/11/2026**, có thể đổi ngay ở phần Lộ trình trong `/quiz`. Nếu tạo lộ trình mới sau mốc mặc định này, mặc định là 30 ngày sau ngày tạo, người học nên chọn lại đúng ngày thi của mình.
- Số ngày trước thi không bao gồm ngày thi. Ngày làm đề/chữa đề được loại khỏi số ngày học câu mới. Dành giai đoạn cuối để củng cố: `min(7, floor(tổng số ngày từ bắt đầu đến thi / 3))` ngày.
- Mục tiêu câu mới mỗi ngày = làm tròn lên `(số câu chưa học + số câu mới đã học hôm nay) / số ngày học mới còn lại`. Cộng phần đã học hôm nay để mục tiêu không tăng liên tục sau mỗi câu trả lời.
- Số câu mới còn lại hôm nay = mục tiêu trừ số câu mới đã học hôm nay. Đây là hạn mức chung cho mọi chuyên đề trong ngân hàng luyện câu hỏi, tính theo ngày Việt Nam. Đổi chuyên đề hoặc mở phiên khác không cấp thêm hạn mức mới.
- Mỗi khi mở phiên học, ứng dụng tính lại theo phần chưa học và thời gian còn lại. Nếu nghỉ vài ngày, khối lượng phân bổ mỗi ngày tăng. Nếu còn câu chưa học trong giai đoạn củng cố, chia phần thiếu cho số ngày trước thi còn lại; ngày thi không thêm câu mới.
- Ngày học thông thường: số phiên ngắn cần làm hôm nay = làm tròn lên `(tổng câu đến hạn + câu mới còn lại hôm nay) / 20`. Ngày thi thử/chữa đề chỉ gợi ý thêm một phiên ôn nhanh tối đa 10 câu đến hạn; phần còn lại có thể tiếp tục sau. Khi gần thi có thể cần nhiều phiên trong ngày; không âm thầm cắt số câu mới xuống 10 rồi bỏ sót phần chưa học.

Ví dụ: bắt đầu **26/10/2026**, thi **21/11/2026**, có 26 ngày trước thi. Chừa 7 ngày cuối từ **14/11** để củng cố, còn 19 ngày học mới. Với ngân hàng hiện tại 257 câu, mục tiêu ban đầu là **14 câu mới/ngày**, cộng các câu đã đến hạn ôn. Mục tiêu giảm/tăng theo phần thực tế còn lại, không cố định 14 đến hết lịch.

Trang Tổng quan và Luyện câu hỏi hiển thị ngày bắt đầu, ngày thi, số ngày còn lại, mục tiêu hôm nay và số phiên cần làm. Bảng **Dự kiến 7 ngày tới** chia câu mới theo từng ngày nếu người học hoàn thành phần đã giao. Cột câu ôn chỉ chứa các câu đã có lịch; không giả định trước rằng mọi câu mới tương lai sẽ được trả lời đúng. Lịch cập nhật theo kết quả thực tế.

## Chừa thời gian thi thử và chữa đề

- Lộ trình từ 14 ngày trở lên: hai đề vào ngày trước thi 6 và 3 ngày, mỗi đề có một ngày chữa kế tiếp (trước thi 5 và 2 ngày).
- Lộ trình 5–13 ngày: một đề trước thi 3 ngày, chữa vào hôm sau.
- Chỉ còn 1–4 ngày: dành ngày trước thi cho một đề và chữa ngay cùng ngày. Nếu chỉ có một ngày chuẩn bị thì không còn ngày phân bổ kiến thức mới; giao diện vẫn thể hiện rõ giới hạn này, không giả định có thể phủ hết ngân hàng.
- Ngày thi thử/chữa đề không giao câu mới. Khi tính khối lượng mới hoặc bù phần chưa học, các ngày đã dành cho đề được trừ khỏi số ngày học khả dụng.
- Với mốc 21/11 và bắt đầu 26/10: thi thử **15/11, 18/11**, chữa đề **16/11, 19/11**. Những ngày củng cố ngoài lịch đề là **14/11, 17/11, 20/11**; lịch dài được chia nhóm vào các ngày này.
- Ngày thi thử có nút mở `/exam`; ngày chữa đề có nút mở đề đã lưu gần nhất qua `/exam?review=latest`. Nếu chưa có bài đã lưu, trang thi thông báo và cho bắt đầu đề mới. Mốc trong kế hoạch là lịch gợi ý, không phải xác nhận đã thi xong.

## Quy tắc giãn cách

- Câu đến hạn được ưu tiên theo hạn cũ nhất, rồi mới thêm câu mới vào chỗ còn lại của phiên 20 câu.
- Khi học tất cả chuyên đề, câu mới được lấy luân phiên giữa các chuyên đề để không học hết cả một phần trước.
- Trả lời đúng khi đến hạn: ôn sau **1 → 3 → 7 → 14 → 30 → 60 ngày**, tối đa khoảng 60 ngày ở bậc cuối.
- Trả lời sai: trở về bước học lại, hẹn **10 phút** sau, sau khi trả lời đúng ở lượt đến hạn tiếp theo quay về khoảng 1 ngày.
- Trả lời đúng lại trước hạn hoặc xử lý lặp cùng mã lượt ôn không tăng bậc. Đồng hồ chạy ngược không được ghi đè lịch mới hơn.
- Lượt củng cố cuối được chia nhóm câu ổn định theo các ngày không dành cho thi thử/chữa đề trong giai đoạn cuối, vào khoảng 12:00 giờ Việt Nam. Câu có lịch dài được đưa về mốc củng cố của nhóm; câu đã ôn sau mốc đó không bị ép ôn lại cùng lượt. Vì vậy lịch sát thi có thể ngắn hơn dãy khoảng cách thông thường, và lượt củng cố được rải ra thay vì tập trung toàn bộ vào một ngày.
- Sau mỗi đáp án hiển thị lần ôn tiếp theo. Lịch ghi ngay sau câu trả lời, không chờ làm xong cả phiên. Giữ các phím 1–4 và Space như trước.
- Khi hết câu đến hạn và đủ phần mới hôm nay, ứng dụng báo có thể nghỉ và hiển thị lần ôn tiếp, thay vì tạo thêm lượt lặp ngay lập tức.

Đây là lịch quy tắc đơn giản có điều chỉnh theo đúng/sai và hạn thi, không dùng FSRS hoặc dự đoán xác suất quên của từng người. Các mốc khoảng cách là lựa chọn của sản phẩm; không khẳng định đây là các mốc tối ưu cho mọi người hay đảm bảo thuộc toàn bộ kiến thức trước thi. Nghiên cứu về distributed practice hỗ trợ nguyên tắc giãn cách nhưng không quy định một lịch cố định chung cho mọi nội dung: [Cepeda và cộng sự, 2006](https://pubmed.ncbi.nlm.nih.gov/16719566/).

## Phạm vi và dữ liệu cũ

Lộ trình phân bổ **ngân hàng luyện câu hỏi** hiện có; không tự tạo nội dung ngoài ngân hàng. Thi thử, flashcard, bài đọc dài và nghe có quy trình riêng. Sổ tay câu sai giới hạn 20 câu/phiên; các câu thuộc ngân hàng luyện câu hỏi tuân theo lịch đến hạn. Câu đọc/nghe trong sổ tay vẫn là ôn bổ trợ và không được tự tạo lịch SRS trong phạm vi này.

Câu từng làm ở phiên bản cũ mà chưa có lịch SRS được xếp vào ôn lại, chưa coi là đã nhớ lâu. Không tự gán bậc cao chỉ dựa vào cờ “đã làm”. Bài thi thử không tự tăng bậc SRS; bài thi vẫn lưu kết quả và câu sai như trước.

## Lưu và đồng bộ

- Hai khóa tiến độ mới: `n3vjit_spacedRepetition` và `n3vjit_studyRoadmap`, lưu riêng theo tài khoản. Cùng cơ chế tự đồng bộ Supabase và backup hiện có; không cần migration bảng mới.
- Mỗi câu lưu bậc, hạn ôn, lần đầu/lần cuối ôn, ngày giới thiệu câu mới, số lượt, số lần quên, chuỗi đúng và mã lượt cuối.
- Ngày thi được đồng bộ. Mốc mặc định tự tạo trên một thiết bị mới không ghi đè ngày thi người dùng đã chọn; giữ ngày bắt đầu sớm nhất khi gộp hai thiết bị.
- Xung đột lịch của cùng câu chọn cả bản ghi mới hơn; nếu cùng thời điểm, ưu tiên lần sai rồi mã lượt để các thiết bị hội tụ. Không trộn bậc của lượt này với hạn ôn của lượt khác.
- Bỏ qua dữ liệu của câu đã rời ngân hàng khi tính số câu/ngân sách. Backup kiểm tra kiểu dữ liệu, ngày tháng và phạm vi bậc trước khi ghi.
- Xóa tiến độ xóa lịch các câu và các kết quả học, nhưng giữ ngày bắt đầu/ngày thi đã chọn như cài đặt lộ trình. Thay đổi này vẫn đồng bộ theo tài khoản.
- Mục tiêu mới là kế hoạch dựa trên bản dữ liệu hiện có, không phải quota cưỡng chế nguyên tử trên server. Khi học nhiều thiết bị cùng lúc, hãy đợi đồng bộ và tránh mở hai phiên mới song song. Đồng hồ thiết bị cần đúng; offline giữ lịch trên máy và gửi lại khi có mạng.

Thêm lịch SRS không tự đăng ký người học nhận email. Email nhắc học vẫn chỉ gửi khi tự bật và backend đã cấu hình; xem `REMINDERS.md`.

## Kiểm tra

```bash
node src/utils/spacedRepetition.test.js
npm test
npm run build
```

Kiểm tra thực tế: đăng nhập → chọn ngày thi → xem phần mới hôm nay/bảng 7 ngày → bắt đầu phiên → trả lời đúng và sai để kiểm tra hai hạn khác nhau → đổi thiết bị sau trạng thái Đã đồng bộ. Khách không tạo bất kỳ bản lịch nào.
