# Ôn tập — giao diện, dữ liệu và đồng bộ

Route `/review` có hai tab **Cần củng cố** và **Đã thành thạo**. `/mistakes`
chuyển hướng về `/review`. `/review/test` là màn hình kiểm tra tập trung, ẩn nav.
Khách cần đăng nhập; không cần migration Supabase.

Chọn chặng trong tab Đã thành thạo để xem câu theo bài và thiết lập kiểm tra.
Có Trắc nghiệm, Đúng/Sai và Tự luận (chỉ ba chặng bốn bậc). Phiên dở có thể
tiếp tục từ banner ở trang Ôn tập. Sau khi hoàn thành, tổng kết chỉ ở bộ nhớ;
reload hiển thị phiên đã đóng, còn kết quả từng thẻ vẫn được lưu.

## Quy tắc thẻ

- Bài kiểm tra thành thạo chỉ chọn Kanji/Từ vựng/Chia thể bậc 3.
- Trả lời đúng giữ bậc; sai từ 3 về 2 và thêm `needsRecheck: true`.
- Thẻ bậc 2 có cờ vào hàm đếm củng cố dùng chung và nhóm `recheckQuestions`.
- `answerCard` (luồng **Ôn bài này**) và `applyReviewAnswer` (luồng ôn thẻ sai)
  đều phục hồi thẻ có cờ lên 3 khi đúng, hoặc xuống 1 khi sai; cả hai xóa cờ.
  Quy tắc phục hồi được ưu tiên kể cả khi thẻ đã tăng bậc trong vòng hiện tại.
- Sai tiếp ở bậc 1/0 dùng quy tắc chung; không tạo lại cờ. Đúng trong kiểm tra
  giữ bậc thông thường, còn học tại node vẫn dùng quy tắc tăng bậc của vòng học.
- `lastReviewedAt` nằm trong bản ghi thẻ, đi cùng `updatedAt` và `updateId`.
  Việc học tiếp bảo toàn ngày kiểm tra gần nhất; phục hồi thẻ có cờ cập nhật ngày đó.

## Kết quả Ngữ pháp và Đọc hiểu

Không suy luận từ `completedQuestions`, `wrongQuestions` hay `dokkaiProgress`.
Từ bản này, các hàm ghi đúng/sai dùng bởi `/quiz`, `/dokkai` và bài học/kiểm tra
chặng ghi thêm kết quả thực tế. Chỉ `correct: true` ở lần gần nhất mới đủ điều kiện.

`reviewQuestionIds.js` có bảng ánh xạ 48 cặp theo ngân hàng nguồn, ví dụ
`dk1:dk1_q1` → `dokkai:dk1_q1`. Chỉ chuẩn hóa lúc tra cứu, chọn thẻ và tạo phiên.
Không đổi ID trong ngân hàng, khóa completed/wrong hoặc ID đã lưu trong kết quả.
Nếu có cả hai alias, đọc kết quả mới nhất và chỉ đếm một thẻ.
Đọc hiểu được gom theo 10 bài đọc nguồn (48 câu), không cắt cố định 4 câu/bài.

## Dữ liệu lưu

Khóa tài khoản `n3vjit_review` chứa:

```js
{
  results: {
    'renshuu4:r4_q1': {
      correct: true,
      answeredAt: '2026-10-27T01:00:00.000Z',
      updateId: 'unique-answer-id',
      source: 'practice', // checkpoint | review-test | review-retry
      // lastReviewedAt: ngày kiểm tra gần nhất, khi đã từng kiểm tra
      // selfCorrected: true, nếu người học tự xác nhận đáp án tự luận
    }
  },
  session: null // chưa có phiên; hoặc bản ghi bên dưới
}
```

Trong khi làm bài, `session` gồm `id`, `startedAt`, `updatedAt`, `updateId`,
và `data` chứa chặng, chế độ, loại phiên, thứ tự câu/lựa chọn, đáp án đã nộp
và `cursor` của câu đang hiển thị. Reload giữ cả phản hồi của câu vừa trả lời.
Không sao chép toàn bộ văn bản ngân hàng vào phiên.

Khi hoàn thành, `data` được thay bằng `null`: xóa toàn bộ câu/lựa chọn/câu trả lời.
Chỉ giữ một dấu mốc đóng phiên nhỏ, số lượng cố định, để cache offline không mở lại
phiên đã xong. Phiên mới thay dấu mốc này. Không thêm lịch sử bài kiểm tra vào
`quizHistory`; kết quả mỗi câu được thay tại chỗ. Kết quả tổng kết trả cho giao diện
ở bộ nhớ và không tích lũy trong JSONB. Nộp lại phiên đã đóng không lùi bậc lần nữa.

