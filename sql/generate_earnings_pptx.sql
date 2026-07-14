CREATE OR REPLACE PROCEDURE LIFEINSURANCE_DEMO_DB.RAW.GENERATE_EARNINGS_PPTX(COMPANY_NAME VARCHAR, SLIDE_DATA VARCHAR)
RETURNS VARCHAR LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python', 'python-pptx')
HANDLER = 'main' EXECUTE AS CALLER
AS $$
import json, os, re
from datetime import datetime
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

BLUE_DARK = RGBColor(0x1A, 0x3A, 0x6B)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x1A, 0x1A, 0x1A)
GRAY = RGBColor(0x55, 0x55, 0x55)
GRAY_LIGHT = RGBColor(0xF5, 0xF5, 0xF5)
RED = RGBColor(0xE0, 0x3E, 0x3E)
GREEN = RGBColor(0x1B, 0x8C, 0x5A)
BORDER_GRAY = RGBColor(0xCC, 0xCC, 0xCC)
BAR_BLUE = RGBColor(0x3B, 0x7D, 0xDD)
BAR_RED = RGBColor(0xE0, 0x5E, 0x5E)
SW = 13.33
SH = 7.5

def tb(slide, l, t, w, h, text, sz=11, bold=False, color=BLACK, align=PP_ALIGN.LEFT, va=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = va
    tf.margin_left = Inches(0.05)
    tf.margin_right = Inches(0.05)
    tf.margin_top = Inches(0.02)
    tf.margin_bottom = Inches(0.02)
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.size = Pt(sz)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = 'Meiryo UI'
    return tf

def rect(slide, l, t, w, h, fill=None, border=None):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    if fill:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    else:
        s.fill.background()
    if border:
        s.line.color.rgb = border
        s.line.width = Pt(1.5)
    else:
        s.line.fill.background()

def header(slide, title, num=None):
    rect(slide, 0, 0, SW, 0.65, fill=BLUE_DARK)
    if num:
        ns = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.2), Inches(0.12), Inches(0.4), Inches(0.4))
        ns.fill.solid()
        ns.fill.fore_color.rgb = WHITE
        ns.line.fill.background()
        tf = ns.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = str(num)
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = BLUE_DARK
    tb(slide, 0.75, 0.08, 12, 0.55, title, sz=15, bold=True, color=WHITE, va=MSO_ANCHOR.MIDDLE)

def s1(prs, data, company, meta):
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    d = data.get('slide1', {})
    header(sl, d.get('title', company + ' 決算サマリー'), num=1)
    tb(sl, 0.4, 0.75, 12, 0.4, f"{company} | {meta.get('period','')}（{meta.get('announced','')}発表）", sz=12, color=GRAY)
    kw = 3.9
    kg = 0.25
    sx = 0.4
    for i, kpi in enumerate(d.get('kpis', [])[:3]):
        x = sx + i * (kw + kg)
        rect(sl, x, 1.25, kw, 2.2, border=BORDER_GRAY)
        tb(sl, x+0.15, 1.35, kw-0.3, 0.3, kpi.get('label',''), sz=12, color=GRAY)
        tb(sl, x+0.15, 1.65, kw-0.3, 0.8, kpi.get('value',''), sz=28, bold=True, color=BLUE_DARK, align=PP_ALIGN.CENTER, va=MSO_ANCHOR.MIDDLE)
        sub = kpi.get('sub','').replace('\\n','\n')
        tb(sl, x+0.15, 2.55, kw-0.3, 0.8, sub, sz=11, color=GRAY, align=PP_ALIGN.CENTER)
    td = d.get('table', {})
    hdrs = td.get('headers', [])
    rows = td.get('rows', [])
    if hdrs and rows:
        nr = len(rows)+1
        nc = len(hdrs)
        tbl_top = 3.65
        row_h = 0.5
        tbl_h = nr * row_h + 0.1
        ts = sl.shapes.add_table(nr, nc, Inches(0.4), Inches(tbl_top), Inches(12.5), Inches(tbl_h))
        t = ts.table
        cw = [Inches(3.0), Inches(2.4), Inches(2.4), Inches(2.4), Inches(2.3)]
        for ci, w in enumerate(cw[:nc]):
            t.columns[ci].width = w
        for ri in range(nr):
            t.rows[ri].height = Inches(row_h)
        for ci, h in enumerate(hdrs):
            c = t.cell(0, ci)
            c.text = h
            c.fill.solid()
            c.fill.fore_color.rgb = BLUE_DARK
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(14)
            p.font.bold = True
            p.font.color.rgb = WHITE
            p.font.name = 'Meiryo UI'
            p.alignment = PP_ALIGN.CENTER
        for ri, row in enumerate(rows):
            for ci, val in enumerate(row):
                c = t.cell(ri+1, ci)
                c.text = str(val)
                p = c.text_frame.paragraphs[0]
                p.font.size = Pt(14)
                p.font.name = 'Meiryo UI'
                p.alignment = PP_ALIGN.CENTER if ci > 0 else PP_ALIGN.LEFT
                if ci >= 3 and ('+' in str(val) or '倍' in str(val)):
                    p.font.color.rgb = GREEN
                    p.font.bold = True
                elif ci >= 3 and '-' in str(val) and '—' not in str(val):
                    p.font.color.rgb = RED
                    p.font.bold = True

