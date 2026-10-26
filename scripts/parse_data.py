# -*- coding: utf-8 -*-
"""Parse decuong_clean.txt + tonghop.txt into src/data JS modules."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"C:\_workspace\web\nn13")
SRC_DATA = ROOT / "n3-vjit-webapp" / "src" / "data"
DECUONG = (ROOT / "decuong_clean.txt").read_text(encoding="utf-8")
TONGHOP = (ROOT / "tonghop.txt").read_text(encoding="utf-8")

SRC_DATA.mkdir(parents=True, exist_ok=True)


def js_module(export_name: str, value) -> str:
    payload = json.dumps(value, ensure_ascii=False, indent=2)
    return f"export const {export_name} = {payload};\n"


def split_options(block: str) -> dict:
    text = " ".join(block.strip().split())
    text = re.sub(r"^ちいさい", "A. ちいさい", text)
    text = re.sub(r"^レンタル", "A. レンタル", text)
    if not re.match(r"^[A-D]\.", text):
        text = "A. " + text
    parts = re.split(r"(?=[A-D]\.\s*)", text)
    options = {}
    for part in parts:
        m = re.match(r"([A-D])\.\s*(.*)", part.strip())
        if m:
            options[m.group(1)] = re.sub(r"\s+", " ", m.group(2)).strip(" 。.")
            if options[m.group(1)] and not options[m.group(1)].endswith(("。", "？", "?", "」", "）", ")")):
                pass
    return options


def parse_quiz_section(raw: str, section: str, prefix: str) -> list[dict]:
    chunks = re.split(r"問(\d+)[：:]", raw)
    questions = []
    # chunks: [preamble, num, body, num, body, ...]
    for i in range(1, len(chunks), 2):
        num = int(chunks[i])
        body = chunks[i + 1]
        opt_start = re.search(r"\nA\.\s|\nちいさい|\nレンタル", body)
        if not opt_start:
            # options may be on same line after question
            m = re.search(r"(A\.\s)", body)
            if m:
                qtext = body[: m.start()].strip()
                opt_block = body[m.start() :]
            else:
                qtext = body.strip()
                opt_block = ""
        else:
            qtext = body[: opt_start.start()].strip()
            opt_block = body[opt_start.start() :]
        qtext = re.sub(r"\s+", " ", qtext).strip()
        # cut next section headers if leaked
        qtext = re.split(r"\n(?:練習|読解|問題)", qtext)[0].strip()
        options = split_options(re.split(r"問\d+", opt_block)[0])
        questions.append(
            {
                "id": f"{prefix}_q{num}",
                "section": section,
                "questionNumber": num,
                "questionText": qtext,
                "highlightWord": "",
                "options": options,
                "correctAnswer": "",
                "keyTakeaway": "",
                "explanation": "",
            }
        )
    return questions


def slice_between(text: str, start: str, end: str | None) -> str:
    i = text.find(start)
    if i < 0:
        raise ValueError(f"start not found: {start}")
    j = text.find(end, i + len(start)) if end else len(text)
    if j < 0:
        j = len(text)
    return text[i:j]


F1_ANSWERS = {
    1: "C", 2: "A", 3: "D", 4: "C", 5: "B", 6: "A", 7: "D", 8: "C", 9: "C", 10: "A",
    11: "D", 12: "D", 13: "D", 14: "C", 15: "C", 16: "C", 17: "C", 18: "B", 19: "D", 20: "D",
    21: "C", 22: "D", 23: "B", 24: "D", 25: "B", 26: "D", 27: "A", 28: "D", 29: "A", 30: "D",
    31: "B", 32: "A", 33: "A", 34: "B", 35: "C", 36: "A", 37: "A", 38: "D", 39: "B", 40: "B",
    41: "B", 42: "B", 43: "B", 44: "D",
}

F1_KEYS = {
    1: "かおいろが悪い = かおが青い (Mặt xanh xao)",
    2: "おじょうさん = むすめさん / おいくつ = なんさい",
    3: "～は たしかです = きっと～ます",
    4: "はながいい = においがよくわかる",
    5: "見なおしてもらう = よくないところを なおしてもらう",
    6: "ふたつのうち どちらか = 一つ",
    7: "Số lượng + も = 多いと思う",
    8: "けっして～ないでください = ～てはいけません",
    9: "15分いないに = 15分 かかりません",
    10: "Vた + ばかり = Vます + おわりました",
    11: "安心しました = 心配がなくなりました",
    12: "売りきれました = ぜんぶ 売れました",
    13: "ひさしぶり = ずいぶんまえ",
    14: "欠席 = 休みます",
    15: "なるべく = できるだけ",
    16: "明日でも かまいません = 明日でも 今日でも いいです",
    17: "ニュースを つたえる = ほうそうの仕事",
    18: "ぬがないで はいってはいけません = ぬいでから 入ってください",
    19: "そろそろ、しつれいします = これから、帰ります",
    20: "とりかえてください = ちがうのを ください",
    21: "たまに = そんなに～ません",
    22: "ネクタイを しています = ネクタイを しめて います",
    23: "いやがります = きらいです",
    24: "～ない ことに しました = ～ないと きめました",
    25: "のどが かわいています = 何か飲みたいです",
    26: "せんぱい = 入学するまえに おなじ大学に入学しました",
    27: "よく いらっしゃいました = 私を たずねてきました",
    28: "ねっしん = いっしょうけんめい します",
    29: "いすに かけて ください = いすに すわって ください",
    30: "春から 夏に なりました = きせつが かわりました",
    31: "ひえる = さむく なる",
    32: "日が くれる = 暗く なる",
    33: "ペンを 持ったまま 死にました = 死ぬ時まで書いていました",
    34: "もう少し近ければ… = とおいので行けません",
    35: "～ないのではないでしょうか = ～ないでしょう",
    36: "休むのは めずらしい = ほとんど 休みません",
    37: "私の先生は母です = 私は母に習っています",
    38: "注意して = きを つけて",
    39: "作文は すばらしい = 作文が 上手です",
    40: "えいようのバランス考えて = 体にいい 料理",
    41: "友だちが くれました = 私は 友だちに もらいました",
    42: "おいでに なりました = いらっしゃいました",
    43: "たいてい いえに います = あまり 出かけません",
    44: "会社まで 2時間 かかります = 8時に家を出て、10時に会社に着きます",
}

R2_ANSWERS_EXPL = """
B. レコード (Nghe đĩa nhạc một mình)
A. きって (Tắt công tắc máy in trước khi về)
B. 10ページ (Đọc 10 trang tạp chí)
A. パソコン (Mua 2 chiếc máy tính cá nhân)
D. ゆめ (Thích người có ước mơ lớn - 大きい夢)
B. しつれいな (Chú ý không làm điều thất lễ với khách)
C. つごう (都合が悪い: Bận / không thu xếp được)
B. いたい (Mất ngủ nên đau đầu)
A. かわ (Gọt vỏ táo)
B. きびしい (暑さが厳しい: Nắng nóng gay gắt)
C. 活動 (ボランティア活動: Hoạt động tình nguyện)
C. ひろった (Nhặt được tiền trên đường nên nộp cho đồn cảnh sát)
D. はめて (Đeo nhẫn: 指輪をはめる)
B. 未 (未経験: Chưa có kinh nghiệm)
C. タイプ (Đánh máy rất nhanh: タイプを打つ)
A. ちいさい (Nhà có con nhỏ nên lúc nào cũng nhộn nhịp)
B. オープン (Siêu thị mới khai trương trước nhà ga)
B. にがてな (Môn thể thao tôi kém nhất là Tennis)
D. よしゅう (予習: Chuẩn bị bài trước cho ngày mai)
B. デザート (Món tráng miệng sau bữa ăn)
A. 海外 (海外旅行: Du lịch nước ngoài)
B. ぬって (Phết bơ lên bánh mì)
A. ハンドル (Xoay vô lăng sang phải)
C. フライパン (Cho thịt vào chảo xào)
C. こい (Thích trà đặc hơn trà loãng)
D. かけて (Treo tranh trên tường)
D. ひいて (Dầm mưa nên bị cảm)
C. わかして (Đun nước tắm bằng nhiệt mặt trời)
D. じょうぶ (Cơ thể khỏe mạnh thì không cần lo lắng)
A. レシート (Trả tiền và nhận hóa đơn)
B. あさい (Hồ bơi nông/cạn nên trẻ em cũng an toàn)
B. かいた (Ra mồ hôi nên đi tắm vòi sen)
B. 不 (不注意: Vô ý / bất cẩn nói lời thất lễ)
C. つごう (都合がよければ: Nếu thuận tiện thì hãy đến nhé)
D. だんぼう (Bật máy sưởi làm ấm phòng)
D. あさって (Hôm qua gửi thư, chắc mai hoặc ngày kia sẽ tới)
A. シャツ (Giặt chiếc áo sơ mi mặc hôm qua)
C. ねむかった (Đọc tiểu thuyết đến khuya nên sáng nay buồn ngủ)
A. おみまい (Đi thăm bệnh bạn)
B. ナイフ (Cắt bánh mì bằng con dao này)
D. こられます (Từ ga đến đây bằng xe buýt có thể đến trong 1 tiếng)
A. ガソリンスタンド (Đổ xăng ở trạm xăng)
A. しんせつ (Người tốt bụng cho mượn tiền khi rơi ví)
C. おっしゃいます (Tôn kính ngữ hỏi tên)
C. りっぱな (Hãy học hành chăm chỉ và trở thành người xuất sắc)
D. エレベーター (Nhà hàng ở tầng 5, nên đi bằng thang máy)
D. こうさてん (Khi qua ngã tư hãy chú ý kỹ)
C. ひさしぶり (久しぶりに: Lâu ngày mới gặp lại bạn cấp 2)
B. けずり (Bút chì bị cùn/tròn đầu nên hãy gọt đi)
B. さびた (Con dao bị gỉ sét như thế thì không cắt được đâu)
A. しょうしき (正直に言うと: Nói thật lòng thì...)
A. こうはい (Mặc dù là hậu bối của tôi nhưng lại lên chức trưởng phòng trước)
B. 月末 (Tiền nhà quy định trả vào cuối tháng mỗi tháng)
A. かぶせる (Bọc màng bọc thực phẩm lên thức ăn thừa)
C. トランク (Xe phía trước mở cốp chạy)
B. はかり (Cân nguyên liệu bằng cái cân)
B. みがき (Đánh giày sạch sẽ trước khi ra ngoài)
A. そろえて (Cởi giày xếp ngay ngắn)
C. いため (Cho rau vào chảo rồi xào kỹ)
C. きびしく (Dạo này cái nóng trở nên gay gắt hơn mọi khi)
D. かゆい (Bị muỗi chích nên rất ngứa)
D. 高 (高速道路: Đường cao tốc)
C. おととし (1 năm trước của năm ngoái gọi là năm kia)
B. ワイパー (Trời mưa nên bật cần gạt nước)
A. ひかれる (Cẩn thận kẻo bị xe đâm/cán!)
""".strip().splitlines()

R3_A = """
試験 → A. しけん (Kỳ thi) — Phân biệt: 実験 (じっけん), 事件 (じけん)
世界 → D. せかい (Thế giới) — không có trường âm ở chữ 世
急いで → B. いそいで (Khẩn trương, vội vàng)
親しい → B. したしい (Thân thiết)
国立 → D. こくりつ (Quốc lập / Công lập)
苦手 → D. にがて (Kém, yếu, không giỏi)
伝えた → B. つたえた (Truyền đạt lại cảm xúc)
失敗 → D. しっぱい (Thất bại - âm ngắt っ và âm bán đục ぱ)
人間 → C. にんげん (Con người, nhân loại)
五行目 → A. ごぎょうめ (Dòng thứ 5)
比べて → C. くらべて (So sánh)
正直 → A. しょうじき (Thật thà, ngay thẳng)
笑顔 → C. えがお (Khuôn mặt tươi cười)
倒れます → B. たおれます (Ngã bệnh, đổ gục)
救急車 → D. きゅうきゅうしゃ (Xe cấp cứu - cả 2 chữ đều có trường âm う)
相手 → B. あいて (Đối phương, bạn đời)
汚れて → A. よごれて (Bị bẩn)
家賃 → A. やちん (Tiền thuê nhà)
近所 → A. きんじょ (Hàng xóm - không có trường âm)
地震 → D. じしん (Động đất)
閉じて → C. とじて (Đóng nắp lại)
便利な → A. べんりな (Tiện lợi)
調べる → D. しらべる (Tra cứu, tìm hiểu)
出席 → B. しゅっせき (Tham dự - có âm ngắt っ)
情報 → D. じょうほう (Thông tin - cả 2 âm đều có trường âm う)
""".strip().splitlines()

R3_B = """
どりょく → B. 努力 (Nỗ lực hết sức)
かかり → A. 係り (Người phụ trách)
けっか → B. 結果 (Kết quả kỳ thi)
うたがわなかった → C. 疑わ (Không nghi ngờ)
ちゅうもん → D. 注文 (Gọi món / Đặt hàng)
すな → D. 砂 (Bụi cát bay vào mắt)
りょうしゅうしょ → A. 領収書 (Biên lai)
そだてた → C. 育てた (Đào tạo, nuôi dưỡng)
さんか → D. 参加 (Tham gia Olympic)
もうしこみ → C. 申し込み (Đăng ký học bổng)
まなんだ → C. 学んだ (Những gì đã học ở lớp)
しんぱい → D. 心配 (Lo lắng)
きゅうこう → C. 急行 (Tàu tốc hành)
ひやして → A. 冷やして (Làm lạnh)
ざいりょう → B. 材料 (Nguyên liệu)
おゆ → A. お湯 (Nước sôi)
しなもの → D. 品物 (Món đồ)
むら → D. 村 (Ngôi làng)
ほね → C. 骨 (Xương)
はたらきたい → B. 働きたい (Muốn làm việc)
やぶらない → B. 破らない (Không phá vỡ lời hứa)
けいかく → A. 計画 (Kế hoạch)
ちかみち → D. 近道 (Đường tắt)
うちがわ → C. 内側 (Phía bên trong)
100円だま → C. 玉 (Đồng xu)
""".strip().splitlines()

R4_TABLE = {
    1: ("B", "まるで ～ ようだ: Cứ như là..."),
    2: ("B", "Vる + ようにする: Cố gắng duy trì thói quen"),
    3: ("C", "Vる / N + のに いい: Tốt cho việc..."),
    4: ("A", "Vて + ばかりいる: Chỉ toàn làm gì đó"),
    5: ("C", "せずに: Không làm A mà làm B (する → せずに)"),
    6: ("B", "いくら + Vても: Dù có... bao nhiêu"),
    7: ("C", "どんなN + でも: Bất cứ... cũng"),
    8: ("C", "～おかげで: Nhờ có... (kết quả tốt)"),
    9: ("B", "～のに: Mặc dù... nhưng..."),
    10: ("B", "Vなければ ならない: Phải làm"),
    11: ("C", "Vている + うちに: Trong lúc"),
    12: ("D", "もし ～ だったら: Nếu là..."),
    13: ("B", "～らしい: Hình như / nghe nói có căn cứ"),
    14: ("A", "～かもしれない: Có lẽ"),
    15: ("B", "N + らしく: Đúng chất N"),
    16: ("D", "Vる + ことにした: Tự quyết định"),
    17: ("B", "Aは Bほど + phủ định: A không bằng B"),
    18: ("C", "～ため: Vì... (văn viết)"),
    19: ("D", "によると ... そうだ: Nghe nói theo nguồn tin"),
    20: ("C", "だれ/子供 + でも: Ngay cả... cũng"),
    21: ("D", "留学したのに: Mặc dù đã du học"),
    22: ("B", "N + ばかり: Chỉ toàn"),
    23: ("B", "N + どおりに: Đúng theo"),
    24: ("A", "晴れているのに: Mặc dù trời nắng"),
    25: ("A", "Vます + がたい: Khó mà (tâm lý)"),
    26: ("C", "Nはともかく: Khoan bàn đến N"),
    27: ("B", "Vる + ことがある: Thỉnh thoảng có lúc"),
    28: ("A", "～とは: Không ngờ tới"),
    29: ("B", "～せいで: Tại vì (kết quả xấu)"),
    30: ("B", "こわれにくい: Bền, khó hỏng (tự động từ)"),
    31: ("B", "Nと知られている: Được biết đến là"),
    32: ("D", "Vる + たびに: Cứ mỗi lần"),
    33: ("C", "使いにくい: Khó sử dụng"),
    34: ("A", "Vます + そうにない: Có vẻ không thể"),
    35: ("A", "遊んでばかりいる: Chỉ toàn chơi"),
    36: ("D", "Nに比べて: So với N"),
    37: ("A", "Vます + ようがない: Không có cách nào"),
    38: ("A", "のにともなって: Cùng với sự biến đổi"),
    39: ("D", "Nにかけては: Về khoản N thì không ai bằng"),
    40: ("B", "Nからして: Ngay từ N đã thấy"),
    41: ("A", "大雪が降ったせいで: Tại vì tuyết lớn"),
    42: ("C", "N1から N2にかけて: Từ N1 đến N2"),
    43: ("A", "～など: Ngạc nhiên, không ngờ"),
    44: ("B", "Nといえば: Nhắc đến N là nghĩ ngay"),
    45: ("A", "Nの際には: Khi... (trang trọng)"),
    46: ("D", "Vる + とき: Khi"),
    47: ("A", "住んでいるのに: Mặc dù đang sống"),
    48: ("B", "こわれているようだ: Hình như đang hỏng"),
}

R5_LINES = """
C. 動く (動くな！: Cấm cử động!)
D. とまっている (Xe đang đỗ - 自動詞)
A. ねる (Bác sĩ dặn phải ngủ nhiều hơn: Vるように言われた)
C. して (復習をしてください)
B. わかりません (Xem bản đồ cũng không biết đường)
B. 作って (Hồi trẻ bố lập công ty - nối bằng Vて)
D. ひいた (かぜをひいたかもしれません)
A. おどり (おどりながら: Vừa nhảy vừa hát)
A. されて (輸出されている: bị động)
C. かち (かちたいです: muốn thắng)
A. さかん (さかんです)
D. する (するつもりです)
B. よけ (よけなさい)
D. 手伝ってくれて (Cảm ơn vì đã giúp)
C. 食べ (食べちゃおうか = 食べてしまおうか)
B. いかない (うまくいかないだろう)
D. あつまります (Gia đình tụ họp - 自動詞)
A. 受けよう (受けようと思います)
C. 守らない (守らないと = 守らないといけない)
C. わすれて (わすれてしまいました)
A. 疲れていても (Dù có mệt cũng không nghỉ)
B. 話す (話すのは: việc nói)
D. 読む (読むと: hễ đọc thì)
D. 忘れないで (忘れないでほしい)
B. あげる (あげるつもりです)
C. おいしく (おいしくなりました)
D. せずに (準備運動をせずに)
C. できる (できるそうです: nghe nói)
B. 並べて (並べてください - 他動詞)
C. ひどくて (雨がひどくて)
B. なりません (なかなかうまくなりません)
D. 置いた (置いたまま)
D. ささずに (傘をささずに)
B. 好き (好きだ)
A. 食べる (食べるように言われた)
C. 行かなきゃ (行かなきゃ = 行かなければならない)
A. あまった (あまったら)
B. きかない (全然きかない)
D. はずす (メガネをはずすと)
B. ゆずらない (だれも席をゆずらない)
A. 降らない (雨が降らないうちに)
C. 行かせて (私に行かせてください)
D. 受かる (試験に受かる)
B. きれ (きれそうだ: sắp hết)
C. 多 (多すぎて: không có い trước すぎて)
B. 止めさせて (止めさせてもらえませんか)
B. あこがれて (あこがれて)
D. ためす (実力をためすために)
A. ある (アパートがあるので)
B. なくなった (昨日なくなった)
""".strip().splitlines()


def parse_letter_expl(line: str) -> tuple[str, str]:
    m = re.match(r"([A-D])\.\s*(.*)", line.strip())
    if not m:
        raise ValueError(line)
    return m.group(1), m.group(2).strip()


def apply_letter_expl(qs: list[dict], lines: list[str]):
    assert len(qs) == len(lines), f"{len(qs)} vs {len(lines)}"
    for q, line in zip(qs, lines):
        letter, expl = parse_letter_expl(line)
        q["correctAnswer"] = letter
        q["explanation"] = expl
        q["keyTakeaway"] = expl.split("(")[0].strip()


def parse_r3_line(line: str) -> tuple[str, str]:
    m = re.search(r"([A-D])\.\s*(.*)", line)
    return m.group(1), m.group(2).strip()


def parse_dokkai() -> list[dict]:
    raw = slice_between(DECUONG, "読解（質問）", "問題1")
    parts = re.split(r"（(\d+)）\n", raw)
    meta = {
        1: {"title": "Chuyện của Hiệu trưởng đại học", "blanks": False},
        2: {"title": "Hội thoại Yamada và Yan đặt khách sạn đi Nha Trang", "blanks": True},
        3: {"title": "Hội thoại Yamada và Nakamura mất cặp sách trên tàu", "blanks": True},
        4: {"title": "Bài viết của 林明 về chú chó Pochi", "blanks": True},
        5: {"title": "Cửa hàng nhỏ gần nhà", "blanks": True},
        6: {"title": "Thư của アリ gửi 田中 về việc chuyển nhà", "blanks": True},
        7: {"title": "わたしの好きな場所 — Phòng trà trong công viên", "blanks": True},
        8: {"title": "Hướng dẫn rút tiền ATM ở ngân hàng", "blanks": True},
        9: {"title": "Bài viết của スミス về lời chào tiếng Nhật", "blanks": True},
        10: {"title": "Đau bụng đi bệnh viện cùng tiền bối 田中", "blanks": True},
    }
    answers = {
        1: [("A", "Nói với các thầy cô giáo trong trường"), ("D", "Dừng bài giảng và nhìn chằm chằm vào sinh viên đang nói chuyện"), ("C", "Những sinh viên nghiêm túc và du học sinh bị làm phiền"), ("D", "Nếu không muốn học thì không cần tham dự tiết học")],
        2: [("B", "しばらく — Nghỉ một khoảng thời gian"), ("D", "何日 休みですか"), ("C", "どんな所がいいですか"), ("A", "予約しなければなりませんか"), ("C", "山田さん là người đặt phòng")],
        3: [("D", "なくしてしまったん"), ("B", "もちろんです"), ("C", "お借りした — cuốn sách tôi mượn của thầy"), ("B", "Thầy giáo cho Nakamura mượn sách"), ("B", "Tiền hầu như không có trong cặp")],
        4: [("B", "こわして しまった"), ("C", "さびしく なくなりました"), ("D", "それに"), ("D", "兄弟がいない = 0人"), ("B", "ソファー trước tivi")],
        5: [("A", "それで"), ("D", "いつもなら"), ("B", "ないかもしれない"), ("C", "店では"), ("D", "と言って")],
        6: [("A", "今のアパートは"), ("D", "便利になりました"), ("C", "思っています"), ("A", "いい景色"), ("D", "Đi bộ khoảng 10 phút")],
        7: [("D", "行ったことがありません"), ("B", "そこから"), ("D", "好きです"), ("B", "Đi dạo và nghỉ ngơi"), ("D", "Mỗi tháng 1 lần = 12 lần/năm")],
        8: [("C", "決めた — mã số tự mình đã quyết định"), ("C", "おぼえていますか"), ("D", "おせば"), ("A", "Ở ngân hàng"), ("D", "暗証番号 → 数字 → 「円」")],
        9: [("A", "わたしの国"), ("B", "いみが ありません"), ("D", "大切です"), ("C", "田中先生")],
        10: [("C", "だんだんいたくなってきました"), ("C", "行ったことがありませんでした"), ("D", "はじめてなので"), ("D", "Đi cùng tiền bối Tanaka"), ("D", "Lời nói của bác sĩ và y tá khó hiểu")],
    }
    passages = []
    for i in range(1, len(parts), 2):
        n = int(parts[i])
        body = parts[i + 1]
        qpos = body.find("問1")
        passage = body[:qpos].strip()
        qraw = body[qpos:]
        qs = parse_quiz_section(qraw, f"dokkai{n}", f"d{n}")
        for q, (letter, expl) in zip(qs, answers[n]):
            q["correctAnswer"] = letter
            q["explanation"] = expl
            q["keyTakeaway"] = expl
        passages.append(
            {
                "id": f"dokkai_{n}",
                "number": n,
                "title": meta[n]["title"],
                "passage": passage,
                "questions": qs,
            }
        )
    return passages


def numbered_options(block: str) -> dict:
    mapping = {}
    for m in re.finditer(r"([1-4])\s+([^\n1-4]+?)(?=(?:\s*[1-4]\s)|$)", " ".join(block.split())):
        mapping[m.group(1)] = re.sub(r"\s+", " ", m.group(2)).strip()
    # fallback line-based
    if len(mapping) < 2:
        mapping = {}
        for m in re.finditer(r"^([1-4])\s+(.*)$", block, re.M):
            mapping[m.group(1)] = m.group(2).strip()
    return mapping


def parse_choukai() -> dict:
    raw = slice_between(DECUONG, "問題1\n", "会話テーマ")
    p1 = slice_between(raw, "問題1", "問題2")
    p2 = slice_between(raw, "問題2", "問題3")
    p3 = slice_between(raw, "問題3", "問題4")
    p4 = slice_between(raw, "問題4", "問題5")
    p5 = slice_between(raw, "問題5", None)

    def parse_bans(section_raw: str, count: int, prefix: str, n_opts: int = 4) -> list[dict]:
        items = []
        chunks = re.split(r"(\d+)ばん", section_raw)
        found = {}
        for i in range(1, len(chunks), 2):
            num = int(chunks[i])
            body = chunks[i + 1]
            nxt = re.split(r"\d+ばん|すぐ返事|問題\d", body)[0]
            opts = numbered_options(nxt)
            # normalize keys to A-D or 1-3
            letters = {}
            keys = sorted(opts, key=lambda x: int(x))
            labels = "ABCD" if n_opts == 4 else "ABC"
            for idx, k in enumerate(keys[:n_opts]):
                letters[labels[idx]] = opts[k]
            if not letters:
                for idx in range(n_opts):
                    letters[labels[idx]] = f"Lựa chọn {idx + 1}"
            found[num] = {
                "id": f"{prefix}_{num}",
                "section": prefix,
                "questionNumber": num,
                "questionText": f"{num}ばん — nghe đoạn và chọn đáp án phù hợp (không có băng audio trên đề giấy).",
                "options": letters,
                "correctAnswer": "",
                "explanation": "Phần nghe: luyện theo lựa chọn trên đề. Gắn file audio nếu bạn có bản ghi.",
                "keyTakeaway": "",
                "image": None,
            }
        for n in range(1, count + 1):
            if n not in found:
                labels = "ABCD" if n_opts == 4 else "ABC"
                found[n] = {
                    "id": f"{prefix}_{n}",
                    "section": prefix,
                    "questionNumber": n,
                    "questionText": f"{n}ばん — xem hình / nghe băng rồi chọn.",
                    "options": {labels[i]: f"Lựa chọn {i + 1}" for i in range(n_opts)},
                    "correctAnswer": "",
                    "explanation": "Câu này trên đề chủ yếu là hình minh họa, không trích được đầy đủ chữ.",
                    "keyTakeaway": "",
                    "image": None,
                }
            items.append(found[n])
        return items

    mondai1 = parse_bans(p1, 19, "choukai1", 4)
    # map leftover images to picture questions
    picture_qs = [3, 6, 7, 8, 13, 14, 15, 16, 18, 19]
    imgs = [
        "image3.jpg",
        "image4.jpg",
        "image5.jpg",
        "image6.jpeg",
        "image7.jpg",
        "image8.jpg",
        "image9.jpg",
        "image10.jpg",
        "image11.jpg",
        "image12.jpg",
    ]
    for qn, img in zip(picture_qs, imgs):
        mondai1[qn - 1]["image"] = f"/images/{img}"
        mondai1[qn - 1]["questionText"] = f"{qn}ばん — nhìn hình trên đề và chọn đáp án A–D sau khi nghe."

    mondai2 = parse_bans(p2, 10, "choukai2", 4)
    mondai3 = parse_bans(p3, 12, "choukai3", 3)
    mondai4 = parse_bans(p4, 4, "choukai4", 3)
    mondai5 = parse_bans(p5, 8, "choukai5", 3)

    m4_ans = [
        ("C", "ノート、写させてもらえる？ — Cho mình mượn vở chép được không?"),
        ("C", "辞書、持ってない？ — Cậu có mang từ điển không?"),
        ("C", "ちょっと着てみてもいいですか。 — Tôi mặc thử một chút có được không?"),
        ("A", "ここ、おかけになりませんか。 — Mời ngài ngồi (tôn kính ngữ)"),
    ]
    m5_ans = [
        ("A", "え、いいの？ありがとう。 / hoặc いいよ。遠慮しないで食べて"),
        ("B", "そう？読みにくいかな"),
        ("C", "うん、来週会ったときでいい？"),
        ("A", "どうぞ召し上がってください。 — khi khách nói いただきます"),
        ("A", "もう少し待ってもらえますか。"),
        ("A", "はい、拝見します / いえ、おりませんが。 — khiêm nhường ngữ"),
        ("A", "はい、申し訳ありません。 / 本当にお世話になりました。"),
        ("B", "行きたかったんだけど…。"),
    ]
    for q, (letter, expl) in zip(mondai4, m4_ans):
        q["correctAnswer"] = letter
        q["explanation"] = expl
        q["keyTakeaway"] = expl
        q["questionText"] = f"{q['questionNumber']}ばん — Chọn câu nói phù hợp tình huống."
    for q, (letter, expl) in zip(mondai5, m5_ans):
        q["correctAnswer"] = letter
        q["explanation"] = expl
        q["keyTakeaway"] = expl
        q["questionText"] = f"{q['questionNumber']}ばん — Chọn câu trả lời phù hợp (phản xạ nghe)."

    # fix 問題4 options from clean text / tonghop
    mondai4[0]["options"] = {
        "A": "ノート、写してくれない？",
        "B": "ノート、写させてもいい？",
        "C": "ノート、写させてもらえる？",
    }
    mondai4[1]["options"] = {
        "A": "辞書、持とうか。",
        "B": "辞書、忘れてるよ。",
        "C": "辞書、持ってない？",
    }
    mondai4[2]["options"] = {
        "A": "ちょっと着させてみましょうか。",
        "B": "ちょっと着せてもらいませんか。",
        "C": "ちょっと着てみてもいいですか。",
    }
    mondai4[3]["options"] = {
        "A": "ここ、おかけになりませんか。",
        "B": "ここ、おかけしましょうか。",
        "C": "ここ、おかけしたらどうですか。",
    }
    mondai5[0]["options"] = {
        "A": "え、いいの？ありがとう。",
        "B": "今日はあんまりお腹が空いてないんだけど",
        "C": "いいよ。遠慮しないで食べて",
    }
    mondai5[1]["options"] = {
        "A": "じゃ、聞かなくしないの？",
        "B": "そう？読みにくいかな",
        "C": "うん、約束してないよ。",
    }
    mondai5[2]["options"] = {
        "A": "うん、明日持ってくるよ。",
        "B": "うん、さんにもらうんだね。",
        "C": "うん、来週会ったときでいい？",
    }
    mondai5[3]["options"] = {
        "A": "どうぞ召し上がってください。",
        "B": "後でご覧ください。",
        "C": "ええ、おいでください。",
    }
    mondai5[4]["options"] = {
        "A": "もう少し待ってもらえますか。",
        "B": "え？もうできないんですか。",
        "C": "もうできないんじゃないかな。",
    }
    mondai5[5]["options"] = {
        "A": "はい、拝見します",
        "B": "先日、お目にかかりました。",
        "C": "いえ、おりませんが。",
    }
    mondai5[6]["options"] = {
        "A": "はい、申し訳ありません。",
        "B": "本当にお世話になりました。",
        "C": "どうぞ、お気をつけて",
    }
    mondai5[7]["options"] = {
        "A": "行かなくてもいいよね。",
        "B": "行きたかったんだけど…。",
        "C": "わたしも行けてよかったな。",
    }

    return {
        "mondai1": mondai1,
        "mondai2": mondai2,
        "mondai3": mondai3,
        "mondai4": mondai4,
        "mondai5": mondai5,
    }


def kaiwa_sakubun() -> dict:
    return {
        "kaiwa": [
            {
                "id": "kaiwa1",
                "title": "① 自己紹介",
                "theme": "Giới thiệu bản thân",
                "notes": "Trình bày thông tin cá nhân, sở thích, sở trường/sở đoản.",
                "qa": [
                    {"q": "あなたの趣味はなんですか。", "a": "私の趣味は音楽を聞くことと映画を見ることです。"},
                    {"q": "あなたの長所／短所はなんですか。", "a": "私の長所はまじめで、責任感が強いところです。短所は少し心配性なところです。"},
                    {"q": "あなたの誕生日は何月何日ですか。", "a": "私の誕生日は {{birthday}} です。"},
                    {"q": "あなたは何が得意／苦手ですか。", "a": "料理を作ることが得意ですが、歌を歌うことが苦手です。"},
                    {"q": "あなたは今、何をしていますか。", "a": "今、大学の4年生で、卒業するために一生懸命勉強しています。"},
                    {"q": "あなたは何に興味がありますか。", "a": "日本の文化や日本のアニメに興味があります。"},
                    {"q": "一番したいことは何ですか。", "a": "大学を卒業してから、日本へ旅行に行きたいです。"},
                    {"q": "暇な時、よく何をしますか。", "a": "暇な時、よく友達とコーヒーを飲んだり、ゲームをしたりします。"},
                    {"q": "今、だれと一緒に住んでいますか。", "a": "今、家族と一緒に住んでいます。"},
                ],
            },
            {
                "id": "kaiwa2",
                "title": "② 私の家族",
                "theme": "Gia đình của tôi",
                "notes": "Thành phần gia đình, công việc, tính cách, so sánh.",
                "qa": [
                    {"q": "家族は何人いますか。", "a": "私の家族は{{familyMembers}}人です。父と母と兄（妹）と私です。"},
                    {"q": "ご両親の仕事は何ですか。", "a": "父は会社員で、母は主婦です。"},
                    {"q": "ご両親は家にいる時、どんなことをしますか。", "a": "父はよくテレビでニュースを見ます。母は料理を作ったり、庭の花を育てたりします。"},
                    {"q": "ご両親はどんな性格ですか。", "a": "父はまじめで静かな人です。母はとても明るくて親切な人です。"},
                    {"q": "ご両親の趣味は何ですか。", "a": "父の趣味は読書で、母の趣味は料理です。"},
                    {"q": "あなたの兄弟、姉妹は今、何歳ですか。", "a": "兄は27歳で、私は22歳です。"},
                    {"q": "あなたの兄弟、姉妹は何をしていますか。", "a": "兄は会社員です。私は大学生です。"},
                    {"q": "あなたの兄弟、姉妹はどんな性格ですか。", "a": "兄は少し厳しいですが、優しい人です。"},
                    {"q": "家で料理が一番上手な人は誰ですか。", "a": "家で料理が一番上手な人は母です。"},
                    {"q": "お父さんとお母さんはどちらが厳しいですか。", "a": "父のほうが厳しいです。"},
                ],
            },
            {
                "id": "kaiwa3",
                "title": "③ 私の将来",
                "theme": "Tương lai của tôi",
                "notes": "Ngành học và kế hoạch tương lai.",
                "qa": [
                    {"q": "専門はなんですか。", "a": "私の専門は{{major}}です。"},
                    {"q": "今、何を勉強していますか。", "a": "今、専門の知識と日本語を勉強しています。"},
                    {"q": "将来は何をするつもりですか。", "a": "卒業してから、日系企業に入って働きたいです。"},
                    {"q": "卒業してから、何をしたいですか。", "a": "卒業してから、日系企業に入って働きたいです。"},
                    {"q": "どんな会社で働きたいですか。", "a": "ベトナムにある日本のIT会社でエンジニアとして働きたいです。"},
                    {"q": "いつ結婚しようと思いますか。", "a": "28歳ごろ結婚しようと思います。"},
                    {"q": "子供が何人欲しいですか。", "a": "子供が2人欲しいです。"},
                    {"q": "日本で働きたいですか。どうしてですか。", "a": "はい、働きたいです。技術が進んでいますし、勉強した日本語が生かせるからです。"},
                    {"q": "ベトナムでの日本の会社で働きたいですか。どうしてですか。", "a": "はい、働きたいです。日本の会社は技術が進んでいますし、給料もいいし、勉強した日本語が生かせるからです。"},
                ],
            },
            {
                "id": "kaiwa4",
                "title": "④ お誕生日",
                "theme": "Ngày sinh nhật",
                "notes": "Bắt buộc dùng: Vて、Vて / Vたり、Vたりする / いAくなる／なA・Nになる / やる・あげる・もらう・くれる / ほしい. Dùng quá khứ.",
                "grammar": [
                    "Vて、Vて",
                    "Vたり、Vたりする",
                    "いAくなる／なA・Nになる",
                    "Nをやる／あげる",
                    "Nをもらう",
                    "Nをくれる",
                    "Nがほしい",
                    "Vてやる／あげる、もらう／くれる（過去形）",
                ],
                "qa": [
                    {"q": "あなたの誕生日は何月何日ですか。", "a": "私の誕生日は {{birthday}} です。"},
                    {"q": "誕生日パーティーをしたことがありますか。", "a": "はい、去年の誕生日に、家で誕生日パーティーをしました。"},
                    {"q": "その誕生日で何歳になりましたか。", "a": "その誕生日で21歳になりました。"},
                    {"q": "どこでパーティーをしましたか。", "a": "家でパーティーをしました。"},
                    {"q": "友達が来ましたか。", "a": "大学の親しい友達が5人来てくれました。"},
                    {"q": "どんなふくそうをしましたか。", "a": "私はきれいなシャツを着ました。"},
                    {"q": "料理を作りましたか／どんな料理を作りましたか。", "a": "母と一緒にケーキやからあげ、サラダなど、いろいろな料理を作りました。"},
                    {"q": "何を食べて、何を飲みましたか。", "a": "おいしい料理を食べたり、ジュースを飲んだりしました。"},
                    {"q": "何をもらいましたか／あげましたか。", "a": "友達からすてきな時計とかわいいかばんをもらいました。"},
                    {"q": "パーティーでどんなことをしましたか。", "a": "みんなで歌を歌ったり、ゲームをしたりしました。"},
                    {"q": "写真をとりましたか。", "a": "記念の写真もたくさん撮りました。"},
                    {"q": "そのパーティーはどうでしたか。", "a": "そのパーティーは本当ににぎやかで、忘れられない楽しい思い出になりました。"},
                ],
            },
        ],
        "sakubun": [
            {
                "id": "sakubun1",
                "title": "作文①：私の一日",
                "prompts": [
                    {"q": "毎朝何時におきますか。", "hint": "毎日〜時に起きます"},
                    {"q": "朝起きて出かけるまでに何をしますか。", "hint": "Vて、Vてから"},
                    {"q": "何時に家を出ますか。", "hint": "〜時に家を出て"},
                    {"q": "授業は何時から何時までですか。", "hint": "〜から〜までです"},
                    {"q": "学校ではどんなことをしますか。", "hint": "Vたり、Vたりします"},
                    {"q": "昼休みは何時から何時までですか。", "hint": "〜から〜までです"},
                    {"q": "昼ごはんはどこでだれと食べますか。", "hint": "〜で友達と一緒に"},
                    {"q": "授業が終わった後で、どこかへ行きますか。何をしますか。", "hint": "〜た後で"},
                    {"q": "何時に家へ帰りますか。", "hint": "〜時ごろ家へ帰ります"},
                    {"q": "家へ帰ってから、晩ごはんの前に何をしますか。", "hint": "〜てから"},
                    {"q": "晩ごはんは家で食べますか。", "hint": "家族と一緒に"},
                    {"q": "晩ごはんのあとで何をしますか。", "hint": "復習をします／音楽を聞きます"},
                    {"q": "毎晩何時に寝ますか。", "hint": "毎晩〜時ごろ寝ます"},
                ],
                "sample": "私は毎日6時半に起きます。顔を洗って、歯を磨いてから、家で朝ごはんを食べます。7時半に家を出て、バイクで大学へ行きます。\n\n大学の授業は8時から11時半までです。学校では専門の勉強をしたり、日本語を勉強したりします。昼休みは11時半から1時までです。いつも学校の食堂で友達と一緒に昼ごはんを食べます。\n\n午後の授業が終わった後で、図書館で宿題をします。それから、5時ごろ家へ帰ります。家へ帰ってから、晩ごはんの前にシャワーを浴びます。7時に家族と一緒に家で晩ごはんを食べます。晩ごはんのあとで、日本語の復習をして、少し音楽を聞きます。毎晩11時半ごろ寝ます。毎日忙しいですが、とても楽しいです。",
                "translation": "Tôi dậy lúc 6 rưỡi mỗi ngày. Rửa mặt, đánh răng rồi ăn sáng ở nhà. 7 rưỡi ra khỏi nhà, đi xe máy đến trường.\nBuổi học từ 8h đến 11h30. Ở trường vừa học chuyên ngành vừa học tiếng Nhật. Giờ nghỉ trưa 11h30–13h, thường ăn cùng bạn ở căng tin.\nTan học buổi chiều thì làm bài ở thư viện, khoảng 5h về nhà, tắm trước bữa tối, 7h ăn tối cùng gia đình. Sau đó ôn tiếng Nhật, nghe nhạc một chút, ngủ khoảng 11h30. Mỗi ngày bận nhưng rất vui.",
            },
            {
                "id": "sakubun2",
                "title": "作文②：なぜ日本語を勉強するか",
                "prompts": [
                    {"q": "どうして日本語を勉強したいと思ったのですか。", "hint": "〜が大好きだったので"},
                    {"q": "それはいつごろですか。", "hint": "高校生の時から"},
                    {"q": "日本語を勉強して何年になりますか。", "hint": "今年で〜年になります"},
                    {"q": "どこで日本語を勉強しましたか。", "hint": "ベトナムの大学で"},
                    {"q": "日本語の勉強は大変ですか。", "hint": "漢字や文法が多くて大変です"},
                    {"q": "途中でやめようと思ったことがありますか。", "hint": "〜たことはありません"},
                    {"q": "日本のどんな所に興味を持ちますか。", "hint": "歴史やアニメ、働き方"},
                    {"q": "あなたの国では、日本語を勉強している人が多いですか。", "hint": "とても多いです"},
                    {"q": "あなたの国では、日本語を勉強したら、何かに役に立ちますか。", "hint": "いい仕事を見つけるのに役に立ちます"},
                    {"q": "これからもずっと日本語の勉強を続けていくつもりですか。", "hint": "〜つもりです"},
                    {"q": "将来、何か日本語が生かせる仕事をしたいと思いますか。", "hint": "日系企業に入って"},
                ],
                "sample": "私は高校生の時から日本のアニメと文化が大好きだったので、日本語を勉強したいと思いました。大学に入ってから日本語を勉強し始めて、今年で3年になります。ベトナムの大学で日本語を勉強しました。\n\n日本語の勉強は漢字や文法が多くてとても大変ですが、途中でやめようと思ったことはありません。日本の歴史やアニメ、そして日本人のまじめな働き方に興味を持っています。\n\n今、ベトナムでは日本語を勉強している人がとても多いです。ベトナムには日本の会社がたくさんあるので、日本語を勉強したら、いい仕事を見つけるのにとても役に立ちます。ですから、これからもずっと日本語の勉強を続けていくつもりです。将来は、日系企業に入って、日本語が生かせる仕事をしたいと思います。",
                "translation": "Từ hồi cấp 3 tôi đã thích anime và văn hóa Nhật nên muốn học tiếng Nhật. Vào đại học mới bắt đầu, năm nay là năm thứ 3, học tại trường đại học ở Việt Nam.\nHọc tiếng Nhật nhiều chữ Hán và ngữ pháp nên rất vất vả, nhưng chưa từng nghĩ bỏ giữa chừng. Tôi thích lịch sử, anime và cách làm việc nghiêm túc của người Nhật.\nỞ Việt Nam hiện có rất nhiều người học tiếng Nhật. Có nhiều công ty Nhật nên học tiếng Nhật giúp tìm việc tốt. Tôi sẽ tiếp tục học và sau này muốn vào doanh nghiệp Nhật để dùng được tiếng Nhật.",
            },
            {
                "id": "sakubun3",
                "title": "作文③：お誕生日",
                "prompts": [
                    {"q": "あなたの誕生日は何月何日ですか。", "hint": "私の誕生日は Date です"},
                    {"q": "誕生日パーティーをしたことがありますか。", "hint": "Vたことがあります"},
                    {"q": "その誕生日で何歳になりましたか。", "hint": "〜歳になりました"},
                    {"q": "どこでパーティーをしましたか。", "hint": "家で"},
                    {"q": "友達が来ましたか。", "hint": "来てくれました"},
                    {"q": "どんなふくそうをしましたか。", "hint": "シャツを着て"},
                    {"q": "料理を作りましたか／どんな料理を作りましたか。", "hint": "Vて、Vて"},
                    {"q": "何を食べて、何を飲みましたか。", "hint": "Vたり、Vたりしました"},
                    {"q": "何をもらいましたか／あげましたか。", "hint": "Nをもらいました"},
                    {"q": "パーティーでどんなことをしましたか。", "hint": "歌ったり、ゲームをしたり"},
                    {"q": "写真をとりましたか。", "hint": "写真を撮りました"},
                    {"q": "そのパーティーはどうでしたか。", "hint": "にぎやかで、楽しい思い出になりました"},
                ],
                "sample": "私の誕生日は Date です。去年の誕生日に、家で誕生日パーティーをしました。その誕生日で21歳になりました。\n\nパーティーには大学の親しい友達が5人来てくれました。私はきれいなシャツを着て、母と一緒にケーキやからあげ、サラダなど、いろいろな料理を作りました。パーティーでは、おいしい料理を食べたり、ジュースを飲んだりしました。友達からすてきな時計とかわいいかばんをもらいました。みんなで歌を歌ったり、ゲームをしたりして、記念の写真もたくさん撮りました。そのパーティーは本当ににぎやかで、忘れられない楽しい思い出になりました。",
                "translation": "Sinh nhật tôi là Date. Năm ngoái tổ chức tiệc ở nhà, năm đó tôi 21 tuổi.\nNăm người bạn thân đại học đã đến. Tôi mặc sơ mi đẹp, cùng mẹ làm bánh, karaage, salad. Ăn món ngon, uống nước trái cây, nhận đồng hồ và túi từ bạn. Cùng hát, chơi game, chụp nhiều ảnh kỷ niệm. Bữa tiệc rất náo nhiệt, thành kỷ niệm vui không quên.",
            },
        ],
    }


def build_flashcards(f1, r2, r3, r4, r5):
    deck1 = [
        {
            "id": f"fc1_{q['questionNumber']}",
            "front": q["questionText"],
            "back": q["keyTakeaway"] or q["explanation"],
            "extra": q["options"].get(q["correctAnswer"], ""),
        }
        for q in f1
    ]
    deck2 = [
        {
            "id": f"fc2_{q['questionNumber']}",
            "front": q["questionText"],
            "back": q["explanation"],
            "extra": q["options"].get(q["correctAnswer"], ""),
        }
        for q in r2
    ]
    deck3 = [
        {
            "id": f"fc3_{q['questionNumber']}",
            "front": q["questionText"],
            "back": q["explanation"],
            "extra": q["options"].get(q["correctAnswer"], ""),
        }
        for q in r3
    ]
    grammar = []
    seen = set()
    for q in r4 + r5:
        key = q["keyTakeaway"]
        if key and key not in seen:
            seen.add(key)
            grammar.append(
                {
                    "id": f"fc4_{len(grammar)+1}",
                    "front": key,
                    "back": q["explanation"],
                    "extra": q["questionText"],
                }
            )
    return {
        "deck1": {"id": "deck1", "title": "44 cặp đồng nghĩa (復習1)", "cards": deck1},
        "deck2": {"id": "deck2", "title": "65 collocation (練習2)", "cards": deck2},
        "deck3": {"id": "deck3", "title": "50 Kanji (練習3)", "cards": deck3},
        "deck4": {"id": "deck4", "title": "Ngữ pháp & chia thể (練習4–5)", "cards": grammar[:30]},
    }


def main():
    f1_raw = slice_between(DECUONG, "復習1", "練習2")
    r2_raw = slice_between(DECUONG, "練習2", "練習3")
    r3_raw = slice_between(DECUONG, "練習3", "練習4")
    r4_raw = slice_between(DECUONG, "練習4", "練習5")
    r5_raw = slice_between(DECUONG, "練習5", "読解")

    f1 = parse_quiz_section(f1_raw, "fukushuu1", "f1")
    r2 = parse_quiz_section(r2_raw, "renshuu2", "r2")
    r3 = parse_quiz_section(r3_raw, "renshuu3", "r3")
    r4 = parse_quiz_section(r4_raw, "renshuu4", "r4")
    r5 = parse_quiz_section(r5_raw, "renshuu5", "r5")

    # fix r2 q19 missing option A
    r2[18]["options"]["A"] = "れんしゅう"

    for q in f1:
        n = q["questionNumber"]
        q["correctAnswer"] = F1_ANSWERS[n]
        q["keyTakeaway"] = F1_KEYS[n]
        q["explanation"] = F1_KEYS[n]
        # highlight between first content words
        q["highlightWord"] = q["questionText"][:18]

    apply_letter_expl(r2, R2_ANSWERS_EXPL)
    for i, line in enumerate(R3_A + R3_B):
        letter, expl = parse_r3_line(line)
        r3[i]["correctAnswer"] = letter
        r3[i]["explanation"] = expl
        r3[i]["keyTakeaway"] = expl
        r3[i]["section"] = "renshuu3_a" if i < 25 else "renshuu3_b"
    for q in r4:
        letter, expl = R4_TABLE[q["questionNumber"]]
        q["correctAnswer"] = letter
        q["explanation"] = expl
        q["keyTakeaway"] = expl
    apply_letter_expl(r5, R5_LINES)

    dokkai = parse_dokkai()
    choukai = parse_choukai()
    ks = kaiwa_sakubun()
    cards = build_flashcards(f1, r2, r3, r4, r5)

    files = {
        "fukushuu1.js": ("fukushuu1", f1),
        "renshuu2.js": ("renshuu2", r2),
        "renshuu3.js": ("renshuu3", r3),
        "renshuu4.js": ("renshuu4", r4),
        "renshuu5.js": ("renshuu5", r5),
        "dokkai.js": ("dokkai", dokkai),
        "choukai.js": ("choukai", choukai),
        "kaiwa_sakubun.js": ("kaiwaSakubun", ks),
        "flashcards.js": ("flashcardDecks", cards),
    }
    for fname, (export, value) in files.items():
        (SRC_DATA / fname).write_text(js_module(export, value), encoding="utf-8")

    all_quiz = f1 + r2 + r3 + r4 + r5
    (SRC_DATA / "index.js").write_text(
        """import { fukushuu1 } from './fukushuu1.js'
