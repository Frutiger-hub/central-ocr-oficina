from datetime import date
from pathlib import Path
from uuid import uuid4
import re
from fastapi import FastAPI,File,HTTPException,UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel,Field
from app.config import KEEP_UPLOADS,STATIC_DIR,UPLOAD_DIR,XLSM_PATH,load_technicians
from app.services.excel_writer import WorkbookError,append_launch
from app.services.ocr import extract_fields,ocr_pdf
app=FastAPI(title="Central OCR Oficina",version="0.1.0")
app.mount("/static",StaticFiles(directory=STATIC_DIR),name="static")
class LaunchPayload(BaseModel):
    os:int=Field(...); cliente:str; tecnico:str; data:date; data_final:date|None=None; status:str
    rebobinamento:bool=False; cor:str|None=None; potencia:str|None=None
@app.get("/")
def index(): return FileResponse(STATIC_DIR/"index.html")
@app.get("/api/health")
def health(): return {"ok":True,"workbook_configured":bool(XLSM_PATH),"workbook_exists":XLSM_PATH.exists() if XLSM_PATH else False}
@app.get("/api/technicians")
def technicians(): return load_technicians()
@app.post("/api/scan")
async def scan_pdf(file:UploadFile=File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"): raise HTTPException(400,"Selecione um arquivo PDF.")
    content=await file.read()
    if not content: raise HTTPException(400,"PDF vazio.")
    try: fields=extract_fields(ocr_pdf(content))
    except Exception as exc: raise HTTPException(500,f"Falha no OCR: {exc}") from exc
    if KEEP_UPLOADS:
        UPLOAD_DIR.mkdir(parents=True,exist_ok=True); safe=re.sub(r"[^A-Za-z0-9._-]+","_",Path(file.filename).name)
        (UPLOAD_DIR/f"{uuid4().hex}_{safe}").write_bytes(content)
    fields["filename"]=file.filename; return fields
@app.post("/api/launch")
def launch(p:LaunchPayload):
    if not XLSM_PATH: raise HTTPException(500,"XLSM_PATH não foi configurado no .env.")
    if p.status not in {"NO PRAZO","ATRASADO"}: raise HTTPException(400,"Status inválido.")
    if p.rebobinamento and p.cor not in {"AZ","BR","AM","ROSA"}: raise HTTPException(400,"Cor inválida.")
    try:
        result=append_launch(XLSM_PATH,p.os,p.data,p.cliente,p.tecnico,p.data_final.isoformat() if p.data_final else None,p.status,p.rebobinamento,p.cor,p.potencia)
    except WorkbookError as exc: raise HTTPException(400,str(exc)) from exc
    except PermissionError as exc: raise HTTPException(409,"Feche a planilha no Excel e tente novamente.") from exc
    except Exception as exc: raise HTTPException(500,f"Falha ao atualizar o Excel: {exc}") from exc
    return {"ok":True,**result}
