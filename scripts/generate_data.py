# -*- coding: utf-8 -*-
"""Parse N3-VJIT source texts into src/data JS modules."""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

ROOT = Path(r"C:\_workspace\web\nn13")
APP = ROOT / "n3-vjit-webapp"
DATA = APP / "src" / "data"
PUBLIC_IMG = APP / "public" / "images"
PARAS = ROOT / "decuong.docx.paras.txt"
TONGHOP = ROOT / "tonghop.txt"


def js_module(name: str, value) -> str:
    dumped = json.dumps(value, ensure_ascii=False, indent=2)
    return f"export const {name} = {dumped};\n"


def write_js(filename: str, name: str, value) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / filename).write_text(js_module(name, value), encoding="utf-8")


def split_options(blob: str) -> dict[str, str]:
    blob = blob.replace("\n", " ").strip()
    blob = re.sub(r"\s+", " ", blob)
    if not re.search(r"A\.", blob):
        blob = "A. " + blob
    parts = re.split(r"(?=[A-D]\.\s*)", blob)
    opts: dict[str, str] = {}
    for part in parts:
        m = re.match(r"([A-D])\.\s*(.*)", part.strip())
        if m:
            opts[m.group(1)] = re.sub(r"\s+", " ", m.group(2)).strip(" .　")
    return opts


def parse_mcq_block(text: str, expected: int) -> list[dict]:
    chunks = re.split(r"問(\d+)[：:]", text)
    items = []
    for i in range(1, len(chunks), 2):
        num = int(chunks[i])
        body = chunks[i + 1]
        next_sec = re.search(r"(練習\d|読解|問題1)", body)
        if next_sec:
            body = body[: next_sec.start()]
        body = body.strip()
        opt_match = re.search(r"A\.\s*|ちいさい|レンタル", body)
        if not opt_match:
            continue
        qtext = body[: opt_match.start()].strip()
        opt_blob = body[opt_match.start() :]
        # stop at following question remnant
        opt_blob = re.split(r"\n(?=問\d)", opt_blob)[0]
        options = split_options(opt_blob)
        if len(options) < 4:
            # try looser: numbered 1-4 for choukai later
            pass
        items.append(
            {
                "questionNumber": num,
                "questionText": re.sub(r"\s+", " ", qtext).strip(),
                "options": options,
            }
        )
    by_num = {x["questionNumber"]: x for x in items}
    missing = [n for n in range(1, expected + 1) if n not in by_num]
    if missing:
        print(f"  missing questions: {missing[:20]}{'...' if len(missing)>20 else ''}")
    extra = [n for n in by_num if n > expected]
    if extra:
        print(f"  extra questions: {extra}")
    return [by_num[n] for n in range(1, expected + 1) if n in by_num]


def section_between(text: str, start: str, end: str | None) -> str:
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

F1_KEYS = [
    ("かおいろが悪い", "かおいろが悪い (Sắc mặt kém) = かおが青い (Mặt xanh xao)", "Sắc mặt kém/xấu (顔色が悪い) đồng nghĩa với mặt tái xanh (顔が青い) khi mệt hoặc ốm."),
    ("おじょうさん / おいくつ", "おじょうさん = むすめさん | おいくつ = なんさい", "お嬢さん là cách nói lịch sự chỉ con gái người khác; おいくつ = 何歳."),
    ("たしかです", "～は たしかです = きっと～ます", "たしかです nghĩa là chắc chắn, đồng nghĩa với きっと来ます."),
    ("はながいい", "はながいい = においがよくわかる", "鼻がいい: thính mũi, nhận biết mùi tốt."),
    ("見なおしてもらう", "見なおしてもらう = よくないところを なおしてもらう", "Nhờ giáo viên xem và sửa chỗ chưa tốt, không phải làm lại từ đầu."),
    ("どちらか", "ふたつのうち どちらか = 一つ", "Chọn một trong hai cái."),
    ("7000円も", "Số lượng + も = 多いと思う", "も nhấn mạnh số lượng nhiều."),
    ("けっして～ないでください", "けっして～ないでください = ～てはいけません", "Tuyệt đối không được nói với ai khác."),
    ("15分いないに", "15分いないに = 15分 かかりません", "Trong vòng 15 phút = chưa mất đến 15 phút."),
    ("Vた + ばかり", "Vた + ばかり = Vます + おわりました", "Vừa mới ăn xong cơm."),
    ("安心しました", "安心しました = 心配がなくなりました", "Yên tâm = hết lo lắng."),
    ("売りきれました", "売りきれました = ぜんぶ 売れました", "Bán hết sạch tem kỷ niệm."),
    ("ひさしぶり", "ひさしぶり = ずいぶんまえ", "Lâu rồi mới gặp."),
    ("欠席", "欠席 = 休みます", "Vắng mặt = nghỉ."),
    ("なるべく", "なるべく = できるだけ", "Cố gắng hết sức có thể hãy đến."),
    ("かまいません", "明日でも かまいません = 明日でも 今日でも いいです", "Ngày mai cũng không sao = hôm nay hay ngày mai đều được."),
    ("ニュースを つたえる", "ニュースを つたえる = ほうそうの仕事", "Truyền tải tin tức = công việc phát thanh/truyền hình."),
    ("ぬがないで はいってはいけません", "ぬがないで はいってはいけません = ぬいでから 入ってください", "Không được để nguyên giày mà vào."),
    ("そろそろ、しつれいします", "そろそろ、しつれいします = これから、帰ります", "Xin phép về."),
    ("とりかえてください", "とりかえてください = ちがうのを ください", "Hãy đổi cái khác / cho cái thìa khác."),
    ("たまに", "たまに = そんなに～ません", "Thỉnh thoảng = không thường xuyên lắm."),
    ("ネクタイを しています", "ネクタイを しています = ネクタイを しめて います", "Đeo cà vạt dùng する/締める, không dùng 着る."),
    ("いやがります", "いやがります = きらいです", "Tỏ ra ghét = không thích."),
    ("～ない ことに しました", "～ない ことに しました = ～ないと きめました", "Tự quyết định bỏ thuốc."),
    ("のどが かわいています", "のどが かわいています = 何か飲みたいです", "Đang khát = muốn uống gì đó."),
    ("せんぱい", "せんぱい = 私が 入学する まえに おなじ 大学に 入学しました", "Tiền bối nhập học cùng trường trước tôi."),
    ("よく いらっしゃいました", "「よく いらっしゃいました」 = 私を たずねてきました", "Chào mừng khách đến chơi nhà."),
    ("ねっしん", "ねっしん = いっしょうけんめい します", "Nhiệt huyết, làm việc hết mình."),
    ("かけて ください", "いすに かけて ください = いすに すわって ください", "Mời ngồi vào ghế."),
    ("春から 夏に なりました", "春から 夏に なりました = きせつが かわりました", "Mùa thay đổi từ xuân sang hạ."),
    ("ひえる", "ひえる = さむく なる", "Trời lạnh đi."),
    ("日が くれる", "日が くれる = 暗く なる", "Mặt trời lặn / trời tối."),
    ("持ったまま 死にました", "ペンを 持ったまま 死にました = 死ぬ 時まで 書いて いました", "Qua đời khi vẫn cầm bút = viết đến lúc chết."),
    ("近ければ 行くんですが", "もう 少し 近ければ 行くんですが = ざんねんですが、とおいので 行けません", "Nếu gần hơn thì đã đi, tiếc là xa nên không đi được."),
    ("ないのではないでしょうか", "～ないのではないでしょうか = ～ないでしょう", "Chẳng phải là sẽ không... sao? = có lẽ sẽ không."),
    ("めずらしい", "休むのは めずらしい = ほとんど 休みません", "Hiếm khi nghỉ = hầu như không nghỉ."),
    ("先生は母です", "私の先生は母です = 私は母に習っています", "Giáo viên tiếng Nhật của tôi là mẹ."),
    ("注意して", "注意して = きを つけて", "Chú ý = cẩn thận."),
    ("すばらしい", "作文は すばらしい = 作文が 上手です", "Bài văn tuyệt vời = viết văn giỏi."),
    ("えいようのバランス", "えいようのバランス考えて = 体にいい 料理", "Cân bằng dinh dưỡng = món ăn tốt cho cơ thể."),
    ("くれました", "友だちが くれました = 私は 友だちに もらいました", "Bạn cho tôi = tôi nhận từ bạn."),
    ("おいでに なりました", "おいでに なりました = いらっしゃいました", "Tôn kính ngữ của đi/đến."),
    ("たいてい いえに います", "たいてい いえに います = あまり 出かけません", "Chủ nhật thường ở nhà = ít khi ra ngoài."),
    ("2時間 かかります", "会社まで 2時間 かかります = 8時に 家を 出て、10時に 会社に 着きます", "Mất 2 tiếng đến công ty."),
]