Tự xác nhận tự luận thực hiện sau khi nộp câu, trước khi chốt toàn bài. Kết quả cuối
chỉ áp dụng bậc một lần. Ghi mastery và review cùng một giao dịch phía ứng dụng:
nếu ghi lỗi, khôi phục bản cũ và chưa thông báo sync.

Gộp kết quả theo `answeredAt` rồi `updateId`; gộp thẻ theo `updatedAt` rồi `updateId`.
Gộp cả phiên nguyên vẹn, phiên đã đóng thắng chỉnh sửa offline của cùng phiên.
Đây không phải chế độ cộng tác cùng làm một đề trên hai thiết bị.

## API giao diện

- `reviewCatalog`, `eligibleReviewCards`, `selectReviewCards`, `createReviewItems`,
  `gradeReviewAnswer`, `normalizeWrittenAnswer` trong `reviewLearning.js`.
- `getReviewProgress`, `startReviewTest`, `saveReviewAnswer`, `finishReviewTest`,
  `advanceReviewQuestion`, `cancelReviewTest` trong `storage.js`.
- `startReviewTest({ stageId, mode, count, lessonIds, prioritizeOld, retryKeys })`:
  bỏ `retryKeys` để chọn thẻ thành thạo/câu gần nhất đúng; truyền danh sách câu sai
  để ôn lại. `lessonIds: null` chọn cả chặng, `[]` không chọn bài nào.
- `saveReviewAnswer(id, key, response, { selfCorrected: true })` chỉ được dùng lại
  để tự xác nhận đúng cho câu tự luận đã nộp; không được thay câu trả lời đã khóa.
- `finishReviewTest(id)` trả `{ total, correct, wrongKeys }`, hoặc `null` nếu đã chốt.
  `cancelReviewTest(id)` chỉ đóng phiên, không chấm hay đổi bậc.
- Khách đọc trạng thái rỗng và không thể khởi tạo/lưu/chốt phiên tài khoản.

## Thử đồng bộ thật trên hai trình duyệt

Dùng hai trình duyệt riêng (Chrome và Firefox) đăng nhập cùng tài khoản thử.
Không cần mở Console hoặc sửa dữ liệu thủ công.

1. Trên A, làm đúng một câu Ngữ pháp/Đọc hiểu, chờ **Đã đồng bộ**. Trên B,
   chuyển lại tab ứng dụng, chờ đồng bộ rồi mở **Ôn tập → Đã thành thạo**.
   Câu vừa làm phải nằm trong chặng tương ứng dưới nhãn **Câu đã làm đúng**.
   Làm lại câu đó sai và đồng bộ: câu biến mất khỏi danh sách này.
2. Học ít nhất một thẻ Kanji lên bậc 3. Trên A, mở **Đã thành thạo → Kanji →
   Làm kiểm tra**, chọn một câu. Trả lời sai nhưng chưa hoàn thành; chờ đồng bộ.
   Trên B, bấm **Tiếp tục kiểm tra**: phải thấy cùng câu và phản hồi sai.
   Reload B vẫn giữ nguyên. Không đồng thời sửa cùng phiên trên hai máy.
3. Hoàn thành trên B và đợi đồng bộ. Trên A, phiên không còn tiếp tục được;
   thẻ sai xuất hiện ở **Cần kiểm tra lại** (bậc 2 có cờ). Bấm **Ôn bài này**,
   bắt đầu vòng mới nếu phiên node cũ đã kết thúc, trả lời thẻ đó đúng: lên bậc 3
   và hết cờ. Thử lại và trả lời sai: xuống bậc 1, hết cờ, vào nhóm củng cố.
4. Từ trang kết quả, **Ôn lại các thẻ sai** cũng áp dụng cùng quy tắc phục hồi.
   Với tự luận, thử nhập khác đáp án rồi bấm **Tôi đã đúng** trước khi hoàn thành.
   Chỉ kết quả sau cùng được áp dụng vào bậc.
5. Thử offline trên A sau khi đã tải trang: trả lời, reload phiên và kiểm tra
   phản hồi được giữ. Bật mạng lại, đợi **Đã đồng bộ**, rồi kiểm tra trên B.
   Khi chuyển thiết bị, luôn đợi đồng bộ trước để tránh hai bản phiên cạnh tranh.

Test tự động dùng hai bộ điều phối giả lập cho offline, xung đột ghi và phục hồi;
kiểm tra giao diện dùng tài khoản/API giả lập. Chúng không thay thế xác nhận trên
Supabase thật bằng các bước trên.

## Lệnh kiểm tra

```bash
npm test
npm run lint
npm run build
node src/utils/reviewLearning.test.js
node src/utils/reviewProgress.test.js
node src/utils/progressSync.test.js
```
