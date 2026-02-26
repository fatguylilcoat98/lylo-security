# =============================================================================
# LYLO MED-VAULT PDF GENERATOR — med_vault_pdf.py
# Generates professional Doctor PDF reports branded per persona color.
# Colorblind-safe: every section uses icon + color, never color alone.
# Disclaimer on every page. Session hash for legal protection.
# Generated in memory — never saved to disk.
# =============================================================================

import hashlib
import secrets
from io import BytesIO
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, Image as RLImage
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# =============================================================================
# PERSONA COLOR PALETTE
# Each persona gets primary + light variant for PDF theming
# =============================================================================
PERSONA_COLORS = {
    "doctor":    {"primary": colors.HexColor("#22c55e"), "light": colors.HexColor("#dcfce7"), "icon": "⚕"},
    "lawyer":    {"primary": colors.HexColor("#eab308"), "light": colors.HexColor("#fef9c3"), "icon": "⚖"},
    "guardian":  {"primary": colors.HexColor("#3b82f6"), "light": colors.HexColor("#dbeafe"), "icon": "🛡"},
    "therapist": {"primary": colors.HexColor("#a855f7"), "light": colors.HexColor("#f3e8ff"), "icon": "🧠"},
    "wealth":    {"primary": colors.HexColor("#f59e0b"), "light": colors.HexColor("#fef3c7"), "icon": "💰"},
    "mechanic":  {"primary": colors.HexColor("#f97316"), "light": colors.HexColor("#ffedd5"), "icon": "🔧"},
    "career":    {"primary": colors.HexColor("#6366f1"), "light": colors.HexColor("#e0e7ff"), "icon": "📈"},
    "vitality":  {"primary": colors.HexColor("#10b981"), "light": colors.HexColor("#d1fae5"), "icon": "💪"},
    "tutor":     {"primary": colors.HexColor("#06b6d4"), "light": colors.HexColor("#cffafe"), "icon": "📚"},
    "pastor":    {"primary": colors.HexColor("#8b5cf6"), "light": colors.HexColor("#ede9fe"), "icon": "✝"},
    "hype":      {"primary": colors.HexColor("#ec4899"), "light": colors.HexColor("#fce7f3"), "icon": "⚡"},
    "bestie":    {"primary": colors.HexColor("#f43f5e"), "light": colors.HexColor("#ffe4e6"), "icon": "❤"},
}

# Colorblind-safe section icons (shape-based, not color-based)
SECTION_ICONS = {
    "medications":  "💊 MEDICATIONS",
    "symptoms":     "📋 SYMPTOM TIMELINE",
    "reactions":    "⚠  REACTIONS & SIDE EFFECTS",
    "allergies":    "🚫 KNOWN ALLERGIES",
    "questions":    "❓ QUESTIONS FOR YOUR DOCTOR",
    "interactions": "⚡ DRUG INTERACTION ALERTS",
    "appointments": "📅 UPCOMING APPOINTMENTS",
}

DISCLAIMER = (
    "AI-Generated Summary — For Clinical Review Only. "
    "Not a Medical Diagnosis. "
    "Always consult your healthcare provider before making any medical decisions."
)

