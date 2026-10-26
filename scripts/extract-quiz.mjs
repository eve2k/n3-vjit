import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DECUONG = path.join(ROOT, 'decuong.txt');
const OUT = path.join(ROOT, 'n3-vjit-webapp', 'src', 'data');

const fukushuu1Answers = {
  1: 'C', 2: 'A', 3: 'D', 4: 'C', 5: 'B', 6: 'A', 7: 'D', 8: 'C', 9: 'C', 10: 'A',
  11: 'D', 12: 'D', 13: 'D', 14: 'C', 15: 'C', 16: 'C', 17: 'C', 18: 'B', 19: 'D', 20: 'D',
  21: 'C', 22: 'D', 23: 'B', 24: 'D', 25: 'B', 26: 'D', 27: 'A', 28: 'D', 29: 'A', 30: 'D',
  31: 'B', 32: 'A', 33: 'A', 34: 'B', 35: 'C', 36: 'A', 37: 'A', 38: 'D', 39: 'B', 40: 'B',
  41: 'B', 42: 'B', 43: 'B', 44: 'D',
};

const fukushuu1Explain = {
  1: ['かおいろが悪い', 'かおいろが悪い (Sắc mặt kém) = かおが青い (Mặt xanh xao)', 'Sắc mặt kém/xấu đồng nghĩa với mặt tái xanh khi mệt hoặc ốm.'],
  2: ['おじょうさん', 'おじょうさん = むすめさん | おいくつ = なんさい', 'おじょうさん là cách nói lịch sự chỉ con gái người khác; おいくつ = なんさい.'],
  3: ['たしかです', '～は たしかです = きっと～ます', 'たしかです nghĩa là chắc chắn, đồng nghĩa với きっと来ます.'],
  4: ['はながいい', 'はながいい = においがよくわかる', 'はながいい (thính mũi) = nhận biết mùi tốt.'],
  5: ['見なおしてもらいました', '見なおしてもらう = よくないところを なおしてもらう', 'Nhờ xem và sửa lại chỗ chưa tốt.'],
  6: ['どちらか', 'ふたつのうち どちらか = 一つ', 'Chọn 1 trong 2 cái = hãy lấy một cái.'],
  7: ['7000円も', 'Số lượng + も = 多いと思う', 'も nhấn mạnh số lượng nhiều.'],
  8: ['けっして', 'けっして～ないでください = ～てはいけません', 'Tuyệt đối đừng nói = không được phép nói.'],
  9: ['15分いないに', '15分いないに = 15分 かかりません', 'Trong vòng 15 phút = chưa mất đến 15 phút.'],
  10: ['食べたばかり', 'Vた + ばかり = Vます + おわりました', 'Vừa mới ăn xong = đã ăn xong.'],
  11: ['安心しました', '安心しました = 心配がなくなりました', 'Yên tâm = hết lo lắng.'],
  12: ['売りきれました', '売りきれました = ぜんぶ 売れました', 'Bán hết sạch = đã bán hết toàn bộ.'],
  13: ['ひさしぶり', 'ひさしぶり = ずいぶんまえ', 'Lâu rồi mới gặp = cách đây khá lâu.'],
  14: ['欠席', '欠席 = 休みます', 'Vắng mặt = nghỉ.'],
  15: ['なるべく', 'なるべく = できるだけ', 'Cố gắng hết sức có thể.'],
  16: ['かまいません', '明日でも かまいません = 明日でも 今日でも いいです', 'Ngày mai cũng không sao = mai hay hôm nay đều được.'],
  17: ['つたえる', 'ニュースを つたえる = ほうそうの仕事', 'Truyền tải tin tức = công việc phát thanh/truyền hình.'],
  18: ['ぬがないで', 'ぬがないで はいってはいけません = ぬいでから 入ってください', 'Không được để nguyên giày mà vào = hãy cởi giày rồi mới vào.'],
  19: ['しつれいします', 'そろそろ、しつれいします = これから、帰ります', 'Xin phép về = từ giờ sẽ về.'],
  20: ['とりかえてください', 'とりかえてください = ちがうのを ください', 'Hãy đổi cái khác = đưa cho tôi cái khác.'],
  21: ['たまに', 'たまに = そんなに～ません', 'Thỉnh thoảng = không thường xuyên lắm.'],
  22: ['ネクタイを して', 'ネクタイを しています = ネクタイを しめて います', 'Đeo cà vạt dùng する/しめる.'],
  23: ['いやがります', 'いやがります = きらいです', 'Tỏ ra ghét = ghét.'],
  24: ['ことに しました', '～ない ことに しました = ～ないと きめました', 'Quyết định không làm.'],
  25: ['のどが かわいています', 'のどが かわいています = 何か飲みたいです', 'Đang khát nước = muốn uống gì đó.'],
  26: ['せんぱい', 'せんぱい = 入学する まえに おなじ 大学に 入学しました', 'Tiền bối nhập học cùng trường trước tôi.'],
  27: ['よく いらっしゃいました', '「よく いらっしゃいました」 = 私を たずねてきました', 'Chào mừng khách đến chơi = người đó đến thăm tôi.'],
  28: ['ねっしん', 'ねっしん = いっしょうけんめい します', 'Nhiệt huyết = làm việc hết mình.'],
  29: ['かけて ください', 'いすに かけて ください = いすに すわって ください', 'Mời ngồi vào ghế.'],
  30: ['春から 夏', '春から 夏に なりました = きせつが かわりました', 'Từ xuân sang hạ = mùa thay đổi.'],
  31: ['ひえる', 'ひえる = さむく なる', 'Trời lạnh đi = trở nên lạnh.'],
  32: ['日が くれる', '日が くれる = 暗く なる', 'Mặt trời lặn / trời tối.'],
  33: ['持ったまま', 'ペンを 持ったまま 死にました = 死ぬ 時まで 書いて いました', 'Qua đời khi vẫn cầm bút = viết đến lúc chết.'],
  34: ['近ければ', 'もう 少し 近ければ = とおいので 行けません', 'Nếu gần hơn thì đã đi = tiếc vì xa nên không đi được.'],
  35: ['ないでしょうか', '～ないのではないでしょうか = ～ないでしょう', 'Chẳng phải là sẽ không... sao? = có lẽ sẽ không.'],
  36: ['めずらしい', '休むのは めずらしい = ほとんど 休みません', 'Hiếm khi nghỉ = hầu như không nghỉ.'],
  37: ['先生は母です', '私の先生は母です = 私は母に習っています', 'Giáo viên của tôi là mẹ = tôi học từ mẹ.'],
  38: ['注意して', '注意して = きを つけて', 'Chú ý = cẩn thận.'],
  39: ['すばらしい', '作文は すばらしい = 作文が 上手です', 'Bài văn tuyệt vời = viết văn giỏi.'],
  40: ['えいよう', 'えいようのバランス考えて = 体にいい 料理', 'Cân bằng dinh dưỡng = món ăn tốt cho cơ thể.'],
  41: ['くれました', '友だちが くれました = 私は 友だちに もらいました', 'Bạn cho tôi = tôi nhận từ bạn.'],
  42: ['おいでに なりました', 'おいでに なりました = いらっしゃいました', 'Tôn kính ngữ của đi/đến.'],
  43: ['たいてい', 'たいてい いえに います = あまり 出かけません', 'Thường ở nhà = ít khi ra ngoài.'],
  44: ['2時間 かかります', '会社まで 2時間 かかります = 8時に 家を 出て、10時に 会社に 着きます', 'Mất 2 tiếng đến công ty.'],
};

