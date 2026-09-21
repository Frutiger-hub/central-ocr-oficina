from pathlib import Path
import json
import os
from dotenv import load_dotenv
load_dotenv()
BASE_DIR=Path(__file__).resolve().parents[1]
CONFIG_DIR=BASE_DIR/"config"; STATIC_DIR=BASE_DIR/"app"/"static"; UPLOAD_DIR=BASE_DIR/"uploads"
XLSM_PATH=Path(os.getenv("XLSM_PATH","")).expanduser()
TESSERACT_CMD=os.getenv("TESSERACT_CMD","").strip()
OCR_LANG=os.getenv("OCR_LANG","por")
KEEP_UPLOADS=os.getenv("KEEP_UPLOADS","true").lower() in {"1","true","yes","sim"}
MONTADOS_SHEET="MONTADOS"; ENROLADOR_SHEET="ENROLADOR"
def load_technicians():
    with (CONFIG_DIR/"technicians.json").open("r",encoding="utf-8") as f: return json.load(f)
