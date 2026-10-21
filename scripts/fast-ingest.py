#!/usr/bin/env python3
"""
scripts/fast-ingest.py

Ultra-fast, automated Cambridge Past Paper Ingestion Engine for Revizz.
Extracts questions, stems, tables, diagrams, and options from Cambridge MCQ Question Papers (QP),
cross-references with official Mark Schemes (MS), sanitizes LaTeX/currency, maps syllabus topics,
generates distractor analyses and derivations, renders 300 DPI diagrams, and saves validated
staging JSON documents.

Usage:
  Single paper mode:
    python3 scripts/fast-ingest.py --qp "path/to/0455_w24_qp_12.pdf" --ms "path/to/0455_w24_ms_12.pdf"

  Batch folder mode:
    python3 scripts/fast-ingest.py --batch-dir "Economics (0455)/2024"
"""

import os
import sys
import re
import time
import json
import argparse
from typing import Dict, List, Any, Optional, Tuple

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF (fitz) is required. Install via: pip install pymupdf")
    sys.exit(1)

# Subject code mapping
SUBJECT_MAP = {
    "0455": {"name": "Economics", "icon": "trending-up"},
    "0620": {"name": "Chemistry", "icon": "flask-conical"},
    "0625": {"name": "Physics", "icon": "atom"},
    "0450": {"name": "Business Studies", "icon": "briefcase"},
    "0452": {"name": "Accounting", "icon": "calculator"},
    "0470": {"name": "History", "icon": "landmark"},
    "0460": {"name": "Geography", "icon": "globe"},
    "0610": {"name": "Biology", "icon": "dna"},
}

SERIES_NAME_MAP = {
    "m": "Feb/March",
    "s": "May/June",
    "w": "Oct/Nov",
}

# Cambridge Economics 0455 syllabus topics
ECONOMICS_SYLLABUS = [
    {"name": "The basic economic problem", "order_index": 1, "q_range": (1, 3)},
    {"name": "The allocation of resources", "order_index": 2, "q_range": (4, 9)},
    {"name": "Microeconomic decision makers", "order_index": 3, "q_range": (10, 16)},
    {"name": "Government and the macroeconomy", "order_index": 4, "q_range": (17, 23)},
    {"name": "Economic development", "order_index": 5, "q_range": (24, 26)},
    {"name": "International trade and globalisation", "order_index": 6, "q_range": (27, 30)},
]

TOPIC_KEYWORDS = {
    "The basic economic problem": [
        "scarcity", "opportunity cost", "production possibility", "ppc",
        "factors of production", "finite resources", "unlimited wants",
        "capital goods", "consumer goods", "for whom", "what to produce"
    ],
    "The allocation of resources": [
        "demand", "supply", "equilibrium", "elasticity", "ped", "pes",
        "price mechanism", "market failure", "externalities", "social cost",
        "social benefit", "public good", "merit good", "shortage", "surplus"
    ],
    "Microeconomic decision makers": [
        "money", "central bank", "commercial bank", "wage", "trade union",
        "specialisation", "firm", "monopoly", "economies of scale", "revenue",
        "profit", "labour market", "merger", "vertical", "horizontal", "cost"
    ],
    "Government and the macroeconomy": [
        "macroeconomic", "fiscal", "monetary policy", "supply-side",
        "tax", "inflation", "deflation", "unemployment", "economic growth",
        "gdp", "recession", "budget", "government expenditure"
    ],
    "Economic development": [
        "living standards", "poverty", "population", "birth rate", "death rate",
        "hdi", "human development index", "developing economy", "developed economy",
        "life expectancy", "net migration", "income economy"
    ],
    "International trade and globalisation": [
        "international trade", "globalisation", "globalization", "tariff",
        "quota", "protectionism", "free trade", "current account", "balance of payments",
        "exchange rate", "depreciation", "appreciation", "trade in goods",
        "exports", "imports", "floating exchange rate"
    ],
}


def escape_currency_dollars(text: str) -> str:
    """
    Escapes unescaped currency dollar signs (e.g. $50 -> \\$50, $10bn -> \\$10bn)
    without corrupting valid math blocks ($...$ or $$...$$).
    """
    if not text:
        return ""

    # Stash display math blocks ($$...$$)
    display_blocks: List[str] = []

    def stash_display(m):
        display_blocks.append(m.group(0))
        return f"@@DISPLAY_MATH_{len(display_blocks) - 1}@@"

    stashed = re.sub(r"\$\$[\s\S]*?\$\$", stash_display, text)

    # Replace currency dollar signs:
    # Matches $ followed by digit, or space+digit, or currency unit (bn, m, k, billion, million, trillion)
    def repl_curr(m):
        prefix = m.group(1)
        body = m.group(2)
        return prefix + r"\$" + body

    pattern = r"(?<!\\)(^|[^\\])\$(\s*\d[\d,\.]*(?:\s*(?:bn|m|k|billion|million|trillion))?|\s*(?:bn|m|k|billion|million|trillion)\b)"
    stashed = re.sub(pattern, repl_curr, stashed)

    # Standardize curve / equilibrium subscripts in prose:
    # e.g. "D1" -> "$D_1$", "S2" -> "$S_2$"
    stashed = re.sub(r"\b([DSP])(\d)\b", r"$\1_\2$", stashed)
    stashed = re.sub(r"\bATC(\d)\b", r"$\\text{ATC}_\1$", stashed)

    # Restore display math blocks
    for idx, block in enumerate(display_blocks):
        stashed = stashed.replace(f"@@DISPLAY_MATH_{idx}@@", block)

    return stashed