const renshuu2Answers = {
  1: 'B', 2: 'A', 3: 'B', 4: 'A', 5: 'D', 6: 'B', 7: 'C', 8: 'B', 9: 'A', 10: 'B',
  11: 'C', 12: 'C', 13: 'D', 14: 'B', 15: 'C', 16: 'A', 17: 'B', 18: 'B', 19: 'D', 20: 'B',
  21: 'A', 22: 'B', 23: 'A', 24: 'C', 25: 'C', 26: 'D', 27: 'D', 28: 'C', 29: 'D', 30: 'A',
  31: 'B', 32: 'B', 33: 'B', 34: 'C', 35: 'D', 36: 'D', 37: 'A', 38: 'C', 39: 'A', 40: 'B',
  41: 'D', 42: 'A', 43: 'A', 44: 'C', 45: 'C', 46: 'D', 47: 'D', 48: 'C', 49: 'B', 50: 'B',
  51: 'A', 52: 'A', 53: 'B', 54: 'A', 55: 'C', 56: 'B', 57: 'B', 58: 'A', 59: 'C', 60: 'C',
  61: 'D', 62: 'D', 63: 'C', 64: 'B', 65: 'A',
};

const renshuu2Explain = {
  1: 'レコード: nghe đĩa nhạc một mình.',
  2: 'スイッチを切る: tắt công tắc máy in trước khi về.',
  3: '10ページ: đọc 10 trang tạp chí.',
  4: 'パソコンを2台: đếm máy tính bằng 台.',
  5: '大きい夢: thích người có ước mơ lớn.',
  6: '失礼なこと: chú ý không làm điều thất lễ với khách.',
  7: '都合が悪い: bận / không thu xếp được.',
  8: '頭が痛い: mất ngủ nên đau đầu.',
  9: 'リンゴの皮をむく: gọt vỏ táo.',
  10: '暑さが厳しい: nắng nóng gay gắt.',
  11: 'ボランティア活動: hoạt động tình nguyện.',
  12: 'お金を拾った: nhặt được tiền nên nộp đồn cảnh sát.',
  13: '指輪をはめる: đeo nhẫn.',
  14: '未経験: chưa có kinh nghiệm.',
  15: 'タイプを打つ: đánh máy rất nhanh.',
  16: '小さい子ども: nhà có con nhỏ nên nhộn nhịp.',
  17: 'オープンしました: siêu thị mới khai trương.',
  18: '苦手なスポーツ: môn thể thao kém nhất.',
  19: '予習しておく: chuẩn bị bài trước.',
  20: '食後のデザート: món tráng miệng sau bữa ăn.',
  21: '海外旅行: du lịch nước ngoài.',
  22: 'バターをぬって: phết bơ lên bánh mì.',
  23: 'ハンドルを右に切る: bẻ vô lăng sang phải.',
  24: 'フライパンでいためる: cho thịt vào chảo xào.',
  25: '濃いお茶: thích trà đặc hơn trà loãng.',
  26: '絵がかけてあります: tranh được treo trên tường.',
  27: 'かぜをひいてしまった: dầm mưa nên bị cảm.',
  28: 'お風呂をわかす: đun nước tắm (tha động từ).',
  29: '体が丈夫: cơ thể khỏe mạnh.',
  30: 'レシートをもらう: nhận hóa đơn sau khi trả tiền.',
  31: 'プールが浅い: hồ bơi nông nên trẻ em an toàn.',
  32: '汗をかく: ra mồ hôi.',
  33: '不注意: vô ý / bất cẩn.',
  34: '都合がよければ: nếu thuận tiện.',
  35: '暖房をつける: bật máy sưởi.',
  36: 'あしたかあさって: mai hoặc ngày kia.',
  37: '着たシャツ: giặt áo sơ mi đã mặc (着る).',
  38: '眠かった: đọc tiểu thuyết khuya nên buồn ngủ.',
  39: 'お見舞いに行く: đi thăm bệnh.',
  40: 'ナイフで切る: cắt bánh mì bằng dao.',
  41: '1時間で来られます: với で chọn khả năng đến được, không phải かかります.',
  42: 'ガソリンスタンド: đổ xăng ở trạm xăng.',
  43: '親切な人: người tốt bụng cho mượn tiền.',
  44: 'おっしゃいます: tôn kính ngữ hỏi tên.',
  45: '立派な人: trở thành người xuất sắc.',
  46: 'エレベーターで行く: nhà hàng tầng 5 nên đi thang máy.',
  47: '交差点を渡る: khi qua ngã tư hãy chú ý.',
  48: '久しぶりに: lâu ngày mới gặp lại.',
  49: '鉛筆をけずる: gọt bút chì.',
  50: 'さびたナイフ: dao gỉ sét thì không cắt được.',
  51: '正直に言うと: nói thật lòng thì...',
  52: '後輩: hậu bối nhưng lên chức trước.',
  53: '月末に支払う: tiền nhà trả cuối tháng.',
  54: 'ラップをかぶせる: bọc màng bọc thực phẩm.',
  55: 'トランクを開けたまま: mở cốp chạy.',
  56: 'はかりではかる: cân nguyên liệu bằng cái cân.',
  57: '靴をみがく: đánh giày.',
  58: '靴をそろえて脱ぐ: cởi giày xếp ngay ngắn.',
  59: 'いためましょう: xào rau trong chảo.',
  60: '暑さがきびしく: cái nóng trở nên gay gắt.',
  61: 'かゆい: bị muỗi đốt nên ngứa.',
  62: '高速道路: đường cao tốc.',
  63: 'おととし: năm kia = 1 năm trước của năm ngoái.',
  64: 'ワイパーを動かす: bật cần gạt nước.',
  65: '車にひかれる: bị xe đâm/cán.',
};