def s2(prs, data, company):
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    d = data.get('slide2', {})
    header(sl, d.get('title', '利益の要因分析'), num=2)
    st = d.get('subtitle', '')
    if st:
        tb(sl, 0.4, 0.75, 12, 0.35, st, sz=16, color=GRAY)
    factors = d.get('factors', [])
    mx = max((abs(float(re.sub(r'[^\d.\-]','',f.get('raw_value','1')))) for f in factors), default=1)
    bar_top = 1.3
    bar_gap = 0.9
    for i, f in enumerate(factors):
        y = bar_top + i * bar_gap
        tb(sl, 0.4, y, 2.8, 0.5, f.get('label',''), sz=16, color=BLACK)
        try:
            raw = float(re.sub(r'[^\d.\-]','',f.get('raw_value','0')))
        except:
            raw = 0
        bw = max(0.15, abs(raw)/mx * 2.0)
        fill = BAR_BLUE if raw >= 0 else BAR_RED
        rect(sl, 3.3, y+0.08, bw, 0.35, fill=fill)
        tb(sl, 3.3+bw+0.1, y, 1.5, 0.5, f.get('value',''), sz=16, bold=True, color=GREEN if raw>=0 else RED)
    tl = d.get('total_label','')
    if tl:
        yt = bar_top + len(factors) * bar_gap + 0.2
        tb(sl, 0.4, yt, 6.0, 0.5, f"{tl}  =  {d.get('total_value','')}", sz=16, bold=True, color=BLACK)
    ins_left = 7.0
    ins_w = 6.0
    for i, ins in enumerate(d.get('insights',[])[:3]):
        y = 1.2 + i * 2.1
        rect(sl, ins_left, y, ins_w, 1.9, fill=GRAY_LIGHT, border=BORDER_GRAY)
        tb(sl, ins_left+0.15, y+0.1, ins_w-0.3, 0.45, ins.get('title',''), sz=16, bold=True, color=BLUE_DARK)
        tb(sl, ins_left+0.15, y+0.6, ins_w-0.3, 1.2, ins.get('text',''), sz=16, color=GRAY)

def s3(prs, data, company):
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    d = data.get('slide3', {})
    header(sl, d.get('title', '訪問時の話材'), num=3)
    st = d.get('subtitle', '')
    if st:
        tb(sl, 0.4, 0.75, 12, 0.35, st, sz=9, color=GRAY)
    tb(sl, 0.4, 1.15, 6, 0.3, '経営陣との会話を深掘りする話材', sz=14, bold=True, color=BLACK)
    topics = d.get('topics', [])[:4]
    tw = 3.1
    tg = 0.15
    for i, t in enumerate(topics):
        col = i % 2
        row = i // 2
        x = 0.4 + col * (tw + tg)
        y = 1.55 + row * 2.85
        rect(sl, x, y, tw, 2.65, fill=GRAY_LIGHT, border=BORDER_GRAY)
        tb(sl, x+0.1, y+0.1, tw-0.2, 0.3, t.get('title',''), sz=12, bold=True, color=BLUE_DARK)
        q = t.get('quote','')
        if q:
            tb(sl, x+0.1, y+0.45, tw-0.2, 0.7, f"「{q}」", sz=12, bold=True, color=BLACK)
        tb(sl, x+0.1, y+1.2, tw-0.2, 1.35, t.get('detail',''), sz=11, color=GRAY)
    tb(sl, 6.9, 1.15, 6, 0.3, '今後の注目ポイント', sz=14, bold=True, color=BLACK)
    for i, wp in enumerate(d.get('watchpoints',[])[:5]):
        y = 1.55 + i * 1.15
        ns = sl.shapes.add_shape(MSO_SHAPE.OVAL, Inches(6.9), Inches(y+0.05), Inches(0.3), Inches(0.3))
        ns.fill.solid()
        ns.fill.fore_color.rgb = BLUE_DARK
        ns.line.fill.background()
        tf = ns.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = str(wp.get('num', i+1))
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = WHITE
        tb(sl, 7.3, y, 5.8, 0.35, wp.get('title',''), sz=14, bold=True, color=BLACK)
        tb(sl, 7.3, y+0.4, 5.8, 0.7, wp.get('detail',''), sz=12, color=GRAY)

def main(session, company_name: str, slide_data: str) -> str:
    data = json.loads(slide_data)
    meta = data.get('meta', {})
    prs = Presentation()
    prs.slide_width = Emu(12192000)
    prs.slide_height = Emu(6858000)
    s1(prs, data, company_name, meta)
    s2(prs, data, company_name)
    s3(prs, data, company_name)
    safe_name = re.sub(r'[^\w\-.]', '_', company_name + '_earnings_' + datetime.now().strftime('%Y%m%d')) + '.pptx'
    local_path = '/tmp/' + safe_name
    prs.save(local_path)
    stage_path = '@LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE'
    session.file.put(local_path, stage_path, auto_compress=False, overwrite=True)
    os.remove(local_path)
    session.sql("ALTER STAGE LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE REFRESH").collect()
    url = session.sql(f"SELECT GET_PRESIGNED_URL({stage_path}, '{safe_name}', 3600) AS URL").collect()[0]['URL']
    return f'[{company_name}_決算サマリー.pptxをダウンロード]({url})'
$$;
