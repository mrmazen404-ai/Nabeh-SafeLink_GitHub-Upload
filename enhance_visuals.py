from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pathlib import Path
from PIL import Image
from docx import Document

ROOT=Path('/home/ubuntu/Nabeh-SafeLink_GitHub-Upload')
OUT=ROOT/'deliverables'; AS=ROOT/'assets'
PPTX=OUT/'DedupChain_Academic_Presentation.pptx'
NAVY=RGBColor(28,55,122); BLUE=RGBColor(47,107,206); YELLOW=RGBColor(245,196,0); DARK=RGBColor(35,39,47); MID=RGBColor(95,102,115); WHITE=RGBColor(255,255,255); PALE=RGBColor(232,240,252)
FONT='Aptos'

def rect(slide,x,y,w,h,fill,round=False,line=None,transparency=None):
 s=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if round else MSO_SHAPE.RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h)); s.fill.solid(); s.fill.fore_color.rgb=fill
 if transparency is not None: s.fill.transparency=transparency
 s.line.color.rgb=line or fill
 if round: s.adjustments[0]=0.12
 return s

def text(slide,txt,x,y,w,h,size=12,color=DARK,bold=False,align=PP_ALIGN.LEFT):
 tb=slide.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h)); tf=tb.text_frame; tf.clear(); tf.word_wrap=True; tf.margin_left=Inches(.05); tf.margin_right=Inches(.05); tf.margin_top=Inches(.03); tf.margin_bottom=Inches(.03); tf.vertical_anchor=MSO_ANCHOR.MIDDLE
 p=tf.paragraphs[0]; p.alignment=align; r=p.add_run(); r.text=txt; r.font.name=FONT; r.font.size=Pt(size); r.font.bold=bold; r.font.color.rgb=color
 return tb

def remove_text(slide, needles):
 for sh in list(slide.shapes):
  if hasattr(sh,'text') and any(n in sh.text for n in needles):
   sp=sh._element; sp.getparent().remove(sp)

def crop_image(src,dst,box):
 im=Image.open(src).convert('RGB'); im=im.crop(box); im.save(dst,quality=92)

# Prepare crops preserving the paper's actual charts.
crop_image(AS/'server_room_national_archives.jpg', AS/'server_room_cover.jpg', (0,2200,3600,2050+2200)) if False else None
# Better wide server-room crop from the original dimensions.
im=Image.open(AS/'server_room_national_archives.jpg').convert('RGB'); w,h=im.size; target=16/9; new_h=int(w/target); top=max(0,(h-new_h)//2); im.crop((0,top,w,top+new_h)).save(AS/'server_room_cover.jpg',quality=92)
# Paper figures: retain captions/plots but remove most surrounding prose.
page15=Image.open(AS/'paper_page-15.png').convert('RGB'); page15.crop((720,80,1490,1040)).save(AS/'paper_figures_upload.png',quality=95)
page14=Image.open(AS/'paper_page-14.png').convert('RGB'); page14.crop((760,80,1490,850)).save(AS/'paper_figures_oram.png',quality=95)

prs=Presentation(str(PPTX))
# Cover: a restrained, high-quality server-room image replaces the abstract block diagram.
s=prs.slides[0]
s.shapes.add_picture(str(AS/'server_room_cover.jpg'), Inches(7.45), Inches(1.25), width=Inches(5.15), height=Inches(4.7))
rect(s,7.45,4.85,5.15,1.1,NAVY,False,NAVY,transparency=18)
text(s,'Replicated storage\nrequires a stronger trust boundary.',7.72,5.02,4.62,.66,17,WHITE,True,PP_ALIGN.CENTER)
text(s,'Photo: The National Archives (UK) · CC BY 3.0',7.62,6.02,4.8,.2,7,WHITE,False,PP_ALIGN.CENTER)
# Results slide: replace the sparse KPI strip with two callouts plus actual plots from the supplied paper.
s=prs.slides[10]
rect(s,.65,4.25,12.05,2.2,WHITE,True,WHITE)
# redraw two concise callouts
rect(s,.85,4.65,2.45,1.05,PALE,True,BLUE); text(s,'> 400 TPS',1.03,4.78,2.1,.35,22,NAVY,True,PP_ALIGN.CENTER); text(s,'reported upload throughput',1.0,5.22,2.15,.22,9,MID,False,PP_ALIGN.CENTER)
rect(s,3.55,4.65,2.65,1.05,PALE,True,BLUE); text(s,'~ 320 ms',3.72,4.78,2.3,.35,22,NAVY,True,PP_ALIGN.CENTER); text(s,'1,600-chunk membership check',3.72,5.22,2.3,.22,9,MID,False,PP_ALIGN.CENTER)
s.shapes.add_picture(str(AS/'paper_figures_upload.png'), Inches(6.55), Inches(4.42), width=Inches(5.7), height=Inches(1.65))
text(s,'Paper Fig. 8–9: upload delay and throughput trends',6.62,6.10,5.55,.2,8,MID,False,PP_ALIGN.CENTER)
# Add source note to the research report.
report=OUT/'DedupChain_Research_Accuracy_Report.docx'; doc=Document(str(report)); doc.add_heading('Visual-source record',1)
doc.add_paragraph('The cover photograph is “A view of the server room at The National Archives,” supplied through Wikimedia Commons. It is licensed CC BY 3.0; attribution is shown on the cover slide. The performance plots on Slide 11 are crops of Figures 8–9 from the supplied DedupChain paper and retain their meaning without adding values.')
doc.add_paragraph('Photo source: https://commons.wikimedia.org/wiki/File:A_view_of_the_server_room_at_The_National_Archives.jpg')
doc.save(str(report))
prs.save(str(PPTX))
print('enhanced',PPTX)