const renshuu3Answers = {
  1: 'A', 2: 'D', 3: 'B', 4: 'B', 5: 'D', 6: 'D', 7: 'B', 8: 'D', 9: 'C', 10: 'A',
  11: 'C', 12: 'A', 13: 'C', 14: 'B', 15: 'D', 16: 'B', 17: 'A', 18: 'A', 19: 'A', 20: 'D',
  21: 'C', 22: 'A', 23: 'D', 24: 'B', 25: 'D', 26: 'B', 27: 'A', 28: 'B', 29: 'C', 30: 'D',
  31: 'D', 32: 'A', 33: 'C', 34: 'D', 35: 'C', 36: 'C', 37: 'D', 38: 'C', 39: 'A', 40: 'B',
  41: 'A', 42: 'D', 43: 'D', 44: 'C', 45: 'B', 46: 'B', 47: 'A', 48: 'D', 49: 'C', 50: 'C',
};

const renshuu3Explain = {
  1: '試験 → しけん. Phân biệt 実験(じっけん), 事件(じけん).',
  2: '世界 → せかい. Không có trường âm ở chữ 世.',
  3: '急いで → いそいで.',
  4: '親しい → したしい.',
  5: '国立 → こくりつ.',
  6: '苦手 → にがて.',
  7: '伝えた → つたえた.',
  8: '失敗 → しっぱい (âm ngắt っ và bán đục ぱ).',
  9: '人間 → にんげん.',
  10: '五行目 → ごぎょうめ.',
  11: '比べて → くらべて. Phân biệt 並べて / 調べて.',
  12: '正直 → しょうじき.',
  13: '笑顔 → えがお.',
  14: '倒れます → たおれます.',
  15: '救急車 → きゅうきゅうしゃ (cả 救 và 急 đều trường âm).',
  16: '相手 → あいて.',
  17: '汚れて → よごれて.',
  18: '家賃 → やちん.',
  19: '近所 → きんじょ (không trường âm).',
  20: '地震 → じしん.',
  21: '閉じて → とじて.',
  22: '便利な → べんりな.',
  23: '調べる → しらべる.',
  24: '出席 → しゅっせき (âm ngắt っ).',
  25: '情報 → じょうほう (cả hai âm trường).',
  26: 'どりょく → 努力.',
  27: 'かかり → 係り.',
  28: 'けっか → 結果.',
  29: 'うたがわなかった → 疑わ.',
  30: 'ちゅうもん → 注文.',
  31: 'すな → 砂.',
  32: 'りょうしゅうしょ → 領収書.',
  33: 'そだてた → 育てた.',
  34: 'さんか → 参加.',
  35: 'もうしこみ → 申し込み.',
  36: 'まなんだ → 学んだ.',
  37: 'しんぱい → 心配.',
  38: 'きゅうこう → 急行.',
  39: 'ひやして → 冷やして.',
  40: 'ざいりょう → 材料.',
  41: 'おゆ → お湯.',
  42: 'しなもの → 品物.',
  43: 'むら → 村.',
  44: 'ほね → 骨.',
  45: 'はたらきたい → 働きたい (bộ nhân đứng).',
  46: 'やぶらない → 破らない.',
  47: 'けいかく → 計画.',
  48: 'ちかみち → 近道.',
  49: 'うちがわ → 内側.',
  50: '100円だま → 玉.',
};