def parse_letter_explanations(block: str, count: int) -> list[tuple[str, str]]:
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    rows = []
    for ln in lines:
        m = re.match(r"([A-D])\.\s*(.+)", ln)
        if m:
            rest = m.group(2)
            if " (" in rest:
                take, expl = rest.split(" (", 1)
                expl = expl.rstrip(")")
            else:
                take, expl = rest, rest
            rows.append((m.group(1), take.strip() + " — " + expl.strip()))
    if len(rows) != count:
        print(f"  letter explanations got {len(rows)} expected {count}")
    return rows


def parse_mondai_table(block: str) -> dict[int, tuple[str, str]]:
    out = {}
    for m in re.finditer(r"問(\d+):\s*([A-D])(?:/([A-D]))?\s*(?:\((.*?)\))?", block):
        n = int(m.group(1))
        ans = m.group(2)
        expl = (m.group(4) or "").strip()
        out[n] = (ans, expl)
    return out


def attach(items, section, prefix, answers: dict, extras):
    out = []
    for q in items:
        n = q["questionNumber"]
        ans = answers[n]
        extra = extras.get(n, ("", ""))
        if isinstance(extra, tuple) and len(extra) >= 3:
            key, expl = extra[1], extra[2]
        elif isinstance(extra, tuple) and len(extra) == 2:
            key, expl = extra
        else:
            key, expl = extra, extra
        if n == 19 and section == "renshuu2" and q["options"].get("A") in {"[?]", "?"}:
            q["options"]["A"] = "しゅくだい"
        obj = {
            "id": f"{prefix}_q{n}",
            "section": section,
            "questionNumber": n,
            "questionText": q["questionText"],
            "highlightWord": key,
            "options": q["options"],
            "correctAnswer": ans,
            "keyTakeaway": key,
            "explanation": expl or key,
        }
        out.append(obj)
    return out


def extract_images():
    PUBLIC_IMG.mkdir(parents=True, exist_ok=True)
    z = zipfile.ZipFile(ROOT / "decuong.docx")
    mapping = {
        "word/media/image1.png": "cover-front.png",
        "word/media/image2.png": "cover-emil.png",
        "word/media/image3.jpg": "choukai-m1-03.jpg",
        "word/media/image4.jpg": "choukai-m1-06.jpg",
        "word/media/image5.jpg": "choukai-m1-07.jpg",
        "word/media/image6.jpeg": "choukai-m1-08.jpg",
        "word/media/image7.jpg": "choukai-m1-13.jpg",
        "word/media/image8.jpg": "choukai-m1-14.jpg",
        "word/media/image9.jpg": "choukai-m1-15.jpg",
        "word/media/image10.jpg": "choukai-m1-16.jpg",
        "word/media/image11.jpg": "choukai-m1-18.jpg",
        "word/media/image12.jpg": "choukai-m1-19.jpg",
        "word/media/image13.png": "cover-back.png",
    }
    for src, dest in mapping.items():
        (PUBLIC_IMG / dest).write_bytes(z.read(src))
    print("extracted", len(mapping), "images")


def build_choukai():
    m1_opts = {
        1: {"1": "しょうぼうしょに けんがく（見学）に 行く", "2": "しつもん（質問）を 5つ 考える", "3": "さくぶん（作文）を 書く", "4": "しつもん（質問）を 3つ 考える"},
        2: {"1": "せんぱいから きょうかしょを もらう", "2": "きょうかしょを 1さつ 買う", "3": "きょうかしょを 3さつ 買う", "4": "ノートを 1さつ 買う"},
        4: {"1": "かいぎに 出る", "2": "かいぎのじゅんびを てつだう", "3": "こうじょう（工場）に にもつを とどける", "4": "おきゃくさんに メールを する"},
        5: {"1": "トマト・キャベツ・パン", "2": "キャベツ・バター", "3": "トマト・パン・バター", "4": "トマト・キャベツ・パン・バター"},
        9: {"1": "かんじが まちがっているところを なおす", "2": "りゆうを 少なくして 書きなおす", "3": "りゆうを 多くして 書きなおす", "4": "だいがくに しぼうりゆうしょを 出す"},
        10: {"1": "重いものを 持つ", "2": "あつい ふろに 入る", "3": "ふろに 入る前に ねつを はかる", "4": "ふろに入ったあとに くすりを ぬる"},
        11: {"1": "おべんとう", "2": "おかし", "3": "飲み物", "4": "ざっし"},
        12: {"1": "木曜日までに、先生に 出す", "2": "木曜日までに、学校のじむの人に出す", "3": "金曜日までに、先生に 出す", "4": "金曜日までに、学校のじむの人に出す"},
        17: {"1": "2人分", "2": "3人分", "3": "6人分", "4": "8人分"},
    }
    m1_images = {
        3: "/images/choukai-m1-03.jpg",
        6: "/images/choukai-m1-06.jpg",
        7: "/images/choukai-m1-07.jpg",
        8: "/images/choukai-m1-08.jpg",
        13: "/images/choukai-m1-13.jpg",
        14: "/images/choukai-m1-14.jpg",
        15: "/images/choukai-m1-15.jpg",
        16: "/images/choukai-m1-16.jpg",
        18: "/images/choukai-m1-18.jpg",
        19: "/images/choukai-m1-19.jpg",
    }
    mondai1 = []
    for n in range(1, 20):
        item = {
            "id": f"ck1_{n}",
            "section": "choukai1",
            "questionNumber": n,
            "prompt": "問題1：聞いて、一番いいものを一つ選んでください。",
            "options": m1_opts.get(n, {"1": "A", "2": "B", "3": "C", "4": "D"} if n == 6 else {"1": "A・B", "2": "A・D", "3": "B・C", "4": "B・D"} if n == 14 else {}),
            "image": m1_images.get(n),
            "note": "Đề gốc không in đáp án cho 問題1. Nghe băng (nếu có) rồi chọn; có thể gắn file audio ở máy bạn.",
        }
        mondai1.append(item)

    m2 = [
        (1, {"1": "みんなが 読んでいる本だから", "2": "すきな しょうせつが 書いた本だから", "3": "本の表の 写真がかわいいから", "4": "ねこについて 書いてある 本だから"}),
        (2, {"1": "部長に うそをつかれたから", "2": "部長が 女の人の 話を 聞かないから", "3": "ほかの 会社に 仕事を とられたから", "4": "部長が 話すことばが 聞き取れないから"}),
        (3, {"1": "ねつが あるから", "2": "寒くてかぜをひきそうだから", "3": "お金がないから", "4": "しゅくだいをするから"}),
        (4, {"1": "光を あてすぎないこと", "2": "土がかわかないように すること", "3": "水をやりすぎない こと", "4": "根を 水の中に 入れること"}),
        (5, {"1": "カレーがおいしくないから", "2": "朝ごはんも カレーを食べたから", "3": "食べすぎると 太るから", "4": "おなかが いっぱいで ズボンがきついから"}),
        (6, {"1": "土曜日の 3時", "2": "土曜日の 2時～4時", "3": "日曜日の 3時半", "4": "日曜日の 2時～4時"}),
        (7, {"1": "きれいな 本ができたこと", "2": "ゆっくりができること", "3": "本がたくさん 売れること", "4": "早く帰ることが できること"}),
        (8, {"1": "ガールフレンドが できたから", "2": "英会話を 習っているから", "3": "歌を習っているから", "4": "健康になったから"}),
        (9, {"1": "はれるが、夜は 寒い", "2": "はれて、夜は あたたかい", "3": "強い 雨が ふって、夜は さむい", "4": "かみなりが なるが、夜は あたたかい"}),
        (10, {"1": "電車が 遅れていたから", "2": "道に まよったから", "3": "家を 出るのが 遅くなったから", "4": "電車に 乗りおくれたから"}),
    ]
    mondai2 = [
        {
            "id": f"ck2_{n}",
            "section": "choukai2",
            "questionNumber": n,
            "prompt": "問題2：話を聞いて、一番いいものを一つ選んでください。",
            "options": opts,
            "note": "Đề gốc không in đáp án cho 問題2.",
        }
        for n, opts in m2
    ]

    mondai3 = []
    groups = [
        ("すぐ返事をする ① (基本問題)", 3),
        ("すぐ返事をする ② (基本問題)", 3),
        ("すぐ返事をする ① (応用問題)", 3),
        ("すぐ返事をする ② (応用問題)", 3),
    ]
    idx = 1
    for title, count in groups:
        for n in range(1, count + 1):
            mondai3.append({
                "id": f"ck3_{idx}",
                "section": "choukai3",
                "group": title,
                "questionNumber": idx,
                "localNumber": n,
                "prompt": f"{title} — {n}ばん：文を聞いて、返事を1・2・3から選ぶ。",
                "options": {"1": "1", "2": "2", "3": "3"},
                "note": "Phần phản xạ nghe không in chữ trên đề; luyện với băng.",
            })
            idx += 1

    mondai4 = [
        {
            "id": "ck4_1",
            "questionNumber": 1,
            "situation": "Mượn vở bạn để chép",
            "options": {
                "1": "ノート、写してくれない？",
                "2": "ノート、写させてもいい？",
                "3": "ノート、写させてもらえる？",
            },
            "correctAnswer": "3",
            "keyTakeaway": "写させてもらえる？",
            "explanation": "Xin phép được chép vở của bạn: Vさせてもらえる？",
        },
        {
            "id": "ck4_2",
            "questionNumber": 2,
            "situation": "Hỏi mượn từ điển bạn bè",
            "options": {
                "1": "辞書、持とうか。",
                "2": "辞書、忘れてるよ。",
                "3": "辞書、持ってない？",
            },
            "correctAnswer": "3",
            "keyTakeaway": "辞書、持ってない？",
            "explanation": "Hỏi bạn có mang từ điển không.",
        },
        {
            "id": "ck4_3",
            "questionNumber": 3,
            "situation": "Xin mặc thử đồ ở cửa hàng",
            "options": {
                "1": "ちょっと着させてみましょうか。",
                "2": "ちょっと着せてもらいませんか。",
                "3": "ちょっと着てみてもいいですか。",
            },
            "correctAnswer": "3",
            "keyTakeaway": "着てみてもいいですか",
            "explanation": "Xin phép mặc thử: Vてみてもいいですか。",
        },
        {
            "id": "ck4_4",
            "questionNumber": 4,
            "situation": "Mời người trên/khách ngồi ghế (tôn kính ngữ)",
            "options": {
                "1": "ここ、おかけになりませんか。",
                "2": "ここ、おかけしましょうか。",
                "3": "ここ、おかけしたらどうですか。",
            },
            "correctAnswer": "1",
            "keyTakeaway": "おかけになりませんか",
            "explanation": "Tôn kính ngữ mời ngồi: おかけになる。",
        },
    ]

    mondai5 = [
        {"id": "ck5_1", "n": 1, "options": {"1": "え、いいの？ありがとう。", "2": "今日はあんまりお金がないんだけど", "3": "いいよ。遠慮しないで食べて"}, "correctAnswer": "1", "explanation": "Khi được mời/cho phép: え、いいの？ありがとう。 (Một số băng đáp 3 nếu ngữ cảnh mời người khác ăn.)"},
        {"id": "ck5_2", "n": 2, "options": {"1": "じゃ、大きくしないの？", "2": "そう？読みにくいかな", "3": "うん、小さくしてないよ。"}, "correctAnswer": "2", "explanation": "そう？読みにくいかな — phản hồi khi bị nói chữ khó đọc."},
        {"id": "ck5_3", "n": 3, "options": {"1": "うん、明日借りてくるよ。", "2": "うん、佐藤さんにもらうんだね。", "3": "うん、来週会ったときでいい？"}, "correctAnswer": "3", "explanation": "うん、来週会ったときでいい？"},
        {"id": "ck5_4", "n": 4, "options": {"1": "どうぞ召し上がってください。", "2": "ご遠慮なくご覧ください。", "3": "ええ、おいでください。"}, "correctAnswer": "1", "explanation": "Khi khách nói いただきます: どうぞ召し上がってください。"},
        {"id": "ck5_5", "n": 5, "options": {"1": "もう少し待ってもらえますか。", "2": "え？もうできないんですか。", "3": "もうできないんじゃないかな。"}, "correctAnswer": "1", "explanation": "Nhờ đợi thêm một chút."},
        {"id": "ck5_6", "n": 6, "options": {"1": "はい、拝見します", "2": "先日、お目にかかりました。", "3": "いえ、おりませんが。"}, "correctAnswer": "1", "explanation": "拝見します: khiêm nhường ngữ khi nhận xem tài liệu. Nếu hỏi tìm người trong công ty thì đáp 3: いえ、おりませんが。"},
        {"id": "ck5_7", "n": 7, "options": {"1": "はい、申し訳ありません。", "2": "本当にお世話になりました。", "3": "どうぞ、お気をつけて"}, "correctAnswer": "1", "explanation": "Xin lỗi trang trọng, hoặc 本当にお世話になりました tùy băng."},
        {"id": "ck5_8", "n": 8, "options": {"1": "行かなくてもいいよね。", "2": "行きたかったんだけど…。", "3": "わたしも行けてよかったな。"}, "correctAnswer": "2", "explanation": "Tiếc là muốn đi nhưng không đi được."},
    ]
    return {
        "mondai1": mondai1,
        "mondai2": mondai2,
        "mondai3": mondai3,
        "mondai4": mondai4,
        "mondai5": mondai5,
    }


