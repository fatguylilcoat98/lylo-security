"""
LYLO OS — services/pdf_mailer.py
Mission report PDF generation and email dispatch.
"""
import re
import asyncio
import datetime
import os
import logging
import smtplib
from io import BytesIO
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from services.config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD

logger = logging.getLogger("LYLO.PDFMailer")


def generate_mission_report_pdf(
    content:   str,
    persona:   str,
    user_name: str,
    timestamp: str = "",
) -> BytesIO:
    """
    Generates a formal persona-specific PDF for email dispatch.
    Returns BytesIO buffer — pure synchronous, call via asyncio.to_thread().
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
    from reportlab.lib.colors import HexColor, white
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle,
    )

    cfg                                    = PERSONA_PDF_CONFIG.get(persona.lower())
    doc_title, doc_type, accent_hex, a2_hex = cfg if cfg else DEFAULT_PDF_CONFIG
    accent       = HexColor(accent_hex)
    accent2      = HexColor(a2_hex)
    bg_dark      = HexColor("#0C0C0C")
    bg_panel     = HexColor("#161616")
    text_primary = HexColor("#F1F5F9")
    text_muted   = HexColor("#94A3B8")
    ts           = timestamp or datetime.now().strftime("%B %d, %Y — %I:%M %p")

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.6 * inch,   bottomMargin=0.75 * inch,
        title=doc_title, author="LYLO OS Intelligence Engine",
        subject=f"Mission Report — {persona.capitalize()}",
    )

    def ms(name, **kw):
        base = dict(fontName="Helvetica", fontSize=10, textColor=text_primary, leading=14, spaceAfter=4)
        base.update(kw)
        return ParagraphStyle(name, **base)

    s_type  = ms("DocType",  fontSize=7,  textColor=accent2, fontName="Helvetica-Bold",
                 alignment=TA_CENTER, spaceAfter=2)
    s_title = ms("Title",    fontSize=20, textColor=text_primary, fontName="Helvetica-Bold",
                 alignment=TA_CENTER, spaceAfter=6, leading=24)
    s_sec   = ms("Sec",      fontSize=9,  textColor=accent2, fontName="Helvetica-Bold",
                 spaceBefore=14, spaceAfter=4)
    s_body  = ms("Body",     fontSize=10, leading=16, spaceAfter=8)
    s_bsm   = ms("BodySm",   fontSize=9,  textColor=text_muted, leading=14, spaceAfter=6)
    s_bul   = ms("Bullet",   fontSize=10, leading=15, leftIndent=14, spaceAfter=5)
    s_foot  = ms("Footer",   fontSize=7,  textColor=text_muted, alignment=TA_CENTER, spaceBefore=12)

    def _bg(cv, doc_obj):
        w, h = letter
        cv.saveState()
        cv.setFillColor(bg_dark);  cv.rect(0, 0, w, h, fill=1, stroke=0)
        cv.setFillColor(accent);   cv.rect(0, h - 0.55 * inch, w, 0.55 * inch, fill=1, stroke=0)
        cv.setFillColor(white);    cv.setFont("Helvetica-Bold", 7)
        cv.drawString(0.75 * inch, h - 0.35 * inch,
                      f"LYLO OS  ·  {persona.upper()} INTELLIGENCE  ·  CLASSIFIED")
        cv.setFont("Helvetica", 7)
        cv.drawRightString(w - 0.75 * inch, h - 0.35 * inch, f"Page {doc_obj.page}")
        cv.setStrokeColor(HexColor("#222222")); cv.setLineWidth(0.5)
        cv.line(0.75 * inch, 0.55 * inch, w - 0.75 * inch, 0.55 * inch)
        cv.restoreState()

    def parse(raw: str) -> list:
        els = []
        for line in raw.split("\n"):
            line = line.strip()
            if not line:
                els.append(Spacer(1, 6)); continue
            if (line.startswith("**") and line.endswith("**")) or line.startswith("## "):
                txt = line.strip("*# ")
                els.append(HRFlowable(width="100%", thickness=0.5, color=accent2, spaceAfter=4))
                els.append(Paragraph(txt.upper(), s_sec)); continue
            if line.startswith("[") and "]" in line and len(line) < 80:
                lbl = line[1:line.index("]")]
                els.append(Paragraph(f"[ {lbl} ]", s_sec)); continue
            if line.startswith("- ") or line.startswith("• "):
                txt = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line.lstrip("-• "))
                els.append(Paragraph(f"• {txt}", s_bul)); continue
            ln = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
            els.append(Paragraph(ln, s_body))
        return els

    story = [
        Spacer(1, 0.15 * inch),
        Paragraph(doc_type, s_type),
        Spacer(1, 4),
        Paragraph(doc_title, s_title),
        Spacer(1, 6),
    ]

    meta = Table(
        [["SPECIALIST", persona.capitalize()], ["RECIPIENT", user_name],
         ["ISSUED", ts], ["STATUS", "ACTIVE — FOR IMMEDIATE ACTION"]],
        colWidths=[1.2 * inch, 5.6 * inch], hAlign="LEFT",
    )
    meta.setStyle(TableStyle([
        ("BACKGROUND",  (0,0),(0,-1), HexColor("#1A1A1A")),
        ("BACKGROUND",  (1,0),(1,-1), bg_panel),
        ("TEXTCOLOR",   (0,0),(0,-1), accent2),
        ("TEXTCOLOR",   (1,0),(1,-1), text_primary),
        ("FONTNAME",    (0,0),(0,-1), "Helvetica-Bold"),
        ("FONTNAME",    (1,0),(1,-1), "Helvetica"),
        ("FONTSIZE",    (0,0),(-1,-1), 8),
        ("TOPPADDING",  (0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0),(-1,-1), 8),
        ("RIGHTPADDING",(0,0),(-1,-1), 8),
        ("GRID",        (0,0),(-1,-1), 0.3, HexColor("#2A2A2A")),
    ]))
    story.append(meta)
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent2, spaceAfter=10))
    story.extend(parse(content))
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#333333"), spaceAfter=8))
    story.append(Paragraph(
        "LYLO OS DISCLAIMER: This document was generated by the LYLO Intelligence Engine "
        "and is intended solely for the named recipient. LYLO OS does not provide licensed "
        "legal, medical, or financial advice. This report is advisory in nature.",
        s_bsm,
    ))
    story.append(Paragraph(
        f"Generated by LYLO OS v31.0  ·  {ts}  ·  DO NOT DISTRIBUTE", s_foot
    ))

    doc.build(story, onFirstPage=_bg, onLaterPages=_bg)
    buf.seek(0)
    return buf


# =============================================================================
# EMAIL MISSION REPORT — PDF ATTACHMENT DISPATCH
# =============================================================================
async def send_mission_report_email(
    to_email:    str,
    content:     str,
    persona_name: str,
    user_name:   str = "Operative",
):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("⚠️ SMTP not set — Mission Report mock-dispatched.")
        return

    cfg       = PERSONA_PDF_CONFIG.get(persona_name.lower())
    doc_title = cfg[0] if cfg else "LYLO TACTICAL REPORT"
    ts        = datetime.now().strftime("%B %d, %Y — %I:%M %p")
    filename  = f"LYLO_{persona_name.upper()}_REPORT_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"

    try:
        msg            = MIMEMultipart("mixed")
        msg["From"]    = f"LYLO OS <{SMTP_USERNAME}>"
        msg["To"]      = to_email
        msg["Subject"] = f"🛡️ LYLO {doc_title} — {ts}"

        html_body = f"""
        <html>
        <body style="font-family:Arial,sans-serif;background:#000;color:#fff;padding:24px;margin:0;">
          <div style="max-width:560px;margin:0 auto;background:#0C0C0C;
                      border:1px solid #222;border-radius:12px;overflow:hidden;">
            <div style="background:#4F46E5;padding:20px 24px;">
              <p style="margin:0;color:#c7d2fe;font-size:10px;font-weight:700;
                         letter-spacing:3px;text-transform:uppercase;">LYLO OS · SECURE DISPATCH</p>
              <h1 style="margin:6px 0 0;color:#fff;font-size:20px;
                          font-weight:900;text-transform:uppercase;">{doc_title}</h1>
            </div>
            <div style="padding:24px;">
              <p style="color:#94a3b8;font-size:11px;font-weight:700;
                         text-transform:uppercase;letter-spacing:2px;margin:0 0 4px;">
                SPECIALIST: {persona_name.upper()}</p>
              <p style="color:#94a3b8;font-size:11px;font-weight:700;
                         text-transform:uppercase;letter-spacing:2px;margin:0 0 20px;">
                RECIPIENT: {user_name.upper()} &nbsp;|&nbsp; ISSUED: {ts}</p>
              <div style="background:#161616;border:1px solid #222;border-radius:8px;
                           padding:16px;margin-bottom:20px;">
                <p style="color:#f1f5f9;font-size:13px;line-height:1.7;margin:0;
                            white-space:pre-wrap;">{content[:600]}{"..." if len(content) > 600 else ""}</p>
              </div>
              <p style="color:#64748b;font-size:12px;margin:0;">
                Full tactical document attached as PDF.</p>
            </div>
            <div style="background:#0A0A0A;border-top:1px solid #1a1a1a;
                         padding:14px 24px;text-align:center;">
              <p style="color:#334155;font-size:9px;margin:0;letter-spacing:1px;">
                LYLO OS SECURITY PROTOCOL ACTIVE · DO NOT REPLY</p>
            </div>
          </div>
        </body>
        </html>"""
        msg.attach(MIMEText(html_body, "html"))

        try:
            pdf_buf   = await asyncio.to_thread(generate_mission_report_pdf, content, persona_name, user_name, ts)
            pdf_bytes = pdf_buf.read()
            att       = MIMEBase("application", "pdf")
            att.set_payload(pdf_bytes)
            encoders.encode_base64(att)
            att.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(att)
            logger.info(f"📎 PDF attached: {filename} ({len(pdf_bytes):,} bytes)")
        except Exception as pdf_err:
            logger.error(f"❌ PDF generation failed: {pdf_err}")

        def _send():
            srv = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            srv.starttls(); srv.login(SMTP_USERNAME, SMTP_PASSWORD)
            srv.send_message(msg); srv.quit()

        await asyncio.to_thread(_send)
        logger.info(f"✅ Mission Report dispatched → {to_email}")
    except Exception as e:
        logger.error(f"❌ Email Dispatch Failed: {e}")

# =============================================================================
# RECURSIVE MEMORY — PINECONE EPISODIC STORAGE
# =============================================================================