const renshuu4Answers = {
  1: 'B', 2: 'B', 3: 'C', 4: 'A', 5: 'C', 6: 'B', 7: 'C', 8: 'C', 9: 'B', 10: 'B',
  11: 'C', 12: 'D', 13: 'B', 14: 'A', 15: 'B', 16: 'D', 17: 'B', 18: 'C', 19: 'D', 20: 'C',
  21: 'D', 22: 'B', 23: 'B', 24: 'A', 25: 'A', 26: 'C', 27: 'B', 28: 'A', 29: 'B', 30: 'B',
  31: 'B', 32: 'D', 33: 'C', 34: 'A', 35: 'A', 36: 'D', 37: 'A', 38: 'A', 39: 'D', 40: 'B',
  41: 'A', 42: 'C', 43: 'A', 44: 'B', 45: 'A', 46: 'D', 47: 'A', 48: 'B',
};

const renshuu4Explain = {
  1: 'まるで～ようだ: cứ như là mơ.',
  2: 'Vる + ようにする: cố gắng duy trì thói quen.',
  3: 'Vる/N + のにいい: tốt cho việc leo núi.',
  4: 'Vてばかりいる: chỉ toàn học thì sẽ ốm.',
  5: 'せずに: không chào mà về (する → せずに).',
  6: 'いくらVても: dù giải thích bao nhiêu cũng không hiểu.',
  7: 'どんなNでも: bất cứ món nào cũng làm được.',
  8: 'おかげで: nhờ có... (kết quả tốt).',
  9: 'のに: mặc dù học nhiều nhưng điểm kém.',
  10: 'しなければならない: phải liên lạc.',
  11: 'Vているうちに: trong lúc nói chuyện trời tối.',
  12: 'もし～だったら: nếu là chim thì muốn bay về nước.',
  13: 'らしい: hình như có người (nghe thấy tiếng).',
  14: 'かもしれない: có lẽ sẽ muộn.',
  15: 'Nらしく: nuôi dạy đúng chất một đứa trẻ.',
  16: 'ことにした: tự quyết định về nước năm sau.',
  17: 'AはBほど～ない: Yamada không cao bằng Tanaka.',
  18: 'ため: vì ít mưa nên rau không lớn.',
  19: 'によると～そうだ: nghe nói theo dự báo.',
  20: '子供でも: dù trẻ con cũng làm được.',
  21: '留学したのに: mặc dù du học nhưng tiếng Anh không giỏi.',
  22: 'ゲームばかり: chỉ toàn chơi game.',
  23: '時間どおりに: đúng giờ.',
  24: '晴れているのに: trời nắng mà vẫn mưa.',
  25: '忘れがたい: kỷ niệm khó quên (tâm lý).',
  26: '成績はともかく: khoan bàn điểm số, tính tình tốt.',
  27: 'と思うことがある: thỉnh thoảng muốn ở một mình.',
  28: '～とは考えられません: không ngờ người nghiêm túc lại trốn việc.',
  29: '遅れたせいで: tại tàu trễ nên không kịp (kết quả xấu).',
  30: 'こわれにくい: bền, khó hỏng (tự động từ).',
  31: 'Nと知られている: được biết đến là...',
  32: '会うたびに: cứ mỗi lần gặp lại cao hơn.',
  33: '使いにくい: máy hút bụi to nặng nên khó dùng.',
  34: '読めそうにない: có vẻ không đọc xong hôm nay.',
  35: '遊んでばかりいる: chỉ toàn chơi, không học.',
  36: '以前に比べて: so với trước đây ít thất bại hơn.',
  37: '調べようがない: không còn tư liệu nên không cách nào tra.',
  38: '増えたのにともなって: cùng với việc tăng người nước ngoài.',
  39: 'バイクにかけては: về khoản xe máy thì không ai bằng.',
  40: '表情からして: ngay từ biểu cảm đã thấy đang giận.',
  41: '大雪が降ったせいで: tại tuyết lớn nên máy bay không cất cánh.',
  42: '今から週末にかけて: từ giờ kéo dài đến cuối tuần.',
  43: 'したことがあるなど: đi vòng quanh thế giới thì thật giỏi.',
  44: '京都といえば: nhắc đến Kyoto là nghĩ đến chùa.',
  45: 'ご注文の際には: khi gọi món (trang trọng).',
  46: '入るとき: khi vào phòng hãy cởi dép.',
  47: '住んでいるのに: dù sống ở Nhật nhưng ít có dịp dùng tiếng Nhật.',
  48: 'こわれているようだ: có vẻ như bị hỏng (cảm nhận chủ quan).',
};