def build_dokkai():
    passages = [
        {
            "id": "dk1",
            "number": 1,
            "title": "学長の話",
            "titleVi": "Chuyện của hiệu trưởng đại học",
            "passage": "みなさんのクラスは授業中静かですか。これはある大学の学長の話です。\n「私は授業中おしゃべりをする学生が多くて、ほんとうにこまっています。とてもうるさくて、うしろの席の学生なんか、私の話がほとんど聞き取れないんじゃないかと思う。そのため、まじめな学生や留学生がすごくめいわくしています。私は大きな声でおしゃべりしている学生がいると、授業をとちゅうでやめて、その学生をじっと見ることにしています。そうすると、少しはこうかがあるようです。ですから、先生方もどうぞ、そのような学生たちには強く注意なさってください。そして、それでもどうしてもおしゃべりをやめない学生には、勉強したくないなら、授業に出席する必要はないと言ってやってください。」",
            "questions": [
                {"id": "dk1_q1", "questionNumber": 1, "questionText": "学長はだれに話していますか。", "options": {"A": "大学の 先生方に 話しています。", "B": "学生たち 全員に 話しています。", "C": "おしゃべりをやめない学生に 話しています。", "D": "まじめな 学生や 留学生に 話しています。"}, "correctAnswer": "A", "explanation": "「先生方もどうぞ」— nói với các thầy cô trong trường."},
                {"id": "dk1_q2", "questionNumber": 2, "questionText": "学長は授業中大きな声でおしゃべりしている学生に対してどうしますか。", "options": {"A": "授業をとちゅうでやめて、大きな声で注意します。", "B": "授業をとちゅうでやめて、おしゃべりしている学生を部屋の外へ出します。", "C": "授業をとちゅうでやめて、部屋から出ています。", "D": "授業をとちゅうでやめて、おしゃべりしている学生をじっと見ます。"}, "correctAnswer": "D", "explanation": "授業をとちゅうでやめて、その学生をじっと見る。"},
                {"id": "dk1_q3", "questionNumber": 3, "questionText": "おしゃべりをする学生が多いと、特にどんな人たちがめいわくしますか。", "options": {"A": "留学生が みんな めいわくします。", "B": "うしろの席の学生が めいわくします。", "C": "まじめな学生や留学生が めいわくします。", "D": "おしゃべりをする学生が めいわくします。"}, "correctAnswer": "C", "explanation": "まじめな学生や留学生がすごくめいわくしています。"},
                {"id": "dk1_q4", "questionNumber": 4, "questionText": "おしゃべりをやめない学生に対して何と言ってくださいと言いましたか。", "options": {"A": "「小さな声なら かまわないと 言ってください。」", "B": "「おしゃべりしても 大丈夫だと 言ってください。」", "C": "「となりの 人を じっと見なさいと 言ってください。」", "D": "「勉強したくないなら、授業に出席する必要はないと言ってください。」"}, "correctAnswer": "D", "explanation": "勉強したくないなら、授業に出席する必要はない。"},
            ],
        },
        {
            "id": "dk2",
            "number": 2,
            "title": "ニャチャンのホテル",
            "titleVi": "Yamada và Yan đặt khách sạn đi Nha Trang",
            "passage": "山田「来週の水曜日から（　1　）やすみですね。」\nヤン「そうですね。ぜんぶで（　2　）。」\n山田「五日休みが ありますよ。どこかへ 行きませんか。」\nヤン「いいですね。（　3　）。」\n山田「ニャチャンはどうですか。しずかでいいホテルを知っているんです。」\nヤン「そうですか。そのホテルは（　4　）。」\n山田「ええ、した方がいいと思います。私が 予約しましょうか。」\nヤン「じゃ、おねがいします。」",
            "blanks": [1, 2, 3, 4],
            "questions": [
                {"id": "dk2_q1", "blank": 1, "questionNumber": 1, "questionText": "（　1　）に何を入れますか。", "options": {"A": "まもなく", "B": "しばらく", "C": "おかげさまで", "D": "ひさしぶり"}, "correctAnswer": "B", "explanation": "しばらく — nghỉ một khoảng thời gian."},
                {"id": "dk2_q2", "blank": 2, "questionNumber": 2, "questionText": "（　2　）に何を入れますか。", "options": {"A": "5日の日は休みですか", "B": "5日から休みです", "C": "何日が休みですか", "D": "何日 休みですか"}, "correctAnswer": "D", "explanation": "何日休みですか — được nghỉ mấy ngày?"},
                {"id": "dk2_q3", "blank": 3, "questionNumber": 3, "questionText": "（　3　）に何を入れますか。", "options": {"A": "どこかへ行ったらどうですか", "B": "どんな所にありますか", "C": "どんな所がいいですか", "D": "どこかへ行きませんか"}, "correctAnswer": "C", "explanation": "どんな所がいいですか。"},
                {"id": "dk2_q4", "blank": 4, "questionNumber": 4, "questionText": "（　4　）に何を入れますか。", "options": {"A": "予約しなければなりませんか", "B": "予約してはいけませんか", "C": "予約してもいけませんか", "D": "予約してもいいですか"}, "correctAnswer": "A", "explanation": "予約しなければなりませんか — có phải đặt trước không?"},
                {"id": "dk2_q5", "questionNumber": 5, "questionText": "だれがホテルの予約をしますか。", "options": {"A": "私", "B": "ヤンさん", "C": "山田さん", "D": "ヤンさんと山田さん"}, "correctAnswer": "C", "explanation": "山田「私が 予約しましょうか。」"},
            ],
        },
        {
            "id": "dk3",
            "number": 3,
            "title": "かばんをなくした",
            "titleVi": "Yamada và Nakamura — mất cặp sách trên tàu",
            "passage": "山田「どうしたんですか。元気が ないですね。」\n中村「かばんを（　1　）です。」\n山田「それは たいへんだ。どこで なくしたか わかりますか。」\n中村「よく わからないんですが、電車の 中に わすれたらしいんです。」\n山田「駅へ 行って、聞いて みましたか。」\n中村「（　2　）。でも、見つかりませんでした。」\n山田「お金や 大事な ものが 入って いたんですか。」\n中村「お金は ほとんど 入って いません。でも、先生に（　3　）大事な 本が 入って いたんです。とても 大切な 本なんです。」\n山田「そうですか。お金が たくさん入って いたら、もどって こないかもしれませんが、本だから たぶん、だいじょうぶですよ。」\n中村「そうでしょうか。」\n山田「見つけた 人にも、本が 大切なことは わかりますからね。きっと 見つけた人が とどけて くれますよ。」",
            "blanks": [1, 2, 3],
            "questions": [
                {"id": "dk3_q1", "blank": 1, "questionNumber": 1, "questionText": "（　1　）に何を入れますか。", "options": {"A": "なくなったん", "B": "なくなってしまったん", "C": "なくしたん", "D": "なくしてしまったん"}, "correctAnswer": "D", "explanation": "なくしてしまったん — lỡ làm mất."},
                {"id": "dk3_q2", "blank": 2, "questionNumber": 2, "questionText": "（　2　）に何を入れますか。", "options": {"A": "やっぱりです", "B": "もちろんです", "C": "もうすぐです", "D": "まだです"}, "correctAnswer": "B", "explanation": "もちろんです — đã hỏi nhà ga rồi."},
                {"id": "dk3_q3", "blank": 3, "questionNumber": 3, "questionText": "（　3　）に何を入れますか。", "options": {"A": "お借りになった", "B": "お貸しになった", "C": "お借りした", "D": "お貸しした"}, "correctAnswer": "C", "explanation": "お借りした — khiêm nhường ngữ: cuốn sách tôi mượn của thầy."},
                {"id": "dk3_q4", "questionNumber": 4, "questionText": "だれがだれに本を貸しましたか。", "options": {"A": "先生が山田さんに本を貸しました", "B": "先生が中村さんに本を貸しました", "C": "山田さんが中村さんに本を貸しました", "D": "中村さんが先生に本を貸しました"}, "correctAnswer": "B", "explanation": "Thầy giáo cho Nakamura mượn sách."},
                {"id": "dk3_q5", "questionNumber": 5, "questionText": "お金はかばんに入っていますか。", "options": {"A": "はい、たくさん入っています。", "B": "いいえ、ほとんど入っていません。", "C": "いいえ、ぜんぜん入っていません。", "D": "はい、ちょっと入っています。"}, "correctAnswer": "B", "explanation": "お金はほとんど入っていません。"},
            ],
        },
        {
            "id": "dk4",
            "number": 4,
            "title": "ポチ",
            "titleVi": "Hayashi Akira viết về chú chó Pochi",
            "passage": "林 明\nわたしの 家には 「ポチ」と いう 名前の 犬が います。一か月前に 父が もらって きました。わたしたちは ポチを 家の中で かって います。ポチが 好きな ところは テレビの 前の ソファーです。ポチは とても かわいいのですが、何でもかむので少しこまっています。先週は 本当に こまりました。ポチが 父の けいたいでんわを（　1　）からです。\nわたしは 兄弟が いないので、ずっと さびしかったです。しかし、ポチを かってからは、（　2　）。わたしたちは いつも いっしょです。ポチは わたしが 家を 出る とき、いつも げんかんまで 出て きます。（　3　）、元気が ない ときは、そばに 来て くれます。ポチは わたしたちの 大切な 家族の 一員です。",
            "blanks": [1, 2, 3],
            "questions": [
                {"id": "dk4_q1", "blank": 1, "questionNumber": 1, "questionText": "（　1　）に何を入れますか。", "options": {"A": "こわされた", "B": "こわして しまった", "C": "こわされて", "D": "こわした ところだ"}, "correctAnswer": "B", "explanation": "こわしてしまった — lỡ cắn hỏng điện thoại của bố."},
                {"id": "dk4_q2", "blank": 2, "questionNumber": 2, "questionText": "（　2　）に何を入れますか。", "options": {"A": "さびしく なくなったそうです", "B": "さびしく なるかもしれません", "C": "さびしく なくなりました", "D": "さびしく なります"}, "correctAnswer": "C", "explanation": "さびしくなくなりました — hết cô đơn."},
                {"id": "dk4_q3", "blank": 3, "questionNumber": 3, "questionText": "（　3　）に何を入れますか。", "options": {"A": "それからだ", "B": "だから", "C": "とえば", "D": "それに"}, "correctAnswer": "D", "explanation": "それに — hơn nữa, khi buồn còn đến bên cạnh."},
                {"id": "dk4_q4", "questionNumber": 4, "questionText": "この人は兄弟が何人いますか。", "options": {"A": "3人", "B": "2人", "C": "1人", "D": "0人"}, "correctAnswer": "D", "explanation": "兄弟がいない。"},
                {"id": "dk4_q5", "questionNumber": 5, "questionText": "ポチの好きなところはどこですか。", "options": {"A": "テレビ", "B": "ソファー", "C": "げんかん", "D": "にわ"}, "correctAnswer": "B", "explanation": "テレビの前のソファー。"},
            ],
        },
        {
            "id": "dk5",
            "number": 5,
            "title": "近所の小さい店",
            "titleVi": "Cửa hàng nhỏ gần nhà",
            "passage": "好きな ペンが 書けなく なった。［ 1 ］、ペンを 買いに 出かけた。［ 2 ］なら 家から 歩いて 15分ぐらいの 大きい スーパーに 行くのだが、近所に ある 小さい 店に 行って みた。もしかしたら、わたしの ほしい ペンは ［ 3 ］と思ったが、1本だけ あった。しかし、そのペンは 少し よごれていた。店［ 4 ］おばあさんが 一人で はたらいていた。おばあさんに「これを ください」［ 5 ］、ペンを わたした。すると、おばあさんは「よごれて いますね。 このペンでもいいですか。」と 聞いた。わたしが「いいですよ。」と 答えると、ペンを きれいに ふいてくれた。お金を はらったら、とても いい 気分に なった。",
            "blanks": [1, 2, 3, 4, 5],
            "questions": [
                {"id": "dk5_q1", "blank": 1, "questionNumber": 1, "questionText": "［ 1 ］に何を入れますか。", "options": {"A": "それで", "B": "ただし", "C": "すると", "D": "けれど"}, "correctAnswer": "A", "explanation": "それで — vì bút hết mực nên đi mua."},
                {"id": "dk5_q2", "blank": 2, "questionNumber": 2, "questionText": "［ 2 ］に何を入れますか。", "options": {"A": "いつもだ", "B": "いつもと", "C": "いつもに", "D": "いつも"}, "correctAnswer": "D", "explanation": "いつもなら — nếu như mọi khi."},
                {"id": "dk5_q3", "blank": 3, "questionNumber": 3, "questionText": "［ 3 ］に何を入れますか。", "options": {"A": "あるかもしれない", "B": "ないかもしれない", "C": "あるはずがない", "D": "ないはずがない"}, "correctAnswer": "B", "explanation": "ないかもしれない — có lẽ không có."},
                {"id": "dk5_q4", "blank": 4, "questionNumber": 4, "questionText": "［ 4 ］に何を入れますか。", "options": {"A": "にも", "B": "を", "C": "では", "D": "へ"}, "correctAnswer": "C", "explanation": "店では — ở tại cửa hàng."},
                {"id": "dk5_q5", "blank": 5, "questionNumber": 5, "questionText": "［ 5 ］に何を入れますか。", "options": {"A": "を答えて", "B": "を言って", "C": "と答えた", "D": "と言って"}, "correctAnswer": "D", "explanation": "と言って — nói rằng rồi đưa cây bút."},
            ],
        },
        {
            "id": "dk6",
            "number": 6,
            "title": "アリさんの手紙",
            "titleVi": "Thư của Ari gửi Tanaka về việc chuyển nhà",
            "passage": "田中さん、お元気ですか。わたしは 先週、大学の 近くにひっこしを しました。前は アパートから 大学まで 電車と バスで 1時間半ぐらい かかりました。でも、今の アパート（　1　）大学まで 歩いて 10分ぐらいです。それで、ここにひっこす ことに しました。少し せまいですが、新しくてきれいだし、近所に スーパーも あります。駅からも 近くて、生活が とても（　2　）。それに、アパートの へやの まどから 見える けしきも いいです。だから、ひっこしを して 本当に よかった と（　3　）。この 手紙と いっしょに、わたしの へやの まどから 見た けしきの 写真を 送ります。それでは、また。",
            "blanks": [1, 2, 3],
            "questions": [
                {"id": "dk6_q1", "blank": 1, "questionNumber": 1, "questionText": "（　1　）に何を入れますか。", "options": {"A": "は", "B": "や", "C": "が", "D": "も"}, "correctAnswer": "A", "explanation": "今のアパートは大学まで…"},
                {"id": "dk6_q2", "blank": 2, "questionNumber": 2, "questionText": "（　2　）に何を入れますか。", "options": {"A": "便利でしょうか", "B": "便利だったからです", "C": "便利だったそうです", "D": "便利になりました"}, "correctAnswer": "D", "explanation": "生活がとても便利になりました。"},
                {"id": "dk6_q3", "blank": 3, "questionNumber": 3, "questionText": "（　3　）に何を入れますか。", "options": {"A": "思っていました", "B": "思ったようです", "C": "思っています", "D": "思うようです"}, "correctAnswer": "C", "explanation": "よかったと思っています。"},
                {"id": "dk6_q4", "questionNumber": 4, "questionText": "アリさんのアパートの部屋の窓から何が見えますか。", "options": {"A": "いい景色", "B": "山", "C": "川", "D": "海"}, "correctAnswer": "A", "explanation": "まどから見えるけしきもいいです。"},
                {"id": "dk6_q5", "questionNumber": 5, "questionText": "今のアパートから大学までどのぐらいかかりますか。", "options": {"A": "１時間半", "B": "１時間", "C": "１時間４０分", "D": "１０分"}, "correctAnswer": "D", "explanation": "歩いて10分ぐらい。"},
            ],
        },
        {
            "id": "dk7",
            "number": 7,
            "title": "わたしの好きな場所",
            "titleVi": "Phòng trà trong công viên",
            "passage": "わたしの 好きな 場所は 公園の 中に ある 茶室です。\n茶室の ある たてものは、たくさんの 木の 中に あって とても 静かです。毎月１回 そこで お茶会が あります。わたしは まだ ［ 1 ］。いつも 閉まっていますが、日曜日の 午後だけ 開いて います。わたしは よく さんぽに 行って そこで 休みます。［ 2 ］ 公園の 木 や 花を ゆっくり 見ます。小さくて 古い たてものですが、わたしは とても ［ 3 ］。",
            "blanks": [1, 2, 3],
            "questions": [
                {"id": "dk7_q1", "blank": 1, "questionNumber": 1, "questionText": "［ 1 ］に何を入れますか。", "options": {"A": "行かないです", "B": "行きませんでした", "C": "行きません", "D": "行ったことがありません"}, "correctAnswer": "D", "explanation": "まだ行ったことがありません — chưa từng đi dự tiệc trà."},
                {"id": "dk7_q2", "blank": 2, "questionNumber": 2, "questionText": "［ 2 ］に何を入れますか。", "options": {"A": "そこへ", "B": "そこから", "C": "そこに", "D": "そこを"}, "correctAnswer": "B", "explanation": "そこから公園の木や花を見ます。"},
                {"id": "dk7_q3", "blank": 3, "questionNumber": 3, "questionText": "［ 3 ］に何を入れますか。", "options": {"A": "好きではありませんでした", "B": "好きでした", "C": "好きではありません", "D": "好きです"}, "correctAnswer": "D", "explanation": "小さくて古いですが、とても好きです。"},
                {"id": "dk7_q4", "questionNumber": 4, "questionText": "アリさんは茶室で何をしますか。", "options": {"A": "散歩に行きます", "B": "休みます", "C": "お茶会に出ます", "D": "お茶を飲みます"}, "correctAnswer": "B", "explanation": "さんぽに行ってそこで休みます。"},
                {"id": "dk7_q5", "questionNumber": 5, "questionText": "毎年何回お茶会がありますか。", "options": {"A": "1", "B": "3", "C": "6", "D": "12"}, "correctAnswer": "D", "explanation": "毎月1回 = 1 năm 12 lần."},
            ],
        },
        {
            "id": "dk8",
            "number": 8,
            "title": "銀行の機械",
            "titleVi": "Hướng dẫn rút tiền ATM",
            "passage": "女の人：「すみません、この カード、 使えますか。」\n銀行の人：「はい、ここに カードを 入れて ください。つぎに あんしょう番号を 押して ください。」\n女の人：「あんしょう番号?」\n銀行の人：「ええ、カードを 作る とき 自分で ［ 1 ］ 番号です。［ 2 ］。」\n女の人：「はい、わかります。」\n銀行の人：「さいごに 数字と“円”を ［ 3 ］、お金を 出すことが できます。」\n女の人：「そうですか。ありがとうございました。」",
            "blanks": [1, 2, 3],
            "questions": [
                {"id": "dk8_q1", "blank": 1, "questionNumber": 1, "questionText": "［ 1 ］に何を入れますか。", "options": {"A": "決めて", "B": "決めます", "C": "決めた", "D": "決める"}, "correctAnswer": "C", "explanation": "自分で決めた番号です。"},
                {"id": "dk8_q2", "blank": 2, "questionNumber": 2, "questionText": "［ 2 ］に何を入れますか。", "options": {"A": "おぼえるか", "B": "おぼえましたか", "C": "おぼえていますか", "D": "おぼえますか"}, "correctAnswer": "C", "explanation": "おぼえていますか。"},
                {"id": "dk8_q3", "blank": 3, "questionNumber": 3, "questionText": "［ 3 ］に何を入れますか。", "options": {"A": "おすとき", "B": "おしたとき", "C": "おさないと", "D": "おせば"}, "correctAnswer": "D", "explanation": "おせばお金を出すことができます。"},
                {"id": "dk8_q4", "questionNumber": 4, "questionText": "この二人は今どこですか。", "options": {"A": "銀行", "B": "病院", "C": "会社", "D": "店"}, "correctAnswer": "A", "explanation": "銀行で機械の使い方を聞いています。"},
                {"id": "dk8_q5", "questionNumber": 5, "questionText": "順番に押すのは何ですか。", "options": {"A": "暗証番号、「円」、数字", "B": "「円」、暗証番号、数字", "C": "数字、暗証番号、「円」", "D": "暗証番号、数字、「円」"}, "correctAnswer": "D", "explanation": "暗証番号 → 数字 → 「円」。"},
            ],
        },
        {
            "id": "dk9",
            "number": 9,
            "title": "日本語のあいさつ",
            "titleVi": "Smith viết về lời chào tiếng Nhật",
            "passage": "今日 田中先生の クラスで 日本語の あいさつに ついて 勉強しました。わたし［ 1 ］ 国や わたしが 知って いる 国の あいさつと とても ちがいます。\n例えば、「おはよう ございます」 は、「早いです」 という いみです。わたしは、「いい 朝ですね」と 言いたいです。「こんにちは」にも 「こんばんは」 にも いいという ［ 2 ］。\n先生は「日本では あいさつは、いみを つたえるより あいさつを する ことが ［ 3 ］。」と おっしゃいました。でも、てんきの いい 日には 「いい おてんきですね」と 言うそうです。こんど 「おはようございます」 の あとに 言って みようと 思います。",
            "blanks": [1, 2, 3],
            "questions": [
                {"id": "dk9_q1", "blank": 1, "questionNumber": 1, "questionText": "［ 1 ］に何を入れますか。", "options": {"A": "の", "B": "は", "C": "が", "D": "に"}, "correctAnswer": "A", "explanation": "わたしの国。"},
                {"id": "dk9_q2", "blank": 2, "questionNumber": 2, "questionText": "［ 2 ］に何を入れますか。", "options": {"A": "いみが ありそうです", "B": "いみが ありません", "C": "いみが あります", "D": "いみが あるかもしれません"}, "correctAnswer": "B", "explanation": "こんにちは／こんばんはに「いい」という意味がない。"},
                {"id": "dk9_q3", "blank": 3, "questionNumber": 3, "questionText": "［ 3 ］に何を入れますか。", "options": {"A": "大切そうです", "B": "大切でしょうか", "C": "大切ではありません", "D": "大切です"}, "correctAnswer": "D", "explanation": "あいさつをすることが大切です。"},
                {"id": "dk9_q4", "questionNumber": 4, "questionText": "だれがスミスさんに日本語のあいさつを教えましたか。", "options": {"A": "日本人の友達", "B": "同僚", "C": "田中先生", "D": "近所"}, "correctAnswer": "C", "explanation": "田中先生のクラスで勉強しました。"},
            ],
        },
        {
            "id": "dk10",
            "number": 10,
            "title": "病院へ行く",
            "titleVi": "Đau bụng đi bệnh viện cùng tiền bối Tanaka",
            "passage": "朝 すこし おなかが いたかったのですが、そのまま 会社へ 行きました。会社に 着いて 仕事を して いる うちに、だんだん おなかが いたく なって ［ 1 ］。会社の すぐ 近くに 病院が ありますが、一度も ［ 2 ］が ありませんでした。はじめて ［ 3 ］ しんぱいでした。先ぱいの 田中さんに そうだんしたら「いっしょに 行って あげるから 病院に 行ったほうが いいよ。」と 言って くれました。田中さんは とても 親切な 人です。病院で、お医者さんや かんごふさんの 話が むずかしい とき、わたしは 田中さんに いろいろ せつめいして もらいました。くすりを 飲んだら、だいぶ よく なりました。今度、もし 田中さんが こまっていたら、わたしが 田中さんの やくに 立ちたいと 思います。",
            "blanks": [1, 2, 3],
            "questions": [
                {"id": "dk10_q1", "blank": 1, "questionNumber": 1, "questionText": "［ 1 ］に何を入れますか。", "options": {"A": "みました", "B": "しました", "C": "きました", "D": "いました"}, "correctAnswer": "C", "explanation": "いたくなってきました。"},
                {"id": "dk10_q2", "blank": 2, "questionNumber": 2, "questionText": "［ 2 ］に何を入れますか。", "options": {"A": "行きかた", "B": "行きそう", "C": "行ったこと", "D": "行くはず"}, "correctAnswer": "C", "explanation": "一度も行ったことがありませんでした。"},
                {"id": "dk10_q3", "blank": 3, "questionNumber": 3, "questionText": "［ 3 ］に何を入れますか。", "options": {"A": "のような", "B": "のようで", "C": "なのに", "D": "なので"}, "correctAnswer": "D", "explanation": "はじめてなので心配でした。"},
                {"id": "dk10_q4", "questionNumber": 4, "questionText": "わたしはだれと病院へ行きましたか。", "options": {"A": "一人で", "B": "妻", "C": "友達", "D": "田中さん"}, "correctAnswer": "D", "explanation": "先輩の田中さんといっしょに。"},
                {"id": "dk10_q5", "questionNumber": 5, "questionText": "病院で何がむずかしいですか。", "options": {"A": "お医者さん", "B": "かんごふさん", "C": "田中さんの説明", "D": "病院の人の話"}, "correctAnswer": "D", "explanation": "お医者さんやかんごふさんの話がむずかしい。"},
            ],
        },
    ]
    return passages