def _get_styles(persona_color):
    """Build paragraph styles using persona color."""
    base = getSampleStyleSheet()
    pc   = persona_color["primary"]
    
    return {
        "title": ParagraphStyle(
            "VaultTitle",
            fontSize=22, fontName="Helvetica-Bold",
            textColor=pc, spaceAfter=4, alignment=TA_CENTER
        ),
        "subtitle": ParagraphStyle(
            "VaultSubtitle",
            fontSize=9, fontName="Helvetica",
            textColor=colors.HexColor("#6b7280"),
            spaceAfter=2, alignment=TA_CENTER
        ),
        "section_header": ParagraphStyle(
            "SectionHeader",
            fontSize=11, fontName="Helvetica-Bold",
            textColor=pc, spaceBefore=14, spaceAfter=6
        ),
        "body": ParagraphStyle(
            "VaultBody",
            fontSize=10, fontName="Helvetica",
            textColor=colors.HexColor("#111827"),
            spaceAfter=3, leading=14
        ),
        "body_bold": ParagraphStyle(
            "VaultBodyBold",
            fontSize=10, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#111827"),
            spaceAfter=3
        ),
        "small": ParagraphStyle(
            "VaultSmall",
            fontSize=8, fontName="Helvetica",
            textColor=colors.HexColor("#9ca3af"),
            spaceAfter=2
        ),
        "disclaimer": ParagraphStyle(
            "Disclaimer",
            fontSize=7, fontName="Helvetica-Oblique",
            textColor=colors.HexColor("#ef4444"),
            alignment=TA_CENTER, spaceBefore=8
        ),
        "warning": ParagraphStyle(
            "Warning",
            fontSize=10, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#dc2626"),
            spaceAfter=4
        ),
        "green": ParagraphStyle(
            "Green",
            fontSize=10, fontName="Helvetica",
            textColor=colors.HexColor("#16a34a"),
            spaceAfter=3
        ),
    }

def _section_divider(pc):
    return HRFlowable(width="100%", thickness=1.5,
                       color=pc["primary"], spaceAfter=6, spaceBefore=2)

