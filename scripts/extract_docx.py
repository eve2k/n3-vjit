import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def collect_text(node) -> str:
    if local(node.tag) in {"rt", "instrText"}:
        return ""
    parts = []
    if local(node.tag) == "t" and node.text:
        parts.append(node.text)
    for child in list(node):
        parts.append(collect_text(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


def para_text(para) -> str:
    return collect_text(para)


def extract_images(z: zipfile.ZipFile, dest: Path) -> list[str]:
    dest.mkdir(parents=True, exist_ok=True)
    names = []
    for info in z.infolist():
        if info.filename.startswith("word/media/"):
            data = z.read(info.filename)
            out = dest / Path(info.filename).name
            out.write_bytes(data)
            names.append(out.name)
    return names


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
        images = extract_images(z, Path(r"C:\_workspace\web\nn13\n3-vjit-webapp\public\images"))
        print("images", images)
    paras = [para_text(p) for p in root.iter(f"{W}p")]
    return "\n".join(paras)


def main():
    root = Path(r"C:\_workspace\web\nn13")
    text = docx_text(root / "decuong.docx")
    out = root / "decuong_clean.txt"
    out.write_text(text, encoding="utf-8")
    print("decuong_clean chars", len(text), "lines", text.count("\n") + 1)


if __name__ == "__main__":
    main()