def build_kaiwa_sakubun():
    kaiwa = [
        {
            "id": "kaiwa1",
            "title": "自己紹介",
            "titleVi": "Giới thiệu bản thân",
            "outline": ["Trình bày thông tin và sở thích cá nhân", "Nêu sở trường / sở đoản", "Giới thiệu những điều bản thân có thể làm"],
            "items": [
                {"q": "あなたの趣味はなんですか。", "a": "私の趣味は音楽を聞くことと映画を見ることです。", "alts": ["ゲームをすること", "スポーツをすること", "{{hobbies}}"]},
                {"q": "あなたの長所／短所はなんですか。", "a": "私の長所はまじめで、責任感（せきにんかん）が強いところです。短所は少し心配性（しんぱいしょう）なところです。"},
                {"q": "あなたの誕生日は何月何日ですか／いつですか。", "a": "私の誕生日は{{birthday}}です。"},
                {"q": "あなたは何が得意／苦手ですか。", "a": "料理を作ることが得意ですが、歌を歌うことが苦手です。"},
                {"q": "あなたは今、何をしていますか。", "a": "今、大学の4年生で、卒業するために一生懸命勉強しています。"},
                {"q": "あなたは何に興味がありますか。", "a": "日本の文化や日本のアニメに興味があります。"},
                {"q": "一番したいことは何ですか。", "a": "大学を卒業してから、日本へ旅行に行きたいです。"},
                {"q": "暇な時、よく何をしますか。", "a": "暇な時、よく友達とコーヒーを飲んだり、ゲームをしたりします。"},
                {"q": "今、だれと一緒に住んでいますか。", "a": "今、家族と一緒に住んでいます。（または：今、一人でアパートに住んでいます。）"},
            ],
        },
        {
            "id": "kaiwa2",
            "title": "私の家族",
            "titleVi": "Gia đình của tôi",
            "outline": ["Giới thiệu thành phần gia đình", "Công việc, tính cách, sở thích", "So sánh các thành viên"],
            "items": [
                {"q": "家族は何人いますか。", "a": "私の家族は{{familyMembers}}人です。父と母と兄（妹）と私です。"},
                {"q": "ご両親の仕事は何ですか。", "a": "父は会社員で、母は主婦（しゅふ）です。"},
                {"q": "ご両親は家にいる時、どんなことをしますか。", "a": "父はよくテレビでニュースを見ます。母は料理を作ったり、庭の花を育てたりします。"},
                {"q": "ご両親はどんな性格ですか。", "a": "父はまじめで静かな人です。母はとても明るくて親切な人です。"},
                {"q": "ご両親の趣味は何ですか。", "a": "父の趣味は読書で、母の趣味は料理です。"},
                {"q": "あなたの兄弟、姉妹は今、何歳ですか。", "a": "兄は私より3歳上です。"},
                {"q": "あなたの兄弟、姉妹は何をしていますか。", "a": "兄は会社員です。"},
                {"q": "あなたの兄弟、姉妹はどんな性格ですか。", "a": "兄は明るくて優しい人です。"},
                {"q": "家で料理が一番上手な人は誰ですか。", "a": "家で料理が一番上手な人は母です。"},
                {"q": "お父さんとお母さんはどちらが厳しいですか。", "a": "父のほうが厳しいです。"},
            ],
        },
        {
            "id": "kaiwa3",
            "title": "私の将来",
            "titleVi": "Tương lai của tôi",
            "outline": ["Ngành đang học", "Kế hoạch tương lai"],
            "items": [
                {"q": "専門はなんですか。", "a": "私の専門は{{major}}です。"},
                {"q": "今、何を勉強していますか。", "a": "今、専門の知識と日本語を勉強しています。"},
                {"q": "将来は何をするつもりですか。", "a": "卒業してから、日系企業（にっけいきぎょう）に入って働きたいです。"},
                {"q": "卒業してから、何をしたいですか。", "a": "卒業してから、日系企業に入って働きたいです。（大学院に入る人もいます。）"},
                {"q": "どんな会社で働きたいですか。どんな仕事をしたいですか。", "a": "ベトナムにある日本のIT会社でエンジニアとして働きたいです。"},
                {"q": "いつ結婚しようと思いますか。", "a": "28歳ごろ結婚しようと思います。"},
                {"q": "子供が何人欲しいですか。", "a": "子供が2人欲しいです。"},
                {"q": "日本で働きたいですか。どうしてですか。", "a": "はい、働きたいです。日本の会社は技術が進んでいますし、勉強した日本語が生かせるからです。"},
                {"q": "ベトナムでの日本の会社で働きたいですか。どうしてですか。", "a": "はい、働きたいです。日本の会社は技術が進んでいますし、給料もいいし、勉強した日本語が生かせるからです。"},
            ],
        },
        {
            "id": "kaiwa4",
            "title": "お誕生日",
            "titleVi": "Ngày sinh nhật",
            "grammar": ["Vて、Vて", "Vたり、Vたりする", "いAくなる／なA・Nになる", "Nをやる／あげる", "Nをもらう", "Nをくれる", "Nがほしい", "Vてやる／あげる、もらう／くれる（過去）"],
            "items": [
                {"q": "あなたの誕生日は何月何日ですか。", "a": "私の誕生日は{{birthday}}です。"},
                {"q": "誕生日パーティーをしたことがありますか。", "a": "はい、去年の誕生日に、家で誕生日パーティーをしました。"},
                {"q": "その誕生日で何歳になりましたか。", "a": "その誕生日で21歳になりました。"},
                {"q": "どこでパーティーをしましたか。", "a": "家でパーティーをしました。"},
                {"q": "友達が来ましたか。", "a": "大学の親しい友達が5人来てくれました。"},
                {"q": "どんなふくそうをしましたか。", "a": "きれいなシャツを着ました。"},
                {"q": "料理を作りましたか／どんな料理を作りましたか。", "a": "母と一緒にケーキやからあげ、サラダなど、いろいろな料理を作りました。"},
                {"q": "何を食べて、何を飲みましたか。", "a": "おいしい料理を食べたり、ジュースを飲んだりしました。"},
                {"q": "何をもらいましたか／あげましたか。", "a": "友達からすてきな時計とかわいいかばんをもらいました。"},
                {"q": "パーティーでどんなことをしましたか。", "a": "みんなで歌を歌ったり、ゲームをしたりしました。"},
                {"q": "写真をとりましたか。", "a": "記念の写真もたくさん撮りました。"},
                {"q": "そのパーティーはどうでしたか。", "a": "そのパーティーは本当ににぎやかで、忘れられない楽しい思い出になりました。"},
            ],
        },
    ]
    sakubun = [
        {
            "id": "sakubun1",
            "title": "私の一日",
            "titleVi": "Một ngày của tôi",
            "prompts": [
                {"q": "毎朝何時におきますか。", "hint": "毎日〜時に起きます"},
                {"q": "朝起きて出かけるまでに何をしますか。", "hint": "Vて、Vてから"},
                {"q": "何時に家を出ますか。", "hint": "〜時に家を出て"},
                {"q": "授業は何時から何時までですか。", "hint": "〜時から〜時まで"},
                {"q": "学校ではどんなことをしますか。", "hint": "Vたり、Vたりします"},
                {"q": "昼休みは何時から何時までですか。", "hint": "〜時から〜時まで"},
                {"q": "昼ごはんはどこでだれと食べますか。", "hint": "〜で友達と一緒に"},
                {"q": "授業が終わった後で、どこかへ行きますか。何をしますか。", "hint": "Vた後で"},
                {"q": "何時に家へ帰りますか。", "hint": "〜時ごろ家へ帰ります"},
                {"q": "家へ帰ってから、晩ごはんの前に何をしますか。", "hint": "Vてから"},
                {"q": "晩ごはんは家で食べますか。", "hint": "家族と一緒に"},
                {"q": "晩ごはんのあとで何をしますか。", "hint": "復習をします／音楽を聞きます"},
                {"q": "毎晩何時に寝ますか。", "hint": "毎晩〜時ごろ寝ます"},
            ],
            "sample": "私は毎日6時半に起きます。顔を洗って、歯を磨いてから、家で朝ごはんを食べます。7時半に家を出て、バイクで大学へ行きます。\n\n大学の授業は8時から11時半までです。学校では専門の勉強をしたり、日本語を勉強したりします。昼休みは11時半から1時までです。いつも学校の食堂で友達と一緒に昼ごはんを食べます。\n\n午後の授業が終わった後で、図書館で宿題をします。それから、5時ごろ家へ帰ります。家へ帰ってから、晩ごはんの前にシャワーを浴びます。7時に家族と一緒に家で晩ごはんを食べます。晩ごはんのあとで、日本語の復習をして、少し音楽を聞きます。毎晩11時半ごろ寝ます。毎日忙しいですが、とても楽しいです。",
            "sampleVi": "Tôi dậy lúc 6 giờ 30 mỗi ngày. Rửa mặt, đánh răng rồi ăn sáng ở nhà. 7 giờ 30 ra khỏi nhà, đi xe máy đến trường.\nBuổi học từ 8 giờ đến 11 giờ 30. Ở trường vừa học chuyên ngành vừa học tiếng Nhật. Nghỉ trưa 11 giờ 30–1 giờ, thường ăn cùng bạn ở căn tin.\nSau giờ chiều làm bài ở thư viện, khoảng 5 giờ về nhà, tắm trước bữa tối. 7 giờ ăn tối cùng gia đình, ôn tiếng Nhật, nghe nhạc một chút, ngủ khoảng 11 giờ 30. Bận nhưng rất vui.",
        },
        {
            "id": "sakubun2",
            "title": "なぜ日本語を勉強するか",
            "titleVi": "Tại sao học tiếng Nhật",
            "prompts": [
                {"q": "どうして日本語を勉強したいと思ったのですか。", "hint": "〜が大好きだったので"},
                {"q": "それはいつごろですか。", "hint": "高校生の時から"},
                {"q": "日本語を勉強して何年になりますか。", "hint": "今年で〜年になります"},
                {"q": "どこで日本語を勉強しましたか。国でしましたか。日本へ来てからですか。", "hint": "ベトナムの大学で"},
                {"q": "日本語の勉強は大変ですか。", "hint": "漢字や文法が多くて"},
                {"q": "途中でやめようと思ったことがありますか。", "hint": "〜たことはありません"},
                {"q": "日本のどんな所に興味を持ちますか。", "hint": "〜に興味を持っています"},
                {"q": "あなたの国では、日本語を勉強している人が多いですか。", "hint": "とても多いです"},
                {"q": "あなたの国では、日本語を勉強したら、何かに役に立ちますか。", "hint": "いい仕事を見つけるのに役に立ちます"},
                {"q": "これからもずっと日本語の勉強を続けていくつもりですか。", "hint": "〜つもりです"},
                {"q": "将来、何か日本語が生かせる仕事をしたいと思いますか。", "hint": "日系企業に入って"},
            ],
            "sample": "私は高校生の時から日本のアニメと文化が大好きだったので、日本語を勉強したいと思いました。大学に入ってから日本語を勉強し始めて、今年で3年になります。ベトナムの大学で日本語を勉強しました。\n\n日本語の勉強は漢字や文法が多くてとても大変ですが、途中でやめようと思ったことはありません。日本の歴史やアニメ、そして日本人のまじめな働き方に興味を持っています。\n\n今、ベトナムでは日本語を勉強している人がとても多いです。ベトナムには日本の会社がたくさんあるので、日本語を勉強したら、いい仕事を見つけるのにとても役に立ちます。ですから、これからもずっと日本語の勉強を続けていくつもりです。将来は、日系企業に入って、日本語が生かせる仕事をしたいと思います。",
            "sampleVi": "Từ hồi cấp 3 đã thích anime và văn hóa Nhật nên muốn học tiếng Nhật. Vào đại học bắt đầu học, năm nay được 3 năm, học tại đại học Việt Nam.\nKanji và ngữ pháp nhiều nên rất vất vả nhưng chưa từng muốn bỏ dở. Quan tâm lịch sử, anime và cách làm việc nghiêm túc của người Nhật.\nỞ Việt Nam nhiều người học tiếng Nhật. Có nhiều công ty Nhật nên tiếng Nhật rất có ích để tìm việc. Tôi sẽ tiếp tục học và muốn làm việc tại doanh nghiệp Nhật để dùng được tiếng Nhật.",
        },
        {
            "id": "sakubun3",
            "title": "お誕生日",
            "titleVi": "Ngày sinh nhật",
            "prompts": [
                {"q": "あなたの誕生日は何月何日ですか。", "hint": "{{birthday}}"},
                {"q": "誕生日パーティーをしたことがありますか。", "hint": "Vたことがあります"},
                {"q": "その誕生日で何歳になりましたか。", "hint": "〜歳になりました"},
                {"q": "どこでパーティーをしましたか。", "hint": "家で"},
                {"q": "友達が来ましたか。", "hint": "来てくれました"},
                {"q": "どんなふくそうをしましたか。", "hint": "〜を着ました"},
                {"q": "料理を作りましたか／どんな料理を作りましたか。", "hint": "Vて、Vて"},
                {"q": "何を食べて、何を飲みましたか。", "hint": "Vたり、Vたりしました"},
                {"q": "何をもらいましたか／あげましたか。", "hint": "Nをもらいました"},
                {"q": "パーティーでどんなことをしましたか。", "hint": "歌を歌ったり、ゲームをしたり"},
                {"q": "写真をとりましたか。", "hint": "写真を撮りました"},
                {"q": "そのパーティーはどうでしたか。", "hint": "忘れられない思い出になりました"},
            ],
            "sample": "私の誕生日は{{birthday}}です。去年の誕生日に、家で誕生日パーティーをしました。その誕生日で21歳になりました。\n\nパーティーには大学の親しい友達が5人来てくれました。私はきれいなシャツを着て、母と一緒にケーキやからあげ、サラダなど、いろいろな料理を作りました。パーティーでは、おいしい料理を食べたり、ジュースを飲んだりしました。友達からすてきな時計とかわいいかばんをもらいました。みんなで歌を歌ったり、ゲームをしたりして、記念の写真もたくさん撮りました。そのパーティーは本当ににぎやかで、忘れられない楽しい思い出になりました。",
            "sampleVi": "Sinh nhật tôi là {{birthday}}. Năm ngoái tổ chức tiệc ở nhà, bước sang 21 tuổi.\nNăm người bạn thân đại học đến. Tôi mặc sơ mi đẹp, cùng mẹ làm bánh, karaage, salad. Ăn món ngon, uống nước trái cây, nhận đồng hồ và túi từ bạn. Hát, chơi game, chụp nhiều ảnh kỷ niệm. Tiệc rất náo nhiệt, thành kỷ niệm vui không quên.",
        },
    ]
    return {"kaiwa": kaiwa, "sakubun": sakubun}


