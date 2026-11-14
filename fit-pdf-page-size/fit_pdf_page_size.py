import fitz  # PyMuPDF
import os
import tkinter as tk
from tkinter import filedialog
import sys

def select_file():
    """파일 선택 대화상자를 띄웁니다."""
    root = tk.Tk()
    root.withdraw()  # 메인 윈도우 숨김
    
    file_path = filedialog.askopenfilename(
        title="크기를 교정할 PDF 파일을 선택하세요",
        filetypes=[("PDF Files", "*.pdf")]
    )
    return file_path

def resize_pdf(input_path):
    """PDF를 183x235mm로 리사이징하고 저장합니다."""
    
    # 1. 경로 및 파일명 설정
    # 원본 경로에서 확장자를 분리 (예: C:/Docs/book.pdf -> C:/Docs/book, .pdf)
    base_name, ext = os.path.splitext(input_path)
    output_path = f"{base_name}_size_fitted{ext}"

    try:
        doc = fitz.open(input_path)
        out_doc = fitz.open()

        # 2. 목표 규격 설정 (183mm x 235mm)
        # 1mm = 2.83465 point
        width_mm = 183
        height_mm = 235
        
        w_pt = width_mm * 2.83465
        h_pt = height_mm * 2.83465
        
        target_rect = fitz.Rect(0, 0, w_pt, h_pt)

        print(f"작업 시작: {os.path.basename(input_path)}")
        print(f"목표 크기: {width_mm}mm x {height_mm}mm")

        # 3. 페이지 변환 루프
        for i, page in enumerate(doc):
            # 새 페이지 생성
            new_page = out_doc.new_page(width=w_pt, height=h_pt)
            
            # 기존 페이지 내용을 강제로 꽉 차게 그림 (keep_proportion=False)
            new_page.show_pdf_page(target_rect, doc, page.number, keep_proportion=False)
            
            # 진행상황 표시 (선택사항)
            sys.stdout.write(f"\r처리 중... {i+1}/{len(doc)} 페이지")
            sys.stdout.flush()

        # 4. 저장
        out_doc.save(output_path)
        print(f"\n\n[성공] 파일이 저장되었습니다:")
        print(f"경로: {output_path}")

    except Exception as e:
        print(f"\n[오류] 작업을 완료할 수 없습니다: {e}")
    finally:
        if 'doc' in locals(): doc.close()
        if 'out_doc' in locals(): out_doc.close()

if __name__ == "__main__":
    print("--- PDF 사이즈 일괄 교정 도구 (183x235mm) ---")
    
    selected_path = select_file()
    
    if selected_path:
        resize_pdf(selected_path)
    else:
        print("파일 선택이 취소되었습니다.")
    
    input("\n종료하려면 엔터 키를 누르세요...")