import { renshuu2 } from './renshuu2.js'
import { renshuu3 } from './renshuu3.js'
import { renshuu4 } from './renshuu4.js'
import { renshuu5 } from './renshuu5.js'
import { dokkai } from './dokkai.js'
import { choukai } from './choukai.js'
import { kaiwaSakubun } from './kaiwa_sakubun.js'
import { flashcardDecks } from './flashcards.js'

export const quizSections = [
  { id: 'fukushuu1', title: '復習1 · Đồng nghĩa', questions: fukushuu1 },
  { id: 'renshuu2', title: '練習2 · Từ vựng', questions: renshuu2 },
  { id: 'renshuu3', title: '練習3 · Kanji', questions: renshuu3 },
  { id: 'renshuu4', title: '練習4 · Ngữ pháp', questions: renshuu4 },
  { id: 'renshuu5', title: '練習5 · Chia thể', questions: renshuu5 },
]

export const allQuizQuestions = quizSections.flatMap((s) => s.questions)

export { fukushuu1, renshuu2, renshuu3, renshuu4, renshuu5, dokkai, choukai, kaiwaSakubun, flashcardDecks }

export const COUNTS = {
  quiz: allQuizQuestions.length,
  dokkaiPassages: dokkai.length,
  dokkaiQuestions: dokkai.reduce((n, p) => n + p.questions.length, 0),
  kaiwa: kaiwaSakubun.kaiwa.length,
  sakubun: kaiwaSakubun.sakubun.length,
}
""",
        encoding="utf-8",
    )

    def opt_ok(q):
        return set(q["options"].keys()) >= {"A", "B", "C"} and all(q["options"].values()) and q["correctAnswer"]

    print("f1", len(f1), "opts", all(len(q["options"]) == 4 and opt_ok(q) for q in f1))
    print("r2", len(r2), "opts", all(len(q["options"]) == 4 and opt_ok(q) for q in r2), "bad", [q["questionNumber"] for q in r2 if len(q["options"]) != 4 or not opt_ok(q)])
    print("r3", len(r3), [q["questionNumber"] for q in r3 if len(q["options"]) != 4])
    print("r4", len(r4), [q["questionNumber"] for q in r4 if len(q["options"]) != 4])
    print("r5", len(r5), [q["questionNumber"] for q in r5 if len(q["options"]) != 4])
    print("dokkai", len(dokkai), [len(p["questions"]) for p in dokkai])
    print("quiz total", len(all_quiz))
    for q in f1 + r2 + r3 + r4 + r5:
        if q["correctAnswer"] not in q["options"]:
            print("MISSING ANS", q["id"], q["correctAnswer"], q["options"].keys())


if __name__ == "__main__":
    main()