def main():
    extract_images()
    paras = PARAS.read_text(encoding="utf-8")
    tonghop = TONGHOP.read_text(encoding="utf-8")

    print("parse fukushuu1")
    f1_raw = parse_mcq_block(section_between(paras, "復習1", "練習2"), 44)
    f1_extra = {i + 1: F1_KEYS[i] for i in range(44)}
    f1 = attach(f1_raw, "fukushuu1", "f1", F1_ANSWERS, f1_extra)
    write_js("fukushuu1.js", "fukushuu1", f1)
    print("  count", len(f1), "opts", min(len(q["options"]) for q in f1))

    print("parse renshuu2")
    r2_raw = parse_mcq_block(section_between(paras, "練習2", "練習3"), 65)
    r2_block = section_between(tonghop, "2. Đáp Án & Giải Thích Ngắn Gọn 練習2", "PHẦN 3")
    r2_rows = parse_letter_explanations(r2_block, 65)
    r2_ans = {i + 1: r2_rows[i][0] for i in range(len(r2_rows))}
    r2_extra = {i + 1: (r2_rows[i][1].split(" — ")[0], r2_rows[i][1]) for i in range(len(r2_rows))}
    r2 = attach(r2_raw, "renshuu2", "r2", r2_ans, r2_extra)
    write_js("renshuu2.js", "renshuu2", r2)
    print("  count", len(r2), "opts", min(len(q["options"]) for q in r2))

    print("parse renshuu3")
    r3_raw = parse_mcq_block(section_between(paras, "練習3", "練習4"), 50)
    r3_ans_map = {}
    r3_extra = {}
    # A 1-25 then B 26-50 from tonghop sequential letters
    a_block = section_between(tonghop, "A. Cách Đọc Hán Tự", "B. Chọn Hán Tự")
    b_block = section_between(tonghop, "B. Chọn Hán Tự", "PHẦN 4")
    a_rows = []
    for ln in a_block.splitlines():
        m = re.search(r"→\s*([A-D])\.\s*(.+)", ln)
        if m:
            a_rows.append((m.group(1), m.group(2).strip()))
    b_rows = []
    for ln in b_block.splitlines():
        m = re.search(r"→\s*([A-D])\.\s*(.+)", ln)
        if m:
            b_rows.append((m.group(1), m.group(2).strip()))
    print("  r3 a", len(a_rows), "b", len(b_rows))
    for i, (ans, expl) in enumerate(a_rows, 1):
        r3_ans_map[i] = ans
        r3_extra[i] = (expl.split(" (")[0], expl)
    for i, (ans, expl) in enumerate(b_rows, 26):
        r3_ans_map[i] = ans
        r3_extra[i] = (expl.split(" (")[0], expl)
    r3 = attach(r3_raw, "renshuu3", "r3", r3_ans_map, r3_extra)
    for q in r3:
        q["part"] = "A" if q["questionNumber"] <= 25 else "B"
    write_js("renshuu3.js", "renshuu3", r3)
    print("  count", len(r3))

    print("parse renshuu4")
    r4_raw = parse_mcq_block(section_between(paras, "練習4", "練習5"), 48)
    r4_table = parse_mondai_table(section_between(tonghop, "2. Bảng Đáp Án Nhanh 練習4", "PHẦN 5"))
    print("  r4 answers parsed", len(r4_table))
    r4_ans = {n: r4_table[n][0] for n in range(1, 49)}
    r4_extra = {n: (r4_table[n][1], r4_table[n][1] or "Xem bảng ngữ pháp 練習4.") for n in range(1, 49)}
    r4 = attach(r4_raw, "renshuu4", "r4", r4_ans, r4_extra)
    write_js("renshuu4.js", "renshuu4", r4)
    print("  count", len(r4))

    print("parse renshuu5")
    r5_raw = parse_mcq_block(section_between(paras, "練習5", "読解"), 50)
    r5_block = section_between(tonghop, "2. Đáp Án & Giải Thích Chi Tiết 練習5", "PHẦN 6")
    r5_rows = parse_letter_explanations(r5_block, 50)
    r5_ans = {i + 1: r5_rows[i][0] for i in range(len(r5_rows))}
    r5_extra = {i + 1: (r5_rows[i][1].split(" — ")[0], r5_rows[i][1]) for i in range(len(r5_rows))}
    r5 = attach(r5_raw, "renshuu5", "r5", r5_ans, r5_extra)
    write_js("renshuu5.js", "renshuu5", r5)
    print("  count", len(r5))

    dokkai = build_dokkai()
    write_js("dokkai.js", "dokkai", dokkai)
    print("dokkai passages", len(dokkai), "qs", sum(len(p["questions"]) for p in dokkai))

    choukai = build_choukai()
    write_js("choukai.js", "choukai", choukai)
    print("choukai", {k: len(v) for k, v in choukai.items()})

    ks = build_kaiwa_sakubun()
    (DATA / "kaiwa_sakubun.js").write_text(
        js_module("kaiwa", ks["kaiwa"]) + js_module("sakubun", ks["sakubun"]),
        encoding="utf-8",
    )
    print("kaiwa", len(ks["kaiwa"]), "sakubun", len(ks["sakubun"]))

    # flashcards
    deck1 = [{"id": f"fc1_{q['id']}", "deck": 1, "front": q["questionText"], "back": q["options"][q["correctAnswer"]], "note": q["keyTakeaway"]} for q in f1]
    deck2 = [{"id": f"fc2_{q['id']}", "deck": 2, "front": q["questionText"], "back": q["options"][q["correctAnswer"]], "note": q["explanation"]} for q in r2]
    deck3 = [{"id": f"fc3_{q['id']}", "deck": 3, "front": q["questionText"], "back": q["options"][q["correctAnswer"]], "note": q["explanation"]} for q in r3]
    grammar = [
        "まるで〜ようだ／みたいだ", "Vるようにする", "Vる／Nのにいい", "Vてばかりいる", "Vずに／せずに",
        "いくらVても", "疑問詞でも", "おかげで／せいで／ために", "のに（逆接）", "なければならない",
        "Vているうちに", "もし〜たら", "らしい／ようだ／そうだ", "ことにする", "ほど〜ない",
        "Vますやすい／にくい／がたい", "そうにない", "ようがない", "どおりに", "はともかく",
        "たびに", "にともなって", "にかけては", "からNにかけて", "からして",
        "といえば", "際には", "動くな／Vなさい", "自動詞／他動詞", "口語：ちゃう／なきゃ",
    ]
    deck4 = [{"id": f"fc4_{i+1}", "deck": 4, "front": g, "back": g, "note": "Ôn công thức 練習4・練習5"} for i, g in enumerate(grammar)]
    decks = {"deck1": deck1, "deck2": deck2, "deck3": deck3, "deck4": deck4}
    write_js("flashcards.js", "flashcards", decks)

    index = """import { fukushuu1 } from './fukushuu1.js';
import { renshuu2 } from './renshuu2.js';
import { renshuu3 } from './renshuu3.js';
import { renshuu4 } from './renshuu4.js';
import { renshuu5 } from './renshuu5.js';
import { dokkai } from './dokkai.js';
import { choukai } from './choukai.js';
import { kaiwa, sakubun } from './kaiwa_sakubun.js';
import { flashcards } from './flashcards.js';

export const QUIZ_SECTIONS = [
  { id: 'fukushuu1', label: '復習1', title: 'Câu đồng nghĩa', questions: fukushuu1 },
  { id: 'renshuu2', label: '練習2', title: 'Từ vựng & collocation', questions: renshuu2 },
  { id: 'renshuu3', label: '練習3', title: 'Kanji', questions: renshuu3 },
  { id: 'renshuu4', label: '練習4', title: 'Ngữ pháp', questions: renshuu4 },
  { id: 'renshuu5', label: '練習5', title: 'Chia thể', questions: renshuu5 },
];

export const ALL_QUIZ_QUESTIONS = QUIZ_SECTIONS.flatMap((s) => s.questions);

export {
  fukushuu1, renshuu2, renshuu3, renshuu4, renshuu5,
  dokkai, choukai, kaiwa, sakubun, flashcards,
};
"""
    (DATA / "index.js").write_text(index, encoding="utf-8")
    print("TOTAL QUIZ", len(f1) + len(r2) + len(r3) + len(r4) + len(r5))


if __name__ == "__main__":
    main()