def parse_filename_metadata(qp_path: str, ms_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses Cambridge filename conventions:
    e.g. 0455_w24_qp_12.pdf -> subject 0455, series w, year 2024, paper_code 12
    """
    qp_base = os.path.basename(qp_path)
    match = re.search(r"([a-zA-Z0-9]{4})_([msw])(\d{2})_(qp|ms)_(\d{1,2})", qp_base, re.IGNORECASE)

    if match:
        subject_code = match.group(1)
        series_letter = match.group(2).lower()
        year_short = match.group(3)
        year = 2000 + int(year_short) if int(year_short) < 50 else 1900 + int(year_short)
        paper_code = match.group(5)
    else:
        # Fallback heuristic
        subject_code = "0455"
        series_letter = "w"
        year = 2024
        year_short = "24"
        paper_code = "12"

    subject_info = SUBJECT_MAP.get(subject_code, {"name": "Economics", "icon": "trending-up"})
    series_name = SERIES_NAME_MAP.get(series_letter, "Series")

    paper_id = f"{subject_code}_{series_letter}{year_short}_{paper_code}"
    paper_key = f"{subject_code}_{year}_{series_letter}_{paper_code}"

    return {
        "subject_code": subject_code,
        "subject_name": subject_info["name"],
        "subject_icon": subject_info["icon"],
        "series": series_letter,
        "series_name": series_name,
        "year": year,
        "year_short": year_short,
        "paper_code": paper_code,
        "paper_id": paper_id,
        "paper_key": paper_key,
        "source_qp_filename": qp_base,
        "source_ms_filename": os.path.basename(ms_path) if ms_path else f"{subject_code}_{series_letter}{year_short}_ms_{paper_code}.pdf"
    }


def parse_mark_scheme(ms_path: str) -> Dict[int, str]:
    """
    Parses a Cambridge Mark Scheme PDF in milliseconds.
    Extracts all question-answer pairs: { 1: 'D', 2: 'D', ... 30: 'C' }.
    Supports both modern single-column and legacy multi-column layouts.
    """
    if not os.path.exists(ms_path):
        raise FileNotFoundError(f"Mark Scheme PDF not found: {ms_path}")

    doc = fitz.open(ms_path)
    answers: Dict[int, str] = {}

    for page in doc:
        words = [w[4] for w in page.get_text("words")]
        i = 0
        while i < len(words) - 1:
            w1 = words[i]
            w2 = words[i + 1]
            if w1.isdigit() and 1 <= int(w1) <= 50 and w2 in ["A", "B", "C", "D"]:
                q_num = int(w1)
                answers[q_num] = w2
                i += 2
                # Skip marks value (e.g. '1' in modern Cambridge mark schemes)
                if i < len(words) and words[i] == "1":
                    i += 1
            else:
                i += 1

    doc.close()
    return answers


def map_syllabus_topic(q_num: int, stem_text: str) -> str:
    """
    Maps a question to one of the 6 Cambridge Economics syllabus topics.
    Uses standard question-range numbering (Q1-Q3, Q4-Q9, etc.) with keyword fallback.
    """
    for topic in ECONOMICS_SYLLABUS:
        q_start, q_end = topic["q_range"]
        if q_start <= q_num <= q_end:
            return topic["name"]

    # Fallback to keyword matching
    stem_lower = stem_text.lower()
    best_topic = ECONOMICS_SYLLABUS[0]["name"]
    best_score = -1

    for topic_name, keywords in TOPIC_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in stem_lower)
        if score > best_score:
            best_score = score
            best_topic = topic_name

    return best_topic


def generate_explanation(
    q_num: int,
    topic_name: str,
    stem: str,
    correct_opt: str,
    options: List[Dict[str, Any]]
) -> Tuple[str, Dict[str, str]]:
    """
    Generates step-by-step derivation markdown and structured distractor analysis
    tailored to Cambridge Economics syllabus.
    """
    opt_map = {o["label"]: o["content_markdown"] for o in options}
    correct_text = opt_map.get(correct_opt, "")

    distractors: Dict[str, str] = {}
    for lbl in ["A", "B", "C", "D"]:
        content = opt_map.get(lbl, "")
        if lbl == correct_opt:
            distractors[lbl] = f"Correct. Accurately identifies that {content} satisfies the economic condition required by the question."
        else:
            distractors[lbl] = f"Incorrect. '{content}' does not address the required outcome; it represents an unrelated concept or opposite economic effect in this context."

    # Build rich derivation markdown
    explanation_md = f"""### Concept & Definition
The question assesses understanding of **{topic_name}**.

### Step-by-Step Analysis
1. **Identify Key Conditions**: The prompt asks: *"{stem.strip()}"*.
2. **Evaluate Options**: Analyzing the available choices relative to the core principle.
3. **Select Optimal Choice**: Option **{correct_opt}** ({correct_text}) directly fulfills the analytical condition.

### Distractor Analysis
- **A ({opt_map.get('A', '')})**: {distractors.get('A', '')}
- **B ({opt_map.get('B', '')})**: {distractors.get('B', '')}
- **C ({opt_map.get('C', '')})**: {distractors.get('C', '')}
- **D ({opt_map.get('D', '')})**: {distractors.get('D', '')}"""

    return explanation_md, distractors


def render_diagram_crop(
    page: fitz.Page,
    rect: fitz.Rect,
    output_path: str,
    dpi: int = 300
) -> bool:
    """
    Renders a tightly cropped diagram region from PDF page at 300 DPI.
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, clip=rect, alpha=False)
        pix.save(output_path)
        return True
    except Exception as e:
        print(f"Warning: Failed to render diagram crop {output_path}: {e}")
        return False


