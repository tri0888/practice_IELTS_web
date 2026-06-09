import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
import zipfile

sys.stdout.reconfigure(encoding='utf-8')

repo_root = Path("d:/Git/practice_IELTS_web")
books_dir = repo_root / "TRỌN BỘ CAMBRIDGE IELTS 1 - 20 ACADEMIC"

def extract_zip(archive_path: Path, dest_dir: Path):
    dest_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting ZIP {archive_path.name} to {dest_dir.relative_to(repo_root)} ...")
    try:
        with zipfile.ZipFile(archive_path, 'r') as z:
            z.extractall(dest_dir)
        print("  Extraction complete!")
    except Exception as e:
        print(f"  Error extracting ZIP natively: {e}")

def extract_rar(archive_path: Path, dest_dir: Path):
    dest_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting RAR {archive_path.name} to {dest_dir.relative_to(repo_root)} ...")
    
    # Switch working directory to parent directory to avoid unicode characters in path parameter
    original_cwd = os.getcwd()
    try:
        os.chdir(str(archive_path.parent))
        relative_archive = archive_path.name
        
        # Use os.path.relpath which handles cousin/sibling directories safely
        relative_dest = os.path.relpath(str(dest_dir), str(archive_path.parent))
        
        # bsdtar supports rar extraction
        subprocess.run(["tar", "-xf", relative_archive, "-C", relative_dest], check=True)
        print("  Extraction complete!")
    except Exception as e:
        print(f"  Error extracting RAR with relative tar: {e}")
    finally:
        os.chdir(original_cwd)

def main():
    for book in range(12, 21):
        book_folder = books_dir / f"Cambridge IELTS {book}"
        if not book_folder.exists():
            continue
        
        print(f"\n========================================\nProcessing Book {book}...\n========================================")
        
        # 1. Extract any ZIP archives in the book folder
        for item in list(book_folder.iterdir()):
            if item.is_file() and item.suffix.lower() == '.zip':
                extract_dir = book_folder / "extracted"
                # For clean re-runs, we can skip if already extracted or extract it
                extract_zip(item, extract_dir)
                
                # Check for nested .zip or .rar files in the extracted directory
                if extract_dir.exists():
                    for subitem in list(extract_dir.rglob("*")):
                        if subitem.is_file():
                            if subitem.suffix.lower() == '.zip':
                                sub_extract_dir = extract_dir / subitem.stem
                                extract_zip(subitem, sub_extract_dir)
                            elif subitem.suffix.lower() == '.rar':
                                sub_extract_dir = extract_dir / subitem.stem
                                extract_rar(subitem, sub_extract_dir)

        # 2. Identify the main test PDF and solution PDF
        all_pdfs = list(book_folder.rglob("*.pdf"))
        # Exclude macOS metadata paths
        all_pdfs = [p for p in all_pdfs if "__MACOSX" not in p.parts]
        
        main_pdf = None
        solution_pdf = None
        
        # Filter solution/chữa đề PDFs
        sol_candidates = []
        main_candidates = []
        for pdf in all_pdfs:
            # Normalize to NFC to ensure Vietnamese accents match consistently
            name_normalized = unicodedata.normalize('NFC', pdf.name.lower())
            
            # Skip already standardized files to prevent self-matching
            if name_normalized == f"cambridge_ielts_{book}_academic.pdf" or name_normalized == f"cambridge_ielts_{book}_solution.pdf":
                continue
                
            if any(kwd in name_normalized for kwd in ["chua de", "chữa đề", "giai de", "giải đề", "giai ma", "giải mã", "solution", "vietop"]):
                sol_candidates.append(pdf)
            else:
                main_candidates.append(pdf)
        
        # Sort by size to identify the most robust ones
        if sol_candidates:
            solution_pdf = max(sol_candidates, key=lambda p: p.stat().st_size)
        
        def check_pdf_text_pages(pdf_path: Path) -> int:
            try:
                import fitz
                doc = fitz.open(str(pdf_path))
                text_pages = 0
                for i in range(min(len(doc), 10)):
                    if doc[i].get_text("text").strip():
                        text_pages += 1
                doc.close()
                return text_pages
            except Exception:
                return 0

        if main_candidates:
            best_cand = None
            best_score = -999999
            for cand in main_candidates:
                score = 0
                name_norm = unicodedata.normalize('NFC', cand.name.lower())
                
                # Check for "bản đẹp", "bản siêu đẹp" or similar
                if any(k in name_norm for k in ["bản đẹp", "bản siêu đẹp", "ban dep", "sieu dep", "bản đẹp", "siêu đẹp"]):
                    score += 10000
                
                # Check text extractability in first 10 pages
                text_pages = check_pdf_text_pages(cand)
                score += text_pages * 1000
                
                # Favor academic/cambridge keywords
                if "academic" in name_norm:
                    score += 500
                if "cambridge" in name_norm:
                    score += 200
                    
                # Size (in MB) to resolve ties (but don't let size overpower text extractability)
                size_mb = cand.stat().st_size / (1024 * 1024)
                score += size_mb
                
                if score > best_score:
                    best_score = score
                    best_cand = cand
            main_pdf = best_cand
        
        # Copy to standardized paths
        if main_pdf:
            dest_main = book_folder / f"Cambridge_IELTS_{book}_Academic.pdf"
            print(f"Standardizing main PDF: {main_pdf.relative_to(book_folder)} -> {dest_main.name}")
            dest_main.write_bytes(main_pdf.read_bytes())
        else:
            print(f"⚠️ Main PDF not found for Book {book}!")

        if solution_pdf:
            dest_sol = book_folder / f"Cambridge_IELTS_{book}_Solution.pdf"
            print(f"Standardizing solution PDF: {solution_pdf.relative_to(book_folder)} -> {dest_sol.name}")
            dest_sol.write_bytes(solution_pdf.read_bytes())
        else:
            print(f"⚠️ Solution PDF not found for Book {book}!")

if __name__ == "__main__":
    main()