const renshuu5Answers = {
  1: 'C', 2: 'D', 3: 'A', 4: 'C', 5: 'B', 6: 'B', 7: 'D', 8: 'A', 9: 'A', 10: 'C',
  11: 'A', 12: 'D', 13: 'B', 14: 'D', 15: 'C', 16: 'B', 17: 'D', 18: 'A', 19: 'C', 20: 'C',
  21: 'A', 22: 'B', 23: 'D', 24: 'D', 25: 'B', 26: 'C', 27: 'D', 28: 'C', 29: 'B', 30: 'C',
  31: 'B', 32: 'D', 33: 'D', 34: 'B', 35: 'A', 36: 'C', 37: 'A', 38: 'B', 39: 'D', 40: 'B',
  41: 'A', 42: 'C', 43: 'D', 44: 'B', 45: 'C', 46: 'B', 47: 'B', 48: 'D', 49: 'A', 50: 'B',
};

const renshuu5Explain = {
  1: '動くな！: thể cấm chỉ Vる + な.',
  2: '車がとまっている: tự động từ 止まる đi với が.',
  3: 'ねるように言われた: được bác sĩ dặn hãy ngủ nhiều.',
  4: '復習をしてください: hãy ôn bài (Vてください).',
  5: 'わかりません: xem bản đồ cũng không biết đường.',
  6: '会社を作って: nối câu bằng Vて.',
  7: 'かぜをひいたかもしれません: có lẽ đã bị cảm.',
  8: 'おどりながら: vừa nhảy vừa hát.',
  9: '輸出されている: bị động đang được xuất khẩu.',
  10: 'かちたいです: muốn thắng (ます形 + たい).',
  11: 'さかんです: bóng đá thịnh hành (な tính từ + です).',
  12: 'するつもりです: dự định đi du lịch.',
  13: 'よけなさい: hãy tránh sang bên (ます形 + なさい).',
  14: '手伝ってくれて: cảm ơn vì đã giúp tôi.',
  15: '食べちゃおうか = 食べてしまおうか: ăn hết luôn nhé?',
  16: 'うまくいかないだろう: có lẽ sẽ không suôn sẻ.',
  17: '家族があつまります: tự động từ 集まる đi với が.',
  18: '受けようと思います: dự định sẽ thi N3.',
  19: '守らないと = 守らないといけない: phải tuân thủ nội quy.',
  20: 'わすれてしまいました: đã lỡ quên mất.',
  21: '疲れていても: dù mệt cũng không nghỉ tập.',
  22: '話すのは: danh từ hóa cụm động từ.',
  23: '読むと: hễ đọc sách trên tàu thủy là buồn nôn.',
  24: '忘れないでほしい: mong đừng quên chúng tôi.',
  25: 'あげるつもりです: dự định tặng búp bê.',
  26: 'おいしくなりました: trở nên ngon (いA → く + なる).',
  27: 'せずに: không khởi động mà bơi thì nguy hiểm.',
  28: 'できるそうです: nghe nói sắp có siêu thị mới (truyền đạt).',
  29: '並べてください: hãy xếp sách (tha động từ).',
  30: '雨がひどくて: vì mưa to nên không đá bóng.',
  31: 'うまくなりません: luyện nhiều nhưng mãi không giỏi.',
  32: '置いたまま: để nguyên hành lý mà xuống tàu.',
  33: '傘をささずに: đi dưới mưa không che ô.',
  34: '好きだ: thích phết mayonnaise.',
  35: '食べるように言われた: được dặn ăn chậm.',
  36: '行かなきゃ = 行かなければならない: phải đi mua quà.',
  37: 'あまったら: nếu có thừa tờ in thì báo.',
  38: '全然きかない: thuốc đắt mà chẳng có tác dụng.',
  39: 'はずすと: hễ tháo kính ra là như người khác.',
  40: 'ゆずらない: chẳng ai nhường ghế.',
  41: '降らないうちに: tranh thủ lúc chưa mưa.',
  42: '行かせてください: hãy cho tôi đi công tác (sai khiến + xin phép).',
  43: '試験に受かる: chắc sẽ đỗ kỳ thi.',
  44: 'きれそうだ: giấy vệ sinh sắp hết (ます形 + そうだ).',
  45: '多すぎて: vì quá nhiều sách (không có い trước すぎて).',
  46: '止めさせてもらえませんか: cho phép tôi đỗ xe được không?',
  47: 'あこがれて: ngưỡng mộ nên bắt đầu chơi bóng.',
  48: 'ためすために: thi thử để kiểm tra thực lực.',
  49: 'アパートがあるので: vì căn hộ nằm cạnh đường lớn.',
  50: 'なくなった: bà đã qua đời hôm qua.',
};

