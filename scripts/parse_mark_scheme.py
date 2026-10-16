#!/usr/bin/env python3
"""
Cambridge Mark Scheme PDF Parser.
Extracts (question_number, answer_key) pairs from Cambridge IGCSE / O-Level MCQ mark scheme PDFs.
Supports both modern single-column tables and legacy multi-column grids.
"""

import sys
import os
import re
import json

def extract_mark_scheme(pdf_path: str) -> dict:
    if not os.path.exists(pdf_path):
        return {"success": False, "error": f"Mark scheme file not found: {pdf_path}"}
    
    try:
        import fitz
    except ImportError:
        return {"success": False, "error": "PyMuPDF (fitz) is not installed."}

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        return {"success": False, "error": f"Failed to open PDF: {str(e)}"}

    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"

    answers = {}

    # Pass 1: Line-based regex search
    # Matches patterns like '1 D 1', '1 D', '1 A 16 C', '1. D', '1: D'
    for line in full_text.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        # Check for multiple question-answer pairs on one line (e.g. multi-column tables)
        # Matches e.g. '1 D 16 C' or '1  D  1'
        matches = re.findall(r'(?:^|\b)(\d{1,2})\s*[:\.]?\s+([A-D])\b', trimmed)
        for q_str, key in matches:
            q_num = int(q_str)
            if 1 <= q_num <= 60 and q_num not in answers:
                answers[q_num] = key

    # Pass 2: Token-stream parser (handles line-broken cells, e.g.:
    # Question \n 1 \n Answer \n D \n Marks \n 1
    raw_lines = [l.strip() for l in full_text.splitlines() if l.strip()]
    tokens = []
    for line in raw_lines:
        tokens.extend(line.split())

    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok.isdigit():
            q_num = int(tok)
            if 1 <= q_num <= 60:
                if i + 1 < len(tokens) and tokens[i+1] in ["A", "B", "C", "D"]:
                    ans = tokens[i+1]
                    if q_num not in answers:
                        answers[q_num] = ans
                    if i + 2 < len(tokens) and tokens[i+2] == "1":
                        i += 3
                        continue
                    else:
                        i += 2
                        continue
        i += 1

    formatted_answers = {str(k): answers[k] for k in sorted(answers.keys())}
    
    return {
        "success": True,
        "answers": formatted_answers,
        "total": len(formatted_answers),
        "source": os.path.abspath(pdf_path)
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: parse_mark_scheme.py <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    result = extract_mark_scheme(pdf_path)
    print(json.dumps(result, indent=2))
    if not result.get("success"):
        sys.exit(1)

if __name__ == "__main__":
    main()
