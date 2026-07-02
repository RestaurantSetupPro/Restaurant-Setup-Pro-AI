from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import io, struct

ROOT = Path(__file__).resolve().parents[1]
SHOT = ROOT / "outputs" / "Module-07" / "UI-Review" / "Screenshots"
OUT = ROOT / "outputs" / "Module-07" / "UI-Review" / "Module07-Sales-Workflow-Demo.avi"
slides = [
    ("02-Sales-Home.png", "Sales Home — five focused actions"),
    ("03-New-Inquiry.png", "1. New Inquiry — paste the original customer message"),
    ("04-AI-Analysis-Result.png", "2. Analyze Inquiry — intent, opportunity and missing information"),
    ("05-Product-Recommendation.png", "3. Select Products — live recommendations from Product Library"),
    ("06-Quote-Builder.png", "4. Generate PI — quantity, price, payment and freight"),
    ("07-PI-Preview.png", "5. Preview PI — customer-ready Proforma Invoice"),
    ("08-Orders.png", "6. Convert to Order — no duplicate entry"),
]
width, height, fps, seconds = 1280, 720, 2, 9
font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 30)
subfont = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 17)
frames = []
for filename, title in slides:
    source = Image.open(SHOT / filename).convert("RGB")
    source.thumbnail((1220, 575), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), "#f5f7f6")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width, 92), fill="#143f36")
    draw.text((36, 22), title, fill="white", font=font)
    draw.text((38, 61), "Restaurant Setup Pro · Module 07 Sales Intelligence", fill="#cfe1dc", font=subfont)
    x, y = (width-source.width)//2, 112+(575-source.height)//2
    canvas.paste(source, (x, y))
    draw.rounded_rectangle((x-2, y-2, x+source.width+2, y+source.height+2), radius=8, outline="#c8d3d0", width=2)
    buf = io.BytesIO(); canvas.save(buf, "JPEG", quality=88, optimize=True)
    frames.extend([buf.getvalue()] * (fps * seconds))

def chunk(tag, data):
    return tag + struct.pack("<I", len(data)) + data + (b"\0" if len(data) & 1 else b"")
max_size = max(map(len, frames)); total = len(frames)
avih = struct.pack("<IIIIIIIIII4I", 1_000_000//fps, max_size*fps, 0, 0x10, total, 0, 1, max_size, width, height, 0,0,0,0)
strh = struct.pack("<4s4sIHHIIIIIIIIhhhh", b"vids", b"MJPG", 0, 0, 0, 0, 1, fps, 0, total, max_size, 0xFFFFFFFF, 0, 0,0,width,height)
strf = struct.pack("<IiiHH4sIiiII", 40, width, height, 1, 24, b"MJPG", width*height*3, 0,0,0,0)
hdrl = b"LIST" + struct.pack("<I", 4 + len(chunk(b"avih", avih)) + len(b"LIST" + struct.pack("<I", 4 + len(chunk(b"strh",strh)) + len(chunk(b"strf",strf))) + b"strl" + chunk(b"strh",strh) + chunk(b"strf",strf))) + b"hdrl"
strl = b"LIST" + struct.pack("<I", 4 + len(chunk(b"strh",strh)) + len(chunk(b"strf",strf))) + b"strl" + chunk(b"strh",strh) + chunk(b"strf",strf)
hdrl = b"LIST" + struct.pack("<I", 4 + len(chunk(b"avih",avih)) + len(strl)) + b"hdrl" + chunk(b"avih",avih) + strl
movi_data = bytearray(); index = bytearray(); offset = 4
for frame in frames:
    part = chunk(b"00dc", frame); movi_data.extend(part)
    index.extend(struct.pack("<4sIII", b"00dc", 0x10, offset, len(frame))); offset += len(part)
movi = b"LIST" + struct.pack("<I", 4 + len(movi_data)) + b"movi" + movi_data
body = b"AVI " + hdrl + movi + chunk(b"idx1", bytes(index))
OUT.write_bytes(b"RIFF" + struct.pack("<I", len(body)) + body)
print(OUT)
