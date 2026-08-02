#!/usr/bin/env python3
"""
Extracts every openPdf(...) resource link across the SANHS LR Hub site
into a single searchable JSON database (resources-data.json / .js).

Handles the three link structures found in the site:
  A. Grade/Subject/Quarter grid  (national-k12-g*, national-revised-g*, lambo-grade*)
  B. Folder tree with real filenames (teaching-materials.html)
  C. Flat card list (learning-packets.html, aral-materials.html)

Re-run this any time new resources are added to the source HTML files.
"""
import re
import json
import os
import html

SRC_DIR = "."  # HTML files sit directly in the repo root — change if yours differ

# category metadata: filename -> (category label, page to link back to, grade or None)
FILE_META = {
    "national-k12-g7.html":      ("National K-12 SLM", "National SLMs", 7),
    "national-k12-g8.html":      ("National K-12 SLM", "National SLMs", 8),
    "national-k12-g9.html":      ("National K-12 SLM", "National SLMs", 9),
    "national-k12-g10.html":     ("National K-12 SLM", "National SLMs", 10),
    "national-revised-g7.html":  ("Regional/Division SLM", "Regional/Division SLMs", 7),
    "national-revised-g8.html":  ("Regional/Division SLM", "Regional/Division SLMs", 8),
    "national-revised-g9.html":  ("Regional/Division SLM", "Regional/Division SLMs", 9),
    "national-revised-g10.html": ("Regional/Division SLM", "Regional/Division SLMs", 10),
    "lambo-grade7.html":         ("LAMBO (Learning Activity Sheet)", "LAMBO", 7),
    "lambo-grade8.html":         ("LAMBO (Learning Activity Sheet)", "LAMBO", 8),
    "lambo-grade9.html":         ("LAMBO (Learning Activity Sheet)", "LAMBO", 9),
    "lambo-grade10.html":        ("LAMBO (Learning Activity Sheet)", "LAMBO", 10),
    "teaching-materials.html":   ("Teaching Materials", "Teaching Materials", None),
    "learning-packets.html":     ("Learning Packet", "Learning Packets", None),
    "aral-materials.html":       ("ARAL Materials", "ARAL Materials", None),
}

LINK_RE = re.compile(
    r'<a\s+[^>]*onclick="openPdf\(\s*\'([^\']+)\'\s*,\s*\'([^\']+)\'\s*\)\s*;\s*return\s+false;"[^>]*>(.*?)</a>',
    re.DOTALL
)

def strip_tags(s):
    return re.sub(r'<[^>]+>', ' ', s).strip()

def clean_id_from_drive_url(url):
    m = re.search(r'/d/([a-zA-Z0-9_-]+)', url)
    if m:
        return m.group(1)
    m = re.search(r'id=([a-zA-Z0-9_-]+)', url)
    if m:
        return m.group(1)
    return re.sub(r'[^a-zA-Z0-9_-]', '', url)[:20]

ICON_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F000-\U0001F0FF"
    "]+", flags=re.UNICODE
)