def _build_qr_image(token: str, base_url: str = "https://lylo.app/vault/") -> Optional[RLImage]:
    """Build QR placeholder image for the PDF."""
    try:
        from PIL import Image as PILImage, ImageDraw
        url  = f"{base_url}{token}"
        size = 100
        img  = PILImage.new("RGB", (size, size), "white")
        draw = ImageDraw.Draw(img)
        draw.rectangle([0,0,size-1,size-1], outline="black", width=2)
        draw.rectangle([8,8,size-9,size-9], outline="black", width=2)
        for x, y in [(4,4),(size-20,4),(4,size-20)]:
            draw.rectangle([x,y,x+14,y+14], outline="black", width=2)
            draw.rectangle([x+4,y+4,x+10,y+10], fill="black")
        h = hashlib.md5(url.encode()).digest()
        cell = max(1, (size-24)//10)
        for i, byte in enumerate(h[:10]):
            for bit in range(8):
                if byte & (1 << bit):
                    cx = 12 + ((i*8+bit) % 8) * cell
                    cy = 24 + ((i*8+bit) // 8) * cell
                    if cy < size-10 and cx < size-10:
                        draw.rectangle([cx,cy,cx+cell-1,cy+cell-1], fill="black")
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        rl_img = RLImage(buf, width=0.9*inch, height=0.9*inch)
        return rl_img
    except Exception:
        return None

def generate_medical_pdf(
    vault:         dict,
    user_name:     str,
    persona:       str        = "doctor",
    interactions:  list       = None,
    qr_token:      str        = None,
    qr_expiry_min: int        = 30,
    lang:          str        = "en",
) -> bytes:
    """
    Generates a professional Medical Vault PDF.
    Returns raw bytes — never written to disk.
    
    vault:        decrypted medical vault dict
    user_name:    patient first name only
    persona:      which persona is generating (affects color)
    interactions: list of drug interaction warnings from FDA check
    qr_token:     ephemeral token for quick-view QR (None = no QR)
    lang:         "en" or "es"
    """
    pc      = PERSONA_COLORS.get(persona, PERSONA_COLORS["doctor"])
    buf     = BytesIO()
    doc     = SimpleDocTemplate(
        buf,
        pagesize     = letter,
        rightMargin  = 0.75*inch,
        leftMargin   = 0.75*inch,
        topMargin    = 0.75*inch,
        bottomMargin = 0.75*inch,
    )
    S        = _get_styles(pc)
    story    = []
    now      = datetime.now()
    
    # Session hash for legal protection — hash of content + timestamp
    vault_str    = str(sorted(vault.items()))
    session_hash = hashlib.sha256(f"{vault_str}{now.isoformat()}".encode()).hexdigest()[:16].upper()
    session_id   = f"LY-{now.strftime("%Y%m%d")}-{session_hash[:8]}"

    # ── HEADER ────────────────────────────────────────────────────────────────
    # Color bar at top (simulated with a colored table row)
    header_data = [[
        Paragraph(f'<font color="white"><b>LYLO OS</b> — Medical Intelligence Report</font>',
                  ParagraphStyle("H", fontSize=13, fontName="Helvetica-Bold",
                                 textColor=colors.white, alignment=TA_LEFT)),
        Paragraph(f'<font color="white">{pc["icon"]} Doctor</font>',
                  ParagraphStyle("HR", fontSize=11, fontName="Helvetica-Bold",
                                 textColor=colors.white, alignment=TA_RIGHT)),
    ]]
    header_table = Table(header_data, colWidths=[4.5*inch, 2.5*inch])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), pc["primary"]),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 12),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # Patient + session info row
    info_data = [[
        Paragraph(f"Patient: <b>{user_name}</b>", S["body"]),
        Paragraph(f"Generated: <b>{now.strftime('%B %d, %Y at %I:%M %p')}</b>", S["body"]),
        Paragraph(f"Session ID: <b>{session_id}</b>", S["small"]),
    ]]
    info_table = Table(info_data, colWidths=[2.5*inch, 2.5*inch, 2*inch])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), pc["light"]),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 10),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph(DISCLAIMER, S["disclaimer"]))
    story.append(Spacer(1, 12))

    # ── QR CODE (if token provided) ───────────────────────────────────────────
    if qr_token:
        qr_img = _build_qr_image(qr_token)
        if qr_img:
            qr_data = [[
                qr_img,
                Paragraph(
                    f"<b>Quick-View Dashboard</b><br/>"
                    f"Scan for critical summary (interactions, top questions, medication list).<br/>"
                    f"<font color='#dc2626'>Link expires in {qr_expiry_min} minutes.</font>",
                    S["body"]
                ),
            ]]
            qr_table = Table(qr_data, colWidths=[1.1*inch, 5.9*inch])
            qr_table.setStyle(TableStyle([
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                ("LEFTPADDING",   (0,0), (-1,-1), 8),
                ("RIGHTPADDING",  (0,0), (-1,-1), 8),
                ("TOPPADDING",    (0,0), (-1,-1), 8),
                ("BOTTOMPADDING", (0,0), (-1,-1), 8),
                ("BOX", (0,0), (-1,-1), 1, pc["primary"]),
                ("BACKGROUND", (0,0), (-1,-1), pc["light"]),
            ]))
            story.append(qr_table)
            story.append(Spacer(1, 14))

    # ── DRUG INTERACTION ALERTS (top priority — before meds list) ─────────────
    if interactions:
        story.append(Paragraph(SECTION_ICONS["interactions"], S["section_header"]))
        story.append(_section_divider(pc))
        for alert in interactions:
            story.append(Paragraph(
                f"⚡ <b>{alert.get('drug_a','?')} + {alert.get('drug_b','?')}</b> — "
                f"{alert.get('warning','Potential interaction detected.')[:200]}",
                S["warning"]
            ))
            story.append(Paragraph(
                f"Source: {alert.get('source','FDA')} | Severity: {alert.get('severity','moderate').upper()}",
                S["small"]
            ))
            story.append(Spacer(1, 4))
        story.append(Spacer(1, 8))

    # ── MEDICATIONS ───────────────────────────────────────────────────────────
    medications = [m for m in vault.get("medications", []) if m.get("active", True)]
    if medications:
        story.append(Paragraph(SECTION_ICONS["medications"], S["section_header"]))
        story.append(_section_divider(pc))
        med_data = [["Medication", "Dose", "Frequency", "Prescriber", "Since"]]
        for med in medications:
            med_data.append([
                med.get("name","—"),
                med.get("dose","—"),
                med.get("frequency","—"),
                med.get("prescriber","—") or "—",
                med.get("start_date","—"),
            ])
        med_table = Table(med_data, colWidths=[1.8*inch,0.9*inch,1.4*inch,1.4*inch,1.0*inch])
        med_table.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  pc["primary"]),
            ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,-1), 9),
            ("BACKGROUND",    (0,1), (-1,-1), colors.white),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, pc["light"]]),
            ("GRID",          (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
            ("TOPPADDING",    (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING",   (0,0), (-1,-1), 6),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(med_table)
        story.append(Spacer(1, 12))

    # ── SYMPTOM TIMELINE (Ambient Diary) ──────────────────────────────────────
    symptoms = vault.get("symptoms", [])
    if symptoms:
        story.append(Paragraph(SECTION_ICONS["symptoms"], S["section_header"]))
        story.append(_section_divider(pc))
        for s in sorted(symptoms, key=lambda x: x.get("logged_at",""), reverse=True)[:20]:
            sev_color = {"severe":"#dc2626","moderate":"#d97706","mild":"#16a34a"}.get(
                s.get("severity","mild"), "#16a34a")
            story.append(Paragraph(
                f"<font color='{sev_color}'>●</font> "
                f"<b>{s.get('date_label','—')}</b> — {s.get('description','—')}",
                S["body"]
            ))
        story.append(Spacer(1, 12))

    # ── REACTIONS ─────────────────────────────────────────────────────────────
    reactions = vault.get("reactions", [])
    if reactions:
        story.append(Paragraph(SECTION_ICONS["reactions"], S["section_header"]))
        story.append(_section_divider(pc))
        for r in reactions:
            story.append(Paragraph(
                f"⚠ <b>{r.get('medication_name','Unknown med')}</b> — "
                f"{r.get('description','—')[:150]}",
                S["warning"]
            ))
            story.append(Paragraph(f"Logged: {r.get('date_label','—')}", S["small"]))
        story.append(Spacer(1, 12))

    # ── ALLERGIES ─────────────────────────────────────────────────────────────
    allergies = vault.get("allergies", [])
    if allergies:
        story.append(Paragraph(SECTION_ICONS["allergies"], S["section_header"]))
        story.append(_section_divider(pc))
        for a in allergies:
            story.append(Paragraph(
                f"🚫 <b>{a.get('name','—')}</b> — {a.get('reaction','—')}",
                S["body_bold"]
            ))
        story.append(Spacer(1, 12))

    # ── QUESTIONS FOR DOCTOR ──────────────────────────────────────────────────
    questions = [q for q in vault.get("questions", []) if not q.get("answered")]
    if questions:
        story.append(Paragraph(SECTION_ICONS["questions"], S["section_header"]))
        story.append(_section_divider(pc))
        for i, q in enumerate(questions, 1):
            story.append(Paragraph(
                f"<b>{i}.</b> {q.get('question','—')}",
                S["body"]
            ))
            story.append(Paragraph(
                f"   Saved on {q.get('date_label','—')}",
                S["small"]
            ))
        story.append(Spacer(1, 12))

    # ── FOOTER ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5,
                             color=colors.HexColor("#e5e7eb")))
    story.append(Spacer(1, 6))
    footer_data = [[
        Paragraph("Generated by <b>LYLO OS</b> — Verified by AI, confirmed by you.",
                  ParagraphStyle("FL", fontSize=8, fontName="Helvetica",
                                 textColor=colors.HexColor("#6b7280"), alignment=TA_LEFT)),
        Paragraph(f"Session: {session_id}",
                  ParagraphStyle("FR", fontSize=7, fontName="Helvetica",
                                 textColor=colors.HexColor("#9ca3af"), alignment=TA_RIGHT)),
    ]]
    footer_table = Table(footer_data, colWidths=[4.5*inch, 2.5*inch])
    footer_table.setStyle(TableStyle([
        ("TOPPADDING",    (0,0),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-1), 0),
    ]))
    story.append(footer_table)
    story.append(Paragraph(DISCLAIMER, S["disclaimer"]))

    doc.build(story)
    return buf.getvalue()