function splitSections(raw) {
  const markers = [
    ['fukushuu1', '復習1'],
    ['renshuu2', '練習2'],
    ['renshuu3', '練習3'],
    ['renshuu4', '練習4'],
    ['renshuu5', '練習5'],
    ['dokkai', '読解'],
  ];
  const idxs = markers.map(([id, label]) => ({ id, label, i: raw.indexOf(label) }));
  const map = {};
  for (let n = 0; n < idxs.length; n++) {
    const start = idxs[n].i;
    const end = n + 1 < idxs.length ? idxs[n + 1].i : raw.length;
    map[idxs[n].id] = raw.slice(start, end);
  }
  return map;
}

function parseOptions(block) {
  const cleaned = block
    .replace(/\r/g, '')
    .replace(/^ちいさい\t/, 'A.  ちいさい\t')
    .replace(/^レンタル\t/, 'A.  レンタル\t');
  const opts = { A: '', B: '', C: '', D: '' };
  const re = /([A-D])\.\s*/g;
  const hits = [];
  let m;
  while ((m = re.exec(cleaned))) hits.push({ letter: m[1], start: m.index + m[0].length, marker: m.index });
  for (let i = 0; i < hits.length; i++) {
    const from = hits[i].start;
    const to = i + 1 < hits.length ? hits[i + 1].marker : cleaned.length;
    opts[hits[i].letter] = cleaned.slice(from, to).replace(/\s+/g, ' ').trim();
  }
  if (opts.A === '[?]') opts.A = 'じゅぎょう';
  return opts;
}