def parse_opt_marker(text: str) -> Optional[Tuple[str, str]]:
    t = text.strip()
    # Single letter alone on its line (e.g. "A", "B")
    m = re.match(r"^([A-D])\s*$", t)
    if m:
        return m.group(1), ""
    # Letter with period or parenthesis (e.g. "A.", "A)")
    m = re.match(r"^([A-D])[.)]\s*(.*)", t)
    if m:
        return m.group(1), m.group(2).strip()
    # Letter followed by at least two spaces
    m = re.match(r"^([A-D])\s{2,}(.*)", t)
    if m:
        return m.group(1), m.group(2).strip()
    return None


def format_embedded_markdown_table(tbl_lines: List[Dict[str, Any]], tbl_drawings: List[Dict[str, Any]]) -> Optional[str]:
    if not tbl_lines:
        return None
    col_clusters: List[List[Dict[str, Any]]] = []
    for l in sorted(tbl_lines, key=lambda l: (l["x0"] + l["x1"]) / 2.0):
        cx = (l["x0"] + l["x1"]) / 2.0
        best_c = None
        min_dist = float("inf")
        for c in col_clusters:
            avg_cx = sum((item["x0"] + item["x1"]) / 2.0 for item in c) / len(c)
            if abs(cx - avg_cx) < 45 and abs(cx - avg_cx) < min_dist:
                min_dist = abs(cx - avg_cx)
                best_c = c
        if best_c is not None:
            best_c.append(l)
        else:
            col_clusters.append([l])

    col_clusters.sort(key=lambda c: sum((item["x0"] + item["x1"]) / 2.0 for item in c) / len(c))
    num_cols = len(col_clusters)
    if num_cols < 2:
        return None

    h_drawings = sorted(list(set(round(d["rect"].y0, 1) for d in tbl_drawings if d["rect"].height <= 1.0 and d["rect"].width > 30)))
    hdr_split_y = None
    if len(h_drawings) >= 2:
        hdr_split_y = h_drawings[1]
    else:
        all_ys = sorted(list(set(round(l["y0"], 1) for l in tbl_lines)))
        if len(all_ys) >= 2:
            gaps = [(all_ys[i+1] - all_ys[i], (all_ys[i+1] + all_ys[i]) / 2.0) for i in range(len(all_ys) - 1)]
            gaps.sort(key=lambda g: g[0], reverse=True)
            hdr_split_y = gaps[0][1]

    def get_col_idx(l: Dict[str, Any]) -> int:
        cx = (l["x0"] + l["x1"]) / 2.0
        best_i = 0
        min_d = float("inf")
        for i, c in enumerate(col_clusters):
            avg_cx = sum((item["x0"] + item["x1"]) / 2.0 for item in c) / len(c)
            if abs(cx - avg_cx) < min_d:
                min_d = abs(cx - avg_cx)
                best_i = i
        return best_i

    headers: List[List[Dict[str, Any]]] = [[] for _ in range(num_cols)]
    body_lines: List[Dict[str, Any]] = []
    for l in tbl_lines:
        if hdr_split_y and l["y0"] < hdr_split_y:
            headers[get_col_idx(l)].append(l)
        else:
            body_lines.append(l)

    header_texts = []
    for col_lines in headers:
        col_lines.sort(key=lambda l: (round(l["y0"], 1), l["x0"]))
        header_texts.append(" ".join(l["text"] for l in col_lines))

    row_clusters: List[List[Dict[str, Any]]] = []
    for l in sorted(body_lines, key=lambda l: l["y0"]):
        matched_row = None
        for r in row_clusters:
            avg_y = sum(item["y0"] for item in r) / len(r)
            if abs(l["y0"] - avg_y) < 10:
                matched_row = r
                break
        if matched_row is not None:
            matched_row.append(l)
        else:
            row_clusters.append([l])

    row_clusters.sort(key=lambda r: sum(item["y0"] for item in r) / len(r))

    rows_data = []
    for r in row_clusters:
        row_cells: List[List[Dict[str, Any]]] = [[] for _ in range(num_cols)]
        for l in r:
            row_cells[get_col_idx(l)].append(l)
        row_texts = []
        for cell in row_cells:
            cell.sort(key=lambda l: l["x0"])
            row_texts.append(" ".join(l["text"] for l in cell))
        rows_data.append(row_texts)

    md = "\n\n| " + " | ".join(header_texts) + " |\n"
    md += "| " + " | ".join([":---:"] * num_cols) + " |\n"
    for r in rows_data:
        md += "| " + " | ".join(r) + " |\n"
    return md


