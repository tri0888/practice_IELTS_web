import fitz
import pytesseract
from PIL import Image
import io
import re
from pathlib import Path
import json

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def extract_headers(book):
    repo_root = Path(__file__).resolve().parents[1]
    book_folder = repo_root / "TRỌN BỘ CAMBRIDGE IELTS 1 - 20 ACADEMIC" / f"Cambridge IELTS {book}"
    
    candidates = list(book_folder.glob("*Academic.pdf"))
    if not candidates:
        candidates = list(book_folder.glob("*.pdf"))
    
    if not candidates:
         print(f"Book {book} not found")
         return
         
    pdf_path = candidates[0]
    print(f"Scanning {pdf_path.name}...")
    doc = fitz.open(str(pdf_path))
    
    results = {}
    
    # We scan pages 8 to 140
    for page_num in range(8, min(140, len(doc))):
        page = doc[page_num]
        text = page.get_text("text")
        
        if len(text.strip()) < 50:
             # OCR fallback
             rect = page.rect
             # crop top 30%
             clip = fitz.Rect(0, 0, rect.width, rect.height * 0.3)
             pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip)
             img = Image.open(io.BytesIO(pix.tobytes("png")))
             text = pytesseract.image_to_string(img)
             
        text = text.upper()
        
        found = []
        for line in text.split('\n'):
            line = line.strip()
            if not line: continue
            
            if re.search(r'TEST\s+[1-4]', line):
                found.append(line)
            elif re.search(r'PART\s+[1-4]', line):
                found.append(line)
            elif re.search(r'SECTION\s+[1-4]', line):
                found.append(line)
            elif re.search(r'READING\s+PASSAGE\s+[1-3]', line):
                found.append(line)
            elif re.search(r'WRITING\s+TASK\s+[1-2]', line):
                found.append(line)
            elif "SPEAKING" in line and len(line) < 20:
                found.append(line)
                
        if found:
             results[page_num + 1] = found
             
    doc.close()
    
    for p, f in results.items():
         print(f"Page {p}: {f}")

if __name__ == "__main__":
    extract_headers(11)