function parseQuestions(sectionText, section, answers, explain, prefix) {
  const parts = sectionText.split(/問(\d+)[：:]/);
  const questions = [];
  for (let i = 1; i < parts.length; i += 2) {
    const num = Number(parts[i]);
    const body = parts[i + 1] || '';
    const optIndex = body.search(/[A-D]\.\s/);
    const missingA = body.search(/^(ちいさい|レンタル)\t/m);
    const cut = optIndex >= 0 ? optIndex : missingA >= 0 ? missingA : body.length;
    const questionText = body.slice(0, cut).replace(/\s+/g, ' ').trim();
    const optionBlock = body.slice(cut);
    const options = parseOptions(optionBlock);
    const expl = explain[num];
    const highlight = Array.isArray(expl) ? expl[0] : '';
    const keyTakeaway = Array.isArray(expl) ? expl[1] : '';
    const explanation = Array.isArray(expl) ? expl[2] : (expl || '');
    questions.push({
      id: `${prefix}_q${num}`,
      section,
      questionNumber: num,
      questionText,
      highlightWord: highlight,
      options,
      correctAnswer: answers[num],
      keyTakeaway: keyTakeaway || explanation,
      explanation,
    });
  }
  return questions;
}

function serialize(varName, data) {
  return `export const ${varName} = ${JSON.stringify(data, null, 2)};\n`;
}