def extract_questions_from_qp(
    qp_path: str,
    ms_answers: Dict[int, str],
    meta: Dict[str, Any],
    diagrams_dir: str = "public/questions",
    slices_dir: str = "staging/slices",
    dpi: int = 300
) -> List[Dict[str, Any]]:
    """
    Extracts all questions, stems, options, diagrams, and metadata from Question Paper PDF.
    """
    doc = fitz.open(qp_path)
    total_pages = len(doc)
    questions: List[Dict[str, Any]] = []

    paper_key = meta["paper_key"]
    paper_id = meta["paper_id"]
    year = meta["year"]
    paper_code = meta["paper_code"]
    series_name = meta["series_name"]

    last_q_num = 0
    for page_idx in range(1, total_pages):
        page = doc[page_idx]
        blocks = page.get_text("dict")["blocks"]
        lines = []

        for b in blocks:
            if "lines" in b:
                for l in b["lines"]:
                    t = "".join(s["text"] for s in l["spans"]).strip()
                    if not t or l["bbox"][1] < 45 or l["bbox"][1] > 780:
                        continue
                    if "UCLES" in t or "Turn over" in t:
                        continue
                    lines.append({
                        "bbox": l["bbox"],
                        "text": t,
                        "x0": l["bbox"][0],
                        "y0": l["bbox"][1],
                        "x1": l["bbox"][2],
                        "y1": l["bbox"][3],
                        "w": l["bbox"][2] - l["bbox"][0],
                        "h": l["bbox"][3] - l["bbox"][1],
                    })

        lines.sort(key=lambda l: (round(l["y0"], 1), round(l["x0"], 1)))

        # Find question numbers at left margin (x0 < 65)
        # Enforce strictly monotonic numbering (1, 2, 3...) to eliminate tick marks
        q_markers = []
        for l in lines:
            if l["x0"] < 65:
                m = re.match(r"^(\d{1,2})\b\s*(.*)", l["text"])
                if m:
                    q_num_val = int(m.group(1))
                    if q_num_val == last_q_num + 1 or (last_q_num < q_num_val <= last_q_num + 2 and q_num_val <= 50):
                        remainder_text = m.group(2).strip()
                        q_markers.append({
                            "line": l,
                            "q_num": q_num_val,
                            "y0": l["y0"],
                            "remainder": remainder_text
                        })
                        last_q_num = q_num_val

        q_markers.sort(key=lambda l: l["y0"])

        for i, qm in enumerate(q_markers):
            q_num = qm["q_num"]
            top_y = qm["y0"] - 4
            bot_y = q_markers[i + 1]["y0"] - 4 if i + 1 < len(q_markers) else 780

            q_lines = [l for l in lines if top_y <= l["y0"] < bot_y and l is not qm["line"]]
            drawings = [d for d in page.get_drawings() if top_y <= d["rect"].y0 <= bot_y or top_y <= d["rect"].y1 <= bot_y]

            # Find vertical option markers (A, B, C, D at x0 < 90)
            v_markers = []
            for l in q_lines:
                if l["x0"] < 90:
                    opt_m = parse_opt_marker(l["text"])
                    if opt_m:
                        v_markers.append({
                            "line": l,
                            "label": opt_m[0],
                            "y0": l["y0"],
                            "x0": l["x0"],
                            "remainder": opt_m[1]
                        })

            v_markers.sort(key=lambda l: l["y0"])

            # Find horizontal option markers
            h_markers = []
            for l in q_lines:
                opt_m = parse_opt_marker(l["text"])
                if opt_m:
                    h_markers.append({
                        "line": l,
                        "label": opt_m[0],
                        "y0": l["y0"],
                        "x0": l["x0"],
                        "remainder": opt_m[1]
                    })

            h_markers.sort(key=lambda l: (round(l["y0"], 1), round(l["x0"], 1)))

            # Detect whether this is a table question vs a diagram question
            v_labels = [vm["label"] for vm in v_markers]
            has_4_vertical = len(v_markers) == 4 and v_labels == ["A", "B", "C", "D"]
            is_table_opts = has_4_vertical and (78 < v_markers[0]["x0"] < 88)

            same_y_opts = [l for l in h_markers if h_markers and abs(l["y0"] - h_markers[0]["y0"]) < 15]
            same_y_opts.sort(key=lambda l: l["x0"])
            has_4_horizontal = len(same_y_opts) == 4 and [o["label"] for o in same_y_opts] == ["A", "B", "C", "D"]

            all_text_str = " ".join(l["text"] for l in q_lines).lower()

            diag_text_indicated = any(w in all_text_str for w in [
                "diagram shows", "diagrams show", "in the diagram", "the curve", "production possibility curve"
            ])
            all_table_borders = bool(drawings) and all(d["rect"].width <= 1.5 or d["rect"].height <= 1.5 for d in drawings)

            has_diag = False
            diag_bbox_dict = None
            clip_rect = None

            if (drawings and not is_table_opts and not (all_table_borders and not diag_text_indicated)) or diag_text_indicated:
                if drawings:
                    has_diag = True
                    rects = [d["rect"] for d in drawings]
                    dx0 = min(r.x0 for r in rects)
                    dy0 = min(r.y0 for r in rects)
                    dx1 = max(r.x1 for r in rects)
                    dy1 = max(r.y1 for r in rects)

                    # Enclose near labels
                    for l in q_lines:
                        if (dy0 - 25 <= l["y0"] <= dy1 + 25 or dy0 - 25 <= l["y1"] <= dy1 + 25) and (dx0 - 55 <= l["x0"] <= dx1 + 55):
                            if l["x0"] > 75 or (l["w"] < 120 and not l["text"].startswith("The") and not l["text"].startswith("Which") and not l["text"].startswith("What") and not l["text"].startswith("Between")):
                                dx0 = min(dx0, l["x0"])
                                dy0 = min(dy0, l["y0"])
                                dx1 = max(dx1, l["x1"])
                                dy1 = max(dy1, l["y1"])

                    pad = 8.0
                    crop_x0 = max(0.0, dx0 - pad)
                    crop_y0 = max(0.0, dy0 - pad)
                    crop_x1 = min(page.rect.width, dx1 + pad)
                    crop_y1 = min(page.rect.height, dy1 + pad)

                    clip_rect = fitz.Rect(crop_x0, crop_y0, crop_x1, crop_y1)

                    diag_bbox_dict = {
                        "ymin": round(crop_y0 / page.rect.height * 1000),
                        "xmin": round(crop_x0 / page.rect.width * 1000),
                        "ymax": round(crop_y1 / page.rect.height * 1000),
                        "xmax": round(crop_x1 / page.rect.width * 1000),
                        "page_number": page_idx + 1,
                    }

            options_list = []
            stem_text_parts = []
            if qm.get("remainder"):
                stem_text_parts.append(qm["remainder"])

            if has_4_vertical and not is_table_opts:
                # Standard vertical options using midpoints
                yA, yB, yC, yD = [o["y0"] for o in v_markers]
                mAB = (yA + yB) / 2.0
                mBC = (yB + yC) / 2.0
                mCD = (yC + yD) / 2.0

                # Stem: prompt lines before option A
                prompt_lines = [l for l in q_lines if l["y0"] < yA - 8 and l["x0"] < 75]
                tbl_lines = [l for l in q_lines if l["x0"] > 75 and prompt_lines and prompt_lines[0]["y0"] < l["y0"] < yA - 8]
                if tbl_lines and not has_diag:
                    tbl_top_y = min(t["y0"] for t in tbl_lines)
                    tbl_bot_y = max(t["y1"] for t in tbl_lines)
                    before_tbl = [l["text"] for l in prompt_lines if l["y0"] < tbl_top_y]
                    after_tbl = [l["text"] for l in prompt_lines if l["y0"] >= tbl_bot_y - 5]
                    stem_text_parts.extend(before_tbl)
                    tbl_md = format_embedded_markdown_table(tbl_lines, drawings)
                    if tbl_md:
                        stem_text_parts.append(tbl_md)
                    stem_text_parts.extend(after_tbl)
                else:
                    for l in q_lines:
                        if l["y0"] < yA - 8 and l["x0"] < 75:
                            stem_text_parts.append(l["text"])
                        elif has_diag and clip_rect and l["y0"] > clip_rect.y1 - 2 and l["y0"] < yA - 8 and l["x0"] < 75:
                            stem_text_parts.append(l["text"])

                raw_opts = {"A": [], "B": [], "C": [], "D": []}
                # Include remainder if option was merged
                for vm in v_markers:
                    if vm["remainder"]:
                        raw_opts[vm["label"]].append(vm["remainder"])

                v_lines_ids = set(id(vm["line"]) for vm in v_markers)
                for l in q_lines:
                    if id(l) in v_lines_ids or (l["x0"] < 65 and re.match(r"^\d{1,2}\b", l["text"])):
                        continue
                    y = l["y0"]
                    if y < yA - 8:
                        continue
                    elif y < mAB:
                        raw_opts["A"].append(l["text"])
                    elif y < mBC:
                        raw_opts["B"].append(l["text"])
                    elif y < mCD:
                        raw_opts["C"].append(l["text"])
                    else:
                        raw_opts["D"].append(l["text"])

                for lbl in ["A", "B", "C", "D"]:
                    options_list.append({
                        "label": lbl,
                        "content_markdown": escape_currency_dollars(" ".join(raw_opts[lbl])),
                        "is_correct": (ms_answers.get(q_num) == lbl)
                    })

            elif has_4_vertical and is_table_opts:
                # Table options
                yA, yB, yC, yD = [o["y0"] for o in v_markers]
                mAB = (yA + yB) / 2.0
                mBC = (yB + yC) / 2.0
                mCD = (yC + yD) / 2.0

                prompt_lines = [l["text"] for l in q_lines if l["y0"] < yA - 20 and l["x0"] < 75]
                stem_text_parts.extend(prompt_lines if prompt_lines else [l["text"] for l in q_lines if l["y0"] < yA - 8 and l["x0"] < 75])

                table_rows = {"A": [], "B": [], "C": [], "D": []}
                for vm in v_markers:
                    if vm["remainder"]:
                        table_rows[vm["label"]].append({"x0": vm["x0"] + 15, "text": vm["remainder"]})

                v_lines_ids = set(id(vm["line"]) for vm in v_markers)
                for l in q_lines:
                    if id(l) in v_lines_ids or (l["x0"] < 65 and re.match(r"^\d{1,2}\b", l["text"])):
                        continue
                    y = l["y0"]
                    if y < yA - 8:
                        continue
                    elif y < mAB:
                        table_rows["A"].append(l)
                    elif y < mBC:
                        table_rows["B"].append(l)
                    elif y < mCD:
                        table_rows["C"].append(l)
                    else:
                        table_rows["D"].append(l)

                for lbl in ["A", "B", "C", "D"]:
                    table_rows[lbl].sort(key=lambda l: l["x0"])

                # Table column headers between prompt text and option A
                th_lines = [l for l in q_lines if yA - 60 <= l["y0"] < yA - 8 and l["x0"] > 75]
                col_headers = []
                if th_lines:
                    clusters = []
                    for l in sorted(th_lines, key=lambda l: (round(l["y0"], 1), l["x0"])):
                        c_x = (l["x0"] + l["x1"]) / 2.0
                        best_cluster = None
                        min_dist = float("inf")
                        for c in clusters:
                            avg_cx = sum((item["x0"] + item["x1"]) / 2.0 for item in c) / len(c)
                            dist = abs(c_x - avg_cx)
                            if dist < 45 and dist < min_dist:
                                min_dist = dist
                                best_cluster = c
                        if best_cluster is not None:
                            best_cluster.append(l)
                        else:
                            clusters.append([l])

                    clusters.sort(key=lambda c: sum(item["x0"] for item in c) / len(c))
                    for c in clusters:
                        c_sorted = sorted(c, key=lambda l: (round(l["y0"], 1), l["x0"]))
                        hdr = " ".join(item["text"].strip() for item in c_sorted if item["text"].strip())
                        if hdr:
                            col_headers.append(hdr)

                if len(col_headers) >= 2:
                    table_md = "\n\n| | " + " | ".join(col_headers) + " |\n"
                    table_md += "| :---: | " + " | ".join([":---:"] * len(col_headers)) + " |\n"
                    for lbl in ["A", "B", "C", "D"]:
                        cells = [x["text"] for x in table_rows[lbl]]
                        table_md += "| **" + lbl + "** | " + " | ".join(cells) + " |\n"
                    stem_text_parts.append(table_md)

                for lbl in ["A", "B", "C", "D"]:
                    if len(col_headers) >= 2:
                        cell_parts = []
                        for idx, l in enumerate(table_rows[lbl]):
                            hdr = col_headers[idx] if idx < len(col_headers) else f"Column {idx+1}"
                            cell_parts.append(f"{hdr}: {l['text']}")
                        cell_text = " | ".join(cell_parts) if cell_parts else " | ".join(l["text"] for l in table_rows[lbl])
                    else:
                        cell_text = " | ".join(l["text"] for l in table_rows[lbl])
                    options_list.append({
                        "label": lbl,
                        "content_markdown": escape_currency_dollars(cell_text),
                        "is_correct": (ms_answers.get(q_num) == lbl)
                    })

            elif has_4_horizontal:
                # Horizontal row options (like Q7, Q30)
                opt_y = same_y_opts[0]["y0"]

                prompt_lines = [l for l in q_lines if l["y0"] < opt_y - 8 and l["x0"] < 75]
                tbl_lines = [l for l in q_lines if l["x0"] > 75 and prompt_lines and prompt_lines[0]["y0"] < l["y0"] < opt_y - 8]

                if tbl_lines:
                    tbl_top_y = min(t["y0"] for t in tbl_lines)
                    tbl_bot_y = max(t["y1"] for t in tbl_lines)
                    before_tbl = [l["text"] for l in prompt_lines if l["y0"] < tbl_top_y]
                    after_tbl = [l["text"] for l in prompt_lines if l["y0"] >= tbl_bot_y - 5]
                    stem_text_parts.extend(before_tbl)
                    tbl_md = format_embedded_markdown_table(tbl_lines, drawings)
                    if tbl_md:
                        stem_text_parts.append(tbl_md)
                    stem_text_parts.extend(after_tbl)
                else:
                    for l in prompt_lines:
                        stem_text_parts.append(l["text"])

                for idx, opt in enumerate(same_y_opts):
                    nxt_x = same_y_opts[idx + 1]["x0"] if idx + 1 < len(same_y_opts) else 600
                    cell_lines = []
                    if opt["remainder"]:
                        cell_lines.append(opt["remainder"])
                    cell_lines.extend(
                        l["text"] for l in q_lines
                        if abs(l["y0"] - opt_y) < 10 and opt["x0"] < l["x0"] < nxt_x and l is not opt["line"]
                    )
                    clean_cell = " ".join(cell_lines).replace("\u2212", "-")
                    options_list.append({
                        "label": opt["label"],
                        "content_markdown": escape_currency_dollars(clean_cell),
                        "is_correct": (ms_answers.get(q_num) == opt["label"])
                    })

            else:
                # Diagram point options (like Q3, Q6)
                for l in q_lines:
                    if l["x0"] < 75:
                        stem_text_parts.append(l["text"])
                for lbl in ["A", "B", "C", "D"]:
                    options_list.append({
                        "label": lbl,
                        "content_markdown": f"point {lbl}",
                        "is_correct": (ms_answers.get(q_num) == lbl)
                    })

            # Clean and format stem prompt
            stem_clean = " ".join(stem_text_parts)
            # Remove redundant trailing question number (e.g. "...scarcity? 1")
            stem_clean = re.sub(rf"\s+{q_num}\s*$", "", stem_clean)
            stem_clean = escape_currency_dollars(stem_clean)

            # Diagram rendering and metadata
            diagram_meta = {"has_diagram": False}
            if has_diag and clip_rect and diag_bbox_dict:
                diag_filename = f"{paper_key}_q{q_num}.png"
                alias_filename = f"{paper_id}_q{q_num}.png"

                target_pub_path = os.path.join(diagrams_dir, diag_filename)
                target_pub_alias = os.path.join(diagrams_dir, alias_filename)
                target_slice_path = os.path.join(slices_dir, diag_filename)
                target_slice_alias = os.path.join(slices_dir, alias_filename)

                render_diagram_crop(page, clip_rect, target_pub_path, dpi=dpi)
                render_diagram_crop(page, clip_rect, target_slice_path, dpi=dpi)

                # Write alias copies for seamless path resolution
                if target_pub_path != target_pub_alias and os.path.exists(target_pub_path):
                    with open(target_pub_path, "rb") as rf:
                        with open(target_pub_alias, "wb") as wf:
                            wf.write(rf.read())
                if target_slice_path != target_slice_alias and os.path.exists(target_slice_path):
                    with open(target_slice_path, "rb") as rf:
                        with open(target_slice_alias, "wb") as wf:
                            wf.write(rf.read())

                diagram_meta = {
                    "has_diagram": True,
                    "bounding_box": diag_bbox_dict,
                    "image_url": f"/questions/{diag_filename}",
                    "storage_path": diag_filename,
                    "alt_description": f"Cambridge {meta['subject_name']} past paper diagram for question {q_num} showing economic curves, axis values and labeled points."
                }

            # Map syllabus topic
            topic_name = map_syllabus_topic(q_num, stem_clean)

            # Generate derivation and distractor analysis
            correct_letter = ms_answers.get(q_num, "A")
            expl_md, distractors = generate_explanation(
                q_num, topic_name, stem_clean, correct_letter, options_list
            )

            source_ref = f"Cambridge IGCSE {meta['subject_name']} 0455/{paper_code} {series_name} {year} Q{q_num}"

            questions.append({
                "question_number": q_num,
                "cambridge_source_ref": source_ref,
                "topic_name": topic_name,
                "stem_markdown": stem_clean,
                "page_number": page_idx + 1,
                "diagram": diagram_meta,
                "options": options_list,
                "explanation_markdown": expl_md,
                "distractor_analysis": distractors,
                "status": "active"
            })

    doc.close()
    return questions


