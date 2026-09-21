from __future__ import annotations
import re, unicodedata
from datetime import date, datetime
from typing import Optional
import fitz, pytesseract
from PIL import Image, ImageOps, ImageFilter
from app.config import OCR_LANG, TESSERACT_CMD
if TESSERACT_CMD: pytesseract.pytesseract.tesseract_cmd=TESSERACT_CMD
DATE_RE=re.compile(r"\b([0-3]?\d)[/.-]([0-1]?\d)[/.-]((?:20)?\d{2})\b")
def _norm(s):
    s=unicodedata.normalize("NFKD",s); s="".join(c for c in s if not unicodedata.combining(c))
    return s.upper().replace("\xa0"," ")
def _spaces(s): return re.sub(r"[ \t]+"," ",s).strip()
def _date(s):
    m=DATE_RE.search(s)
    if not m: return None
    y=int(m.group(3)); y+=2000 if y<100 else 0
    return date(y,int(m.group(2)),int(m.group(1)))
def _ocr_page(page):
    pix=page.get_pixmap(dpi=250,colorspace=fitz.csGRAY,alpha=False)
    im=Image.frombytes("L",[pix.width,pix.height],pix.samples)
    return pytesseract.image_to_string(ImageOps.autocontrast(im).filter(ImageFilter.SHARPEN),lang=OCR_LANG,config="--psm 6")
def ocr_pdf(data):
    doc=fitz.open(stream=data,filetype="pdf")
    try: return "\n".join(_ocr_page(p) for p in doc)
    finally: doc.close()
def extract_work_order(text):
    t=_spaces(_norm(text))
    m=re.search(r"ORCAMENTO\s*[:.\-]?\s*([0-9]{4,8})",t)
    return int(m.group(1)) if m else None
def extract_client(text):
    m=re.search(r"RAZAO\s*[:.\-]?\s*(.+)",_norm(text))
    if not m:return None
    return re.split(r"\b(?:EQUIPAMENTO|ENDERECO|REFERENCIA)\b",_spaces(m.group(1)))[0].strip() or None
def extract_serial(text):
    m=re.search(r"NRO\.?\s*SERIE\s*[:.\-]?\s*([A-Z0-9]+)",_spaces(_norm(text)))
    return m.group(1) if m else None
def extract_color(serial):
    m=re.search(r"(AZ|BR|AM)$",serial.upper()) if serial else None
    return m.group(1) if m else "ROSA"
def extract_power(text):
    m=re.search(r"POTENCIA\s*[:.\-]?\s*([0-9]+(?:[,.][0-9]+)?\s*(?:CV|KW|HP))",_spaces(_norm(text)))
    return m.group(1) if m else None
def extract_delivery_date(text):
    t=_norm(text)
    for m in re.finditer(r"ENTREGA",t):
        d=DATE_RE.search(t[m.end():m.end()+100])
        if d:return _date(d.group(0))
    return None
def calculate_status(today,data_final):
    return "NO PRAZO" if data_final is None or today<=data_final else "ATRASADO"
def extract_fields(text,today:Optional[date]=None):
    today=today or datetime.now().date(); serial=extract_serial(text); final=extract_delivery_date(text)
    return {"os":extract_work_order(text),"cliente":extract_client(text),"serial":serial,"cor":extract_color(serial),"potencia":extract_power(text),"data":today.isoformat(),"data_final":final.isoformat() if final else None,"status":calculate_status(today,final)}