const raw = fs.readFileSync(DECUONG, 'utf8');
const sections = splitSections(raw);

const fukushuu1 = parseQuestions(sections.fukushuu1, 'fukushuu1', fukushuu1Answers, fukushuu1Explain, 'f1');
const renshuu2 = parseQuestions(sections.renshuu2, 'renshuu2', renshuu2Answers, renshuu2Explain, 'r2');
const renshuu3 = parseQuestions(sections.renshuu3, 'renshuu3', renshuu3Answers, renshuu3Explain, 'r3');
const renshuu4 = parseQuestions(sections.renshuu4, 'renshuu4', renshuu4Answers, renshuu4Explain, 'r4');
const renshuu5 = parseQuestions(sections.renshuu5, 'renshuu5', renshuu5Answers, renshuu5Explain, 'r5');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'fukushuu1.js'), serialize('fukushuu1', fukushuu1));
fs.writeFileSync(path.join(OUT, 'renshuu2.js'), serialize('renshuu2', renshuu2));
fs.writeFileSync(path.join(OUT, 'renshuu3.js'), serialize('renshuu3', renshuu3));
fs.writeFileSync(path.join(OUT, 'renshuu4.js'), serialize('renshuu4', renshuu4));
fs.writeFileSync(path.join(OUT, 'renshuu5.js'), serialize('renshuu5', renshuu5));

const report = {
  fukushuu1: fukushuu1.length,
  renshuu2: renshuu2.length,
  renshuu3: renshuu3.length,
  renshuu4: renshuu4.length,
  renshuu5: renshuu5.length,
  missingOptions: [...fukushuu1, ...renshuu2, ...renshuu3, ...renshuu4, ...renshuu5]
    .filter((q) => !q.options.A || !q.options.B || !q.options.C || !q.options.D || !q.correctAnswer)
    .map((q) => q.id),
};
console.log(JSON.stringify(report, null, 2));
console.log('sample r2 q16', JSON.stringify(renshuu2[15], null, 2));
console.log('sample r2 q19', JSON.stringify(renshuu2[18], null, 2));