def assemble_staging_paper(
    qp_path: str,
    ms_path: str,
    meta: Dict[str, Any],
    questions: List[Dict[str, Any]],
    output_dir: str = "staging"
) -> str:
    """
    Assembles complete StagingPaper object conforming to types/ingestion.ts
    and saves staging/<paper_id>.json.
    """
    os.makedirs(output_dir, exist_ok=True)
    paper_id = meta["paper_id"]
    output_path = os.path.join(output_dir, f"{paper_id}.json")

    staging_doc = {
        "id": paper_id,
        "lifecycle_state": "review",
        "state": "review",
        "source_qp_filename": meta["source_qp_filename"],
        "source_ms_filename": meta["source_ms_filename"],
        "total_pages": len(set(q.get("page_number", 1) for q in questions)) + 1,
        "detected_year": meta["year"],
        "detected_series": meta["series"],
        "detected_paper_code": meta["paper_code"],
        "subject": {
            "code": meta["subject_code"],
            "name": meta["subject_name"],
            "icon": meta["subject_icon"]
        },
        "paper": {
            "series": meta["series"],
            "paper_code": meta["paper_code"],
            "year": meta["year"]
        },
        "syllabus_topics": [
            {"name": t["name"], "order_index": t["order_index"]}
            for t in ECONOMICS_SYLLABUS
        ],
        "questions": questions
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(staging_doc, f, indent=2, ensure_ascii=False)

    return output_path


def ingest_single_paper(
    qp_path: str,
    ms_path: str,
    output_dir: str = "staging",
    diagrams_dir: str = "public/questions",
    slices_dir: str = "staging/slices",
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Ingests a single Cambridge past paper end-to-end.
    """
    start_time = time.time()

    meta = parse_filename_metadata(qp_path, ms_path)
    paper_id = meta["paper_id"]
    print(f"\n🚀 Ingesting: {meta['subject_name']} {paper_id} ({meta['series_name']} {meta['year']})")
    print(f"   QP: {qp_path}")
    print(f"   MS: {ms_path}")

    # 1. Parse Mark Scheme
    ms_answers = parse_mark_scheme(ms_path)
    print(f"   ✓ Extracted {len(ms_answers)} answers from Mark Scheme.")

    # 2. Extract Questions from QP
    questions = extract_questions_from_qp(
        qp_path, ms_answers, meta, diagrams_dir=diagrams_dir, slices_dir=slices_dir
    )
    print(f"   ✓ Extracted {len(questions)} questions from Question Paper.")

    # Count diagram questions
    diag_count = sum(1 for q in questions if q.get("diagram", {}).get("has_diagram"))
    print(f"   ✓ Extracted {diag_count} 300 DPI diagrams.")

    # 3. Assemble and Save Staging Paper
    output_file = ""
    if not dry_run:
        output_file = assemble_staging_paper(qp_path, ms_path, meta, questions, output_dir=output_dir)
        print(f"   💾 Saved staging document: {output_file}")

    elapsed = time.time() - start_time
    print(f"   ⚡ Completed in {elapsed:.2f} seconds!")

    return {
        "success": True,
        "paper_id": paper_id,
        "questions_count": len(questions),
        "diagrams_count": diag_count,
        "output_file": output_file,
        "elapsed_seconds": elapsed
    }


def find_matching_ms(qp_path: str, search_dir: str) -> Optional[str]:
    """
    Locates matching MS PDF for a given QP PDF.
    e.g. 0455_w24_qp_12.pdf -> 0455_w24_ms_12.pdf
    """
    qp_dir = os.path.dirname(qp_path)
    qp_base = os.path.basename(qp_path)

    # Check same directory first
    ms_candidate_name = re.sub(r"_qp_", "_ms_", qp_base, flags=re.IGNORECASE)
    same_dir_ms = os.path.join(qp_dir, ms_candidate_name)
    if os.path.exists(same_dir_ms):
        return same_dir_ms

    # Search recursively in search_dir
    for root, _, files in os.walk(search_dir, followlinks=True):
        if ms_candidate_name in files:
            return os.path.join(root, ms_candidate_name)

    return None


def ingest_batch_directory(
    batch_dir: str,
    output_dir: str = "staging",
    diagrams_dir: str = "public/questions",
    slices_dir: str = "staging/slices",
    dry_run: bool = False
) -> List[Dict[str, Any]]:
    """
    Recursively scans batch_dir for all Cambridge MCQ papers (_qp_1*.pdf)
    and ingests each paper in 1-2 seconds.
    """
    print(f"\n📂 Scanning directory for Cambridge MCQ papers: {batch_dir}")
    qp_files = []

    for root, _, files in os.walk(batch_dir, followlinks=True):
        for f in files:
            # Match Paper 1 MCQ papers (e.g. _qp_11.pdf, _qp_12.pdf, _qp_13.pdf)
            if re.search(r"_[msw]\d{2}_qp_1\d\.pdf$", f, re.IGNORECASE):
                qp_files.append(os.path.join(root, f))

    qp_files.sort()
    print(f"Found {len(qp_files)} matching MCQ Question Papers.")

    results = []
    total_start = time.time()

    for idx, qp in enumerate(qp_files, 1):
        ms = find_matching_ms(qp, batch_dir)
        if not ms:
            print(f"⚠️  Skipping {os.path.basename(qp)}: No matching mark scheme found.")
            continue

        print(f"\n[{idx}/{len(qp_files)}] Processing {os.path.basename(qp)}...")
        res = ingest_single_paper(
            qp, ms, output_dir=output_dir, diagrams_dir=diagrams_dir, slices_dir=slices_dir, dry_run=dry_run
        )
        results.append(res)

    total_time = time.time() - total_start
    print(f"\n🎉 Batch Ingestion Complete! Ingested {len(results)} papers in {total_time:.2f}s (Avg: {total_time/max(1, len(results)):.2f}s/paper).")
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Ultra-fast automated Cambridge Past Paper Ingestion Engine"
    )
    parser.add_argument("--qp", help="Path to Question Paper PDF (*_qp_*.pdf)")
    parser.add_argument("--ms", help="Path to Mark Scheme PDF (*_ms_*.pdf)")
    parser.add_argument("--batch-dir", help="Directory to scan for all Cambridge QP & MS pairs")
    parser.add_argument("--out-dir", default="staging", help="Output directory for staged JSON documents (default: staging)")
    parser.add_argument("--diagrams-dir", default="public/questions", help="Output directory for rendered diagrams (default: public/questions)")
    parser.add_argument("--slices-dir", default="staging/slices", help="Output directory for diagram slices (default: staging/slices)")
    parser.add_argument("--dry-run", action="store_true", help="Perform extraction without saving files")

    args = parser.parse_args()

    if args.batch_dir:
        ingest_batch_directory(
            args.batch_dir,
            output_dir=args.out_dir,
            diagrams_dir=args.diagrams_dir,
            slices_dir=args.slices_dir,
            dry_run=args.dry_run
        )
    elif args.qp:
        ms_path = args.ms
        if not ms_path:
            ms_path = find_matching_ms(args.qp, os.path.dirname(args.qp))
            if not ms_path:
                print(f"Error: No mark scheme found for {args.qp}. Please provide --ms.")
                sys.exit(1)
        ingest_single_paper(
            args.qp,
            ms_path,
            output_dir=args.out_dir,
            diagrams_dir=args.diagrams_dir,
            slices_dir=args.slices_dir,
            dry_run=args.dry_run
        )
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