def clean_label(text):
    text = ICON_RE.sub("", text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def find_grade_from_text(text):
    patterns = [
        r'\[?G(?:rade)?\.?\s*(\d{1,2})\]?',
        r'grade\s*(\d{1,2})',
        r'[_\s](\d{1,2})(?:st|nd|rd|th)?\s*grade',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            g = int(m.group(1))
            if 1 <= g <= 12:
                return g
    return None

def extract_grid_style(content, filename, category, category_page, default_grade):
    """Structure A & similar: subject-title / quarter-title / list of <a> links."""
    results = []
    # split on subject-card blocks to keep subject context local
    subject_blocks = re.split(r'(?=<div class="subject-card">)', content)
    for block in subject_blocks:
        subj_m = re.search(r'<div class="subject-title">(.*?)</div>', block, re.DOTALL)
        subject = strip_tags(subj_m.group(1)) if subj_m else "General"
        # split further on quarter-column to keep quarter context local
        quarter_blocks = re.split(r'(?=<div class="quarter-column">)', block)
        for qblock in quarter_blocks:
            q_m = re.search(r'<div class="quarter-title">(.*?)</div>', qblock, re.DOTALL)
            quarter = strip_tags(q_m.group(1)) if q_m else None
            for preview, download, label in LINK_RE.findall(qblock):
                label_clean = clean_label(strip_tags(html.unescape(label)))
                if not label_clean:
                    continue
                title_parts = [subject]
                if quarter:
                    title_parts.append(quarter.replace(" (UNAVAILABLE)", ""))
                title_parts.append(label_clean)
                title = " – ".join(title_parts)
                results.append({
                    "title": title,
                    "subject": subject,
                    "grade": default_grade,
                    "quarter": quarter,
                    "category": category,
                    "categoryPage": category_page,
                    "sourceFile": filename,
                    "previewUrl": preview,
                    "downloadUrl": download,
                })
    return results

def extract_tree_style(content, filename, category, category_page, default_grade):
    """Structure B: nested folders with real filenames (teaching-materials.html)."""
    results = []
    # Walk the file top-to-bottom tracking folder-header stack via a simple state approach:
    # find all folder-header openings/closings and file links in document order.
    token_re = re.compile(
        r'(?P<folder><div class="folder-header"[^>]*>(?:(?!</div>).)*</div>)'
        r'|(?P<link><a\s+class="file"[^>]*onclick="openPdf\(\s*\'([^\']+)\'\s*,\s*\'([^\']+)\'\s*\)\s*;\s*return\s+false;"[^>]*>(.*?)</a>)'
        r'|(?P<open><div class="folder">)'
        r'|(?P<close></div>)',
        re.DOTALL
    )
    stack = []
    depth_stack = []  # track depth at each folder push using div-open/close counting is unreliable with regex;
    # Simpler & robust fallback: use nearest-preceding folder-header text (last seen) as the subject/category context.
    last_folder = None
    for m in re.finditer(
        r'<div class="folder-header"[^>]*>.*?</div>|'
        r'<a\s+class="file"[^>]*onclick="openPdf\(\s*\'([^\']+)\'\s*,\s*\'([^\']+)\'\s*\)\s*;\s*return\s+false;"[^>]*>(.*?)</a>',
        content, re.DOTALL
    ):
        chunk = m.group(0)
        if chunk.startswith('<div class="folder-header"'):
            last_folder = clean_label(strip_tags(html.unescape(chunk)))
            last_folder = re.sub(r'^[▶▼\s]*', '', last_folder).strip()
        else:
            preview, download, label = m.group(1), m.group(2), m.group(3)
            label_clean = clean_label(strip_tags(html.unescape(label)))
            if not label_clean:
                continue
            grade = find_grade_from_text(label_clean) or find_grade_from_text(last_folder or "") or default_grade
            subject = last_folder or "General"
            title = f"{subject} – {label_clean}" if subject else label_clean
            results.append({
                "title": title,
                "subject": subject,
                "grade": grade,
                "quarter": None,
                "category": category,
                "categoryPage": category_page,
                "sourceFile": filename,
                "previewUrl": preview,
                "downloadUrl": download,
            })
    return results

def extract_card_style(content, filename, category, category_page, default_grade):
    """Structure C: flat <div class="card">Label: <a>Access</a></div>"""
    results = []
    for card_m in re.finditer(r'<div class="card">(.*?)</div>\s*(?=<div class="card">|</div>\s*</div>)', content, re.DOTALL):
        card = card_m.group(1)
        link_m = re.search(
            r'onclick="openPdf\(\s*\'([^\']+)\'\s*,\s*\'([^\']+)\'\s*\)\s*;\s*return\s+false;"[^>]*>(.*?)</a>',
            card, re.DOTALL
        )
        if not link_m:
            continue
        preview, download, linktext = link_m.groups()
        label = clean_label(strip_tags(html.unescape(card.split("<a")[0])))
        label = label.strip(" :\n\t")
        if not label:
            label = clean_label(strip_tags(html.unescape(linktext)))
        grade = find_grade_from_text(label) or default_grade
        results.append({
            "title": label,
            "subject": None,
            "grade": grade,
            "quarter": None,
            "category": category,
            "categoryPage": category_page,
            "sourceFile": filename,
            "previewUrl": preview,
            "downloadUrl": download,
        })
    return results

def main():
    all_resources = []
    seen_ids = {}
    for filename, (category, category_page, default_grade) in FILE_META.items():
        path = os.path.join(SRC_DIR, filename)
        if not os.path.exists(path):
            print(f"  ! missing {filename}")
            continue
        content = open(path, encoding="utf-8", errors="ignore").read()

        if filename == "teaching-materials.html":
            items = extract_tree_style(content, filename, category, category_page, default_grade)
        elif filename in ("learning-packets.html", "aral-materials.html"):
            items = extract_card_style(content, filename, category, category_page, default_grade)
        else:
            items = extract_grid_style(content, filename, category, category_page, default_grade)

        print(f"{filename}: {len(items)} resources")
        all_resources.extend(items)

    # assign stable unique IDs based on the google drive file id (dedupe-safe, stable across re-runs)
    for r in all_resources:
        base_id = clean_id_from_drive_url(r["downloadUrl"] or r["previewUrl"])
        rid = base_id
        n = 2
        while rid in seen_ids:
            rid = f"{base_id}-{n}"
            n += 1
        seen_ids[rid] = True
        r["id"] = rid
        # dateAdded left null for legacy/backfilled resources.
        # New resources added going forward should set this (YYYY-MM-DD) so the
        # "Recently Added" badge on search.html can pick them up.
        r["dateAdded"] = None

    print(f"\nTOTAL resources extracted: {len(all_resources)}")

    with open("resources-data.json", "w", encoding="utf-8") as f:
        json.dump(all_resources, f, ensure_ascii=False, indent=1)

    with open("resources-data.js", "w", encoding="utf-8") as f:
        f.write("// Auto-generated by extract_resources.py — do not hand-edit.\n")
        f.write("// Re-run the script after adding new resource pages/links.\n")
        f.write("const SANHS_RESOURCES = ")
        json.dump(all_resources, f, ensure_ascii=False)
        f.write(";\n")

if __name__ == "__main__":
    main()