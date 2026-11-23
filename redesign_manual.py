from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pathlib import Path
from docx import Document

ROOT=Path('/home/ubuntu/Nabeh-SafeLink_GitHub-Upload'); SRC=ROOT/'paper_extract/Blue White and Gray Modern Networking Presentation.pptx'; OUT=ROOT/'deliverables'; AS=ROOT/'assets'
PPTX=OUT/'DedupChain_Academic_Presentation.pptx'; PDF=OUT/'DedupChain_Academic_Presentation.pdf'; SCRIPT=OUT/'DedupChain_Presentation_Script.docx'; REPORT=OUT/'DedupChain_Research_Accuracy_Report.docx'
NAVY=RGBColor(21,42,94); BLUE=RGBColor(43,103,194); CYAN=RGBColor(37,163,201); GOLD=RGBColor(239,183,39); INK=RGBColor(28,34,46); MID=RGBColor(91,101,119); BG=RGBColor(246,248,251); PALE=RGBColor(232,240,252); ICE=RGBColor(220,239,245); WHITE=RGBColor(255,255,255); RED=RGBColor(196,69,74); GREEN=RGBColor(57,137,102); FONT='Aptos'

def remove_all(s):
 for sh in list(s.shapes):
  sp=sh._element; sp.getparent().remove(sp)

def shape(s,x,y,w,h,fill,round=False,line=None,trans=0):
 o=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if round else MSO_SHAPE.RECTANGLE, Inches(x),Inches(y),Inches(w),Inches(h)); o.fill.solid(); o.fill.fore_color.rgb=fill; o.fill.transparency=trans; o.line.color.rgb=line or fill
 if round: o.adjustments[0]=0.10
 return o

def txt(s,t,x,y,w,h,sz=14,col=INK,bold=False,align=PP_ALIGN.LEFT,margin=.04):
 o=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h)); f=o.text_frame; f.clear(); f.word_wrap=True; f.margin_left=Inches(margin); f.margin_right=Inches(margin); f.margin_top=Inches(.02); f.margin_bottom=Inches(.02); f.vertical_anchor=MSO_ANCHOR.MIDDLE
 p=f.paragraphs[0]; p.alignment=align; r=p.add_run(); r.text=t; r.font.name=FONT; r.font.size=Pt(sz); r.font.bold=bold; r.font.color.rgb=col; return o

def bullets(s,items,x,y,w,h,sz=13,col=INK,accent=BLUE):
 box=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h)); f=box.text_frame; f.clear(); f.word_wrap=True; f.margin_left=Inches(.18); f.margin_right=Inches(.05); f.margin_top=Inches(.03)
 for i,it in enumerate(items):
  p=f.paragraphs[0] if i==0 else f.add_paragraph(); p.text=it; p.font.name=FONT; p.font.size=Pt(sz); p.font.color.rgb=col; p.space_after=Pt(4); p.bullet=True
 return box

def header(s,title,kicker='DEDUPCHAIN | ACADEMIC PRESENTATION',num=None,dark=False):
 if dark:
  shape(s,0,0,13.333,7.5,NAVY); shape(s,0,0,13.333,.09,GOLD)
  txt(s,kicker,.55,.28,3.4,.25,9,RGBColor(185,205,245),True)
  txt(s,title,.55,.75,12.1,.75,29,WHITE,True)
 else:
  shape(s,0,0,13.333,7.5,BG); shape(s,0,0,13.333,.09,GOLD); shape(s,0,.12,13.333,.44,NAVY)
  txt(s,kicker,.48,.17,3.7,.22,8,WHITE,True); txt(s,title,.55,.78,12.0,.52,25,INK,True)
 if num is not None: txt(s,f'{num:02d}',12.25,.17,.55,.22,9,WHITE,True,PP_ALIGN.RIGHT)

def footer(s,source='Source: Qi et al., IEEE JSAC, 2025.',dark=False):
 if not dark: shape(s,0,7.34,13.333,.07,GOLD)
 txt(s,source,.55,7.02,10.8,.18,7,RGBColor(190,202,220) if dark else MID)

def panel(s,x,y,w,h,title,body,accent=BLUE,fs=12):
 shape(s,x,y,w,h,WHITE,True,RGBColor(214,222,234)); shape(s,x,y,.07,h,accent); txt(s,title,x+.18,y+.13,w-.3,.27,14,NAVY,True); txt(s,body,x+.18,y+.47,w-.3,h-.58,fs,INK)

def box(s,x,y,w,h,label,fill=PALE,edge=BLUE,fs=12,col=NAVY):
 shape(s,x,y,w,h,fill,True,edge); txt(s,label,x+.06,y+.04,w-.12,h-.08,fs,col,True,PP_ALIGN.CENTER); return (x,y,w,h)

def arrow(s,x,y,w=.5,col=BLUE,vertical=False):
 sh=MSO_SHAPE.DOWN_ARROW if vertical else MSO_SHAPE.RIGHT_ARROW; o=s.shapes.add_shape(sh, Inches(x),Inches(y), Inches(.25 if vertical else w), Inches(w if vertical else .25)); o.fill.solid(); o.fill.fore_color.rgb=col; o.line.color.rgb=col

def node_circle(s,x,y,r,label,fill=BLUE):
 o=s.shapes.add_shape(MSO_SHAPE.OVAL,Inches(x),Inches(y),Inches(r),Inches(r)); o.fill.solid(); o.fill.fore_color.rgb=fill; o.line.color.rgb=WHITE; txt(s,label,x,y+.07,r,r-.14,10,WHITE,True,PP_ALIGN.CENTER)

def note(s,t):
 s.notes_slide.notes_text_frame.clear(); s.notes_slide.notes_text_frame.text=t

prs=Presentation(str(SRC));
while len(prs.slides)<14: prs.slides.add_slide(prs.slide_layouts[6])
for s in prs.slides: remove_all(s)
ss=list(prs.slides)

# 1 cover
s=ss[0]; header(s,'DedupChain',"MASTER'S RESEARCH PRESENTATION",1,True)
txt(s,'A secure blockchain-enabled storage system\nwith deduplication for zero-trust network',.62,1.72,7.1,1.1,24,WHITE,True)
txt(s,'Reconstructed from the supplied IEEE JSAC paper\n15-minute group presentation · 5-minute discussion',.66,3.05,6.2,.65,13,RGBColor(211,224,248))
# hand-built transparent system visual
for x,y,lab in [(8.0,1.65,'CLIENT'),(10.6,1.65,'SGX'),(8.0,3.55,'ORAM'),(10.6,3.55,'CHAIN')]: node_circle(s,x,y,1.05,lab,BLUE if lab!='CHAIN' else GOLD)
arrow(s,9.08,2.0,.8,CYAN); arrow(s,10.02,2.98,.8,CYAN); arrow(s,9.08,3.9,.8,CYAN); arrow(s,11.0,2.95,.8,GOLD)
shape(s,7.45,5.28,4.75,.72,WHITE,True,WHITE,8); txt(s,'privacy-preserving deduplication',7.65,5.45,4.35,.28,15,NAVY,True,PP_ALIGN.CENTER)
txt(s,'Amal Ali Alghamdi — 447003182\nNouf Mabrouk Alghamdi — 447009906\nSamia Jumaan Alghamdi',.66,5.52,5.7,.8,12,RGBColor(214,226,247)); footer(s,'Primary source: Qi et al., IEEE JSAC, vol. 43, no. 6, 2025.',True)
note(s,'Opening (0:45). Introduce the paper, the three presenters, and the main design problem. DedupChain is not a generic blockchain design; it specifically combines secure deduplication, SGX, and ORAM for zero-trust storage. Transition to the paper and presentation roadmap.')

# 2 roadmap
s=ss[1]; header(s,'Research question and presentation roadmap',num=2)
txt(s,'How can a permissioned blockchain reduce replicated storage without exposing deduplication leakage?',.72,1.52,11.8,.48,18,NAVY,True,PP_ALIGN.CENTER)
steps=[('01','Problem','Privacy leakage + full replication'),('02','Mechanism','SGX + ORAM + c-LDCF'),('03','System','Double trees + versioning'),('04','Evidence','Security analysis + prototype results')]
for i,(n,h,b) in enumerate(steps):
 x=.75+i*3.08; shape(s,x,2.45,2.55,2.25,WHITE,True,RGBColor(213,222,234)); shape(s,x,2.45,2.55,.13,[BLUE,CYAN,GOLD,GREEN][i]); txt(s,n,x+.18,2.72,.5,.35,22,NAVY,True); txt(s,h,x+.18,3.25,2.1,.3,15,INK,True); txt(s,b,x+.18,3.72,2.1,.64,12,MID)
 if i<3: arrow(s,x+2.62,3.42,.4,CYAN)
shape(s,.75,5.25,11.75,.78,PALE,True,BLUE); txt(s,'Coverage: research problem · proposed solution · methodology · results · conclusion',1.0,5.48,11.2,.3,15,NAVY,True,PP_ALIGN.CENTER); footer(s); note(s,'Student 1 (1:00). State the research question and explain the narrative. The presentation follows the assignment requirements in a deliberate order. We begin with the tension between blockchain replication and secure deduplication, then unpack the mechanism and evidence.')

# 3 context
s=ss[2]; header(s,'Why zero-trust storage needs a new design',num=3)
# network visual
shape(s,.72,1.62,5.2,4.7,WHITE,True,RGBColor(214,222,234)); txt(s,'ZERO-TRUST NETWORK',1.0,1.88,4.6,.3,15,NAVY,True,PP_ALIGN.CENTER)
for x,y,l in [(1.35,2.65,'A'),(3.05,2.15,'B'),(4.25,3.0,'C'),(2.2,4.35,'D'),(4.55,4.55,'E')]: node_circle(s,x,y,.55,l,BLUE)
for a,b in [((1.85,2.9),(3.05,2.5)),((1.75,3.05),(2.45,4.35)),((3.55,2.55),(4.25,3.0)),((3.45,2.65),(2.55,4.35)),((4.7,3.55),(4.75,4.55)),((2.75,4.65),(4.55,4.8))]:
 line=s.shapes.add_connector(1,Inches(a[0]),Inches(a[1]),Inches(b[0]),Inches(b[1])); line.line.color.rgb=CYAN; line.line.width=Pt(1.5)
txt(s,'No implicit trust\nAuthorization is continuous\nIntegrity is shared',1.1,5.45,4.4,.55,12,MID,False,PP_ALIGN.CENTER)
panel(s,6.25,1.75,6.1,1.35,'Permissioned blockchain','Shared consensus and immutable history support integrity and auditability.',BLUE,12)
panel(s,6.25,3.28,6.1,1.35,'Full-backup architecture','Every full node maintains a local copy of on-chain data.',CYAN,12)
panel(s,6.25,4.81,6.1,1.35,'The tension','The same replication that improves availability increases storage cost and privacy exposure.',GOLD,12)
footer(s); note(s,'Student 1 (1:10). Explain the motivation literally. In zero trust, no central authorization point is implicitly trusted. Permissioned blockchain is attractive because participants collectively maintain integrity, but each full node stores a full backup. This creates the exact tension DedupChain addresses.')

# 4 gap
s=ss[3]; header(s,'Research gap: conventional secure deduplication is not enough',num=4)
shape(s,.7,1.65,5.9,4.95,WHITE,True,RGBColor(214,222,234)); txt(s,'CONVENTIONAL MLE-BASED DEDUPLICATION',1.0,1.92,5.3,.32,14,NAVY,True,PP_ALIGN.CENTER)
box(s,1.0,2.65,1.55,.7,'Plaintext M',PALE); arrow(s,2.72,2.87,.5); box(s,3.35,2.65,1.55,.7,'Hash → key',ICE,CYAN); arrow(s,5.08,2.87,.5); box(s,1.0,4.0,1.55,.7,'Ciphertext C',PALE); arrow(s,2.72,4.22,.5); box(s,3.35,4.0,1.55,.7,'Deduplicate',ICE,CYAN)
txt(s,'Same plaintext → same ciphertext',1.0,5.22,4.9,.28,14,RED,True,PP_ALIGN.CENTER)
shape(s,6.85,1.65,5.75,4.95,RGBColor(255,249,234),True,GOLD); txt(s,'WHY THIS FAILS ON A FULL NODE',7.18,1.92,5.1,.32,14,NAVY,True,PP_ALIGN.CENTER)
panel(s,7.18,2.55,5.1,1.25,'Offline brute-force','Guess M′ → derive C′ → compare with the compromised node’s ciphertext.',RED,11)
panel(s,7.18,4.0,5.1,1.25,'Frequency analysis','Observe duplicate counts and match them to a background distribution.',GOLD,11)
txt(s,'The paper targets these two leakage paths—not every possible side channel.',7.2,5.75,5.0,.45,11,MID,False,PP_ALIGN.CENTER); footer(s); note(s,'Student 1 (1:15). Message-locked encryption preserves deduplication by making equal plaintexts produce equal ciphertexts. That property is useful for deduplication but creates two explicit attacks. The paper’s contribution is to change where and how deduplication decisions are made.')

# 5 threat model
s=ss[4]; header(s,'Threat model: what the adversary can observe',num=5)
txt(s,'Adversary compromises one untrusted full node or observes the proxy boundary.',.75,1.42,11.8,.35,15,NAVY,True,PP_ALIGN.CENTER)
# two lanes
shape(s,.75,2.05,5.85,3.95,WHITE,True,RGBColor(214,222,234)); txt(s,'ATTACK 1 · OFFLINE BRUTE FORCE',1.0,2.3,5.3,.28,14,RED,True,PP_ALIGN.CENTER)
box(s,1.1,3.0,1.3,.62,'Guess M′',RGBColor(255,241,241),RED,11); arrow(s,2.55,3.2,.45,RED); box(s,3.1,3.0,1.3,.62,'Derive C′',RGBColor(255,241,241),RED,11); arrow(s,4.55,3.2,.45,RED); box(s,5.1,3.0,1.0,.62,'Match',RGBColor(255,241,241),RED,11); txt(s,'Defense target: keys and deduplication access stay inside SGX + ORAM.',1.05,4.35,5.1,.7,12,MID,False,PP_ALIGN.CENTER)
shape(s,6.75,2.05,5.85,3.95,WHITE,True,RGBColor(214,222,234)); txt(s,'ATTACK 2 · FREQUENCY ANALYSIS',7.0,2.3,5.3,.28,14,GOLD,True,PP_ALIGN.CENTER)
box(s,7.1,3.0,1.35,.62,'Observe',RGBColor(255,249,234),GOLD,11); arrow(s,8.6,3.2,.45,GOLD); box(s,9.15,3.0,1.35,.62,'Count',RGBColor(255,249,234),GOLD,11); arrow(s,10.65,3.2,.45,GOLD); box(s,11.2,3.0,1.0,.62,'Infer',RGBColor(255,249,234),GOLD,11); txt(s,'Defense target: hide which fingerprint, key, or ORAM path is accessed.',7.05,4.35,5.1,.7,12,MID,False,PP_ALIGN.CENTER); footer(s); note(s,'Student 1 (1:10). Keep the threat model precise. The attacker wants to infer plaintext or frequency information from deterministic deduplication. DedupChain uses a frontend proxy and oblivious operations so the untrusted blockchain nodes do not receive the deduplication signal.')

# 6 overview
s=ss[5]; header(s,'DedupChain at a glance',num=6)
# architecture lane
box(s,.7,2.05,1.55,.8,'CLIENT',WHITE,BLUE,14); arrow(s,2.42,2.32,.5,CYAN); box(s,3.05,1.7,2.45,1.5,'DEDUPLICATION\nPROXY\nSGX ENCLAVE',PALE,BLUE,14); arrow(s,5.75,2.32,.5,CYAN); box(s,6.38,1.7,2.3,1.5,'POLICY CHAIN\nkeys + recipes',WHITE,NAVY,13); arrow(s,8.95,2.32,.5,CYAN); box(s,9.58,1.7,2.75,1.5,'DATA CHAIN\nencrypted chunks',WHITE,NAVY,13)
# inside components
for i,(x,l) in enumerate([(3.15,'c-LDCF'),(4.15,'ORAM'),(5.15,'Keys')]): box(s,x,4.1,.9,.65,l,ICE,CYAN,11)
txt(s,'Inside SGX: membership check · path calculation · key retrieval · fresh-key generation',2.95,5.05,8.0,.4,13,NAVY,True,PP_ALIGN.CENTER)
shape(s,.9,5.85,11.5,.58,PALE,True,BLUE); txt(s,'Only encrypted, non-duplicate data chunks are committed to the data chain.',1.1,6.02,11.1,.25,14,NAVY,True,PP_ALIGN.CENTER); footer(s); note(s,'Student 2 (1:00). Present the complete system in one pass. The client sends chunks to the enclave. The enclave handles duplicate detection and key retrieval. The policy chain stores encrypted keys and recipes; the data chain stores encrypted chunk records. This separation is central to the design.')

# 7 workflow
s=ss[6]; header(s,'Upload workflow: from chunks to a verified recipe',num=7)
steps=[('01','Attest','Establish secure channel with SGX'),('02','Chunk','Split item into c1…cn'),('03','Fingerprint','Check c-LDCF membership'),('04','ORAM','Read duplicate paths obliviously'),('05','Commit','Write new encrypted records'),('06','Return','Send K + recipe to client')]
for i,(n,h,b) in enumerate(steps):
 x=.55+i*2.12; shape(s,x,1.95,1.83,3.4,WHITE,True,RGBColor(214,222,234)); shape(s,x,1.95,1.83,.1,[BLUE,CYAN,GOLD,BLUE,CYAN,GOLD][i]); txt(s,n,x+.15,2.25,1.5,.32,20,NAVY,True,PP_ALIGN.CENTER); txt(s,h,x+.13,2.9,1.56,.35,13,INK,True,PP_ALIGN.CENTER); txt(s,b,x+.15,3.55,1.5,1.0,11,MID,False,PP_ALIGN.CENTER)
 if i<5: arrow(s,x+1.9,3.45,.25,CYAN)
shape(s,.8,5.85,11.7,.55,RGBColor(255,249,234),True,GOLD); txt(s,'Duplicate chunk → retrieve existing key.   New chunk → generate fresh key and write encrypted record.',1.0,6.0,11.3,.22,12,NAVY,True,PP_ALIGN.CENTER); footer(s); note(s,'Student 2 (1:05). Walk through the complete upload sequence. The client first attests the enclave and establishes a secure channel. The enclave computes fingerprints, checks membership, reads duplicate paths through ORAM, creates keys for new chunks, writes the required records, and returns the key set and recipe.')

# 8 c-LDCF
s=ss[7]; header(s,'Filter-aided ORAM: memory efficiency inside SGX',num=8)
shape(s,.72,1.65,4.0,4.95,PALE,True,BLUE); txt(s,'c-LDCF',1.0,1.95,3.4,.4,25,NAVY,True,PP_ALIGN.CENTER); txt(s,'Counting Logarithmic Dynamic Cuckoo Filter',1.0,2.48,3.4,.35,11,MID,False,PP_ALIGN.CENTER)
# filter tree
box(s,1.2,3.1,1.0,.62,'root',WHITE,BLUE,11); arrow(s,1.56,3.82,.4,CYAN,True); box(s,.95,4.25,1.1,.62,'sub-0',WHITE,BLUE,11); box(s,2.35,4.25,1.1,.62,'sub-1',WHITE,BLUE,11); txt(s,'fingerprints + encrypted counters',1.0,5.25,3.2,.45,12,NAVY,True,PP_ALIGN.CENTER)
shape(s,5.05,1.65,7.55,4.95,WHITE,True,RGBColor(214,222,234)); txt(s,'Why it replaces the position map',5.4,1.95,6.85,.3,15,NAVY,True,PP_ALIGN.CENTER)
panel(s,5.4,2.55,3.15,1.25,'Compact representation','Stores fingerprints and access counters rather than full chunk identifiers.',BLUE,11)
panel(s,8.8,2.55,3.15,1.25,'On-demand loading','Partitions are loaded into the enclave only when needed.',CYAN,11)
panel(s,5.4,4.05,3.15,1.25,'Path location','Counter nδ helps calculate the current and future ORAM path.',GOLD,11)
panel(s,8.8,4.05,3.15,1.25,'Security role','The enclave hides exact membership and counter updates from observers.',GREEN,11)
footer(s); note(s,'Student 2 (1:10). Explain the memory problem. A conventional position map can become too large for trusted memory. c-LDCF compresses membership information into fingerprints and counters, partitions it, and loads only the active sub-filter. The counter supports ORAM path calculation and the enclave protects the operation.')

# 9 double trees
s=ss[8]; header(s,'Double-trees: fast access plus blockchain verification',num=9)
shape(s,.72,1.7,5.85,4.85,WHITE,True,RGBColor(214,222,234)); txt(s,'ON-CHAIN MERKLE TREE',1.0,2.0,5.3,.3,16,NAVY,True,PP_ALIGN.CENTER)
# merkle
for x in [1.7,3.15,4.6]: node_circle(s,x,2.75,.55,'k',NAVY)
for x in [2.45,3.9]: node_circle(s,x,3.65,.55,'H',BLUE)
node_circle(s,3.15,4.55,.55,'R',GOLD); txt(s,'append once · verify · recover',1.1,5.45,5.1,.3,12,MID,True,PP_ALIGN.CENTER)
shape(s,6.78,1.7,5.85,4.85,PALE,True,BLUE); txt(s,'OFF-CHAIN ORAM TREE',7.05,2.0,5.3,.3,16,NAVY,True,PP_ALIGN.CENTER)
box(s,9.05,2.65,1.3,.62,'root',WHITE,BLUE,11); arrow(s,9.55,3.4,.35,CYAN,True); box(s,8.0,3.95,1.3,.62,'path A',WHITE,BLUE,11); box(s,10.1,3.95,1.3,.62,'path B',WHITE,BLUE,11); txt(s,'oblivious read / flush / write-back',7.35,5.45,4.7,.3,12,MID,True,PP_ALIGN.CENTER)
shape(s,2.1,6.72,9.2,.42,RGBColor(255,249,234),True,GOLD); txt(s,'Same encrypted (h, k) pairs · different roles · no consensus round trip for every ORAM access',2.25,6.82,8.9,.18,11,NAVY,True,PP_ALIGN.CENTER); footer(s); note(s,'Student 2 (1:05). The paper duplicates encrypted key pairs into two structures. The off-chain ORAM tree gives timely access. The on-chain Merkle tree provides verification and recovery through blockchain consensus. Because symmetric keys are not updated after creation, the on-chain copy can be written once.')

# 10 optimization
s=ss[9]; header(s,'Optimization: three mechanisms that improve concurrency',num=10)
cols=[('MULTI-PATH ORAM','Batch Flush across the paths touched by one request.','Less repeated eviction work.',BLUE),('MUTUALLY EXCLUSIVE ORAM','Partition chunks across independent OClients and trees.','Parallel access with less redundant state.',CYAN),('ASYNCHRONOUS EXECUTION','Overlap ReadPath, Flush, and WriteBack through threads.','Higher concurrency under consistency rules.',GOLD)]
for i,(h,b,benefit,c) in enumerate(cols):
 x=.72+i*4.18; shape(s,x,1.85,3.75,3.8,WHITE,True,RGBColor(214,222,234)); shape(s,x,1.85,3.75,.16,c); txt(s,f'0{i+1}',x+.22,2.25,.45,.4,24,c,True); txt(s,h,x+.22,2.95,3.2,.55,15,NAVY,True); txt(s,b,x+.22,3.9,3.15,.9,12,INK); txt(s,benefit,x+.22,5.15,3.15,.35,12,MID,True)
shape(s,1.0,6.05,11.3,.48,PALE,True,BLUE); txt(s,'Correctness constraints: never evict a requested key before reply; never delete a requested path before read-back.',1.2,6.18,10.9,.2,11,NAVY,True,PP_ALIGN.CENTER); footer(s); note(s,'Student 3 (1:05). These mechanisms address different bottlenecks. Multi-path ORAM batches operations, mutually exclusive ORAM enables several OClients, and asynchronous execution overlaps tasks. The paper also specifies two constraints so concurrency does not break ORAM consistency.')

# 11 versioning
s=ss[10]; header(s,'Version management and secure download',num=11)
shape(s,.72,1.7,7.1,4.9,WHITE,True,RGBColor(214,222,234)); txt(s,'ENCRYPTED VERSION GRAPH',1.05,2.0,6.4,.3,15,NAVY,True,PP_ALIGN.CENTER)
box(s,1.3,3.0,1.55,.75,'V0\noriginal',PALE,BLUE,13); arrow(s,3.0,3.25,.55,CYAN); box(s,3.75,2.55,1.55,.75,'V1\npublic',ICE,CYAN,13); arrow(s,5.45,2.8,.55,CYAN); box(s,6.15,2.1,1.2,.75,'V2\nbranch',PALE,GOLD,12); arrow(s,5.45,4.0,.55,GOLD); box(s,3.75,4.25,1.55,.75,'V1′\nprivate',RGBColor(255,249,234),GOLD,13); txt(s,'EMM stores parent → child recipe references on the policy chain.',1.25,5.45,6.0,.4,12,MID,True,PP_ALIGN.CENTER)
shape(s,8.05,1.7,4.55,4.9,PALE,True,BLUE); txt(s,'DOWNLOAD',8.35,2.0,3.95,.3,15,NAVY,True,PP_ALIGN.CENTER); box(s,8.65,2.8,1.45,.7,'Recipe',WHITE,BLUE,12); arrow(s,10.25,3.02,.45,CYAN); box(s,10.85,2.8,1.25,.7,'hᵢ',WHITE,BLUE,12); arrow(s,9.3,3.75,.35,CYAN,True); box(s,8.65,4.2,1.45,.7,'Cᵢ',WHITE,NAVY,12); arrow(s,10.25,4.42,.45,CYAN); box(s,10.85,4.2,1.25,.7,'kᵢ',WHITE,GOLD,12); txt(s,'Client decrypts locally with cached keys.',8.55,5.4,3.6,.42,12,MID,True,PP_ALIGN.CENTER); footer(s); note(s,'Student 3 (1:00). DedupChain integrates version management with deduplication. The encrypted multi-map records parent-child relationships, supports branching, and distinguishes public and private recipes. For download, the client uses the recipe to locate encrypted chunks and decrypts them with the corresponding cached keys.')

# 12 security
s=ss[11]; header(s,'Security analysis: mapping each leakage path to a defense',num=12)
shape(s,.75,1.65,11.85,.65,NAVY,True,NAVY); txt(s,'LEAKAGE PATH',.95,1.84,2.4,.24,12,WHITE,True); txt(s,'WHAT THE ADVERSARY WANTS',3.5,1.84,3.0,.24,12,WHITE,True); txt(s,'DEDUPCHAIN DEFENSE',7.2,1.84,3.7,.24,12,WHITE,True)
rows=[('Key access','Which duplicate key was retrieved?','Path ORAM hides the accessed location.',BLUE),('Membership check','Which fingerprint exists?','SGX hides the exact fingerprint; cache hides detail.',CYAN),('Counter update','Which chunk frequency changed?','Encrypted array is re-encrypted as a whole.',GOLD),('Ciphertext guessing','Which plaintext matches C?','Fresh symmetric keys break direct deterministic guessing.',GREEN)]
for i,(a,b,c,col) in enumerate(rows):
 y=2.5+i*.86; shape(s,.75,y,11.85,.7,WHITE if i%2==0 else PALE,True,RGBColor(224,230,238)); shape(s,.75,y,.09,.7,col); txt(s,a,.98,y+.13,2.25,.35,12,NAVY,True); txt(s,b,3.5,y+.13,3.35,.35,11,INK); txt(s,c,7.2,y+.13,4.95,.35,11,INK)
shape(s,1.05,6.25,11.2,.48,RGBColor(255,249,234),True,GOLD); txt(s,'Claim boundary: the paper proves security under its stated threat model; it does not claim universal resistance to every side channel.',1.25,6.37,10.8,.22,11,NAVY,True,PP_ALIGN.CENTER); footer(s); note(s,'Student 3 (1:15). Present security as a mapping, not as a marketing claim. The paper analyzes three possible leakage phases for frequency and uses ORAM, SGX, and encrypted counters to hide them. It also proves semantic security under its stated model. The scope boundary should be stated clearly.')

# 13 evaluation
s=ss[12]; header(s,'Experimental evaluation: setup, parameters, and reported results',num=13)
shape(s,.68,1.55,3.25,5.25,NAVY,True,NAVY); txt(s,'PROTOTYPE SETUP',.95,1.85,2.7,.3,15,WHITE,True,PP_ALIGN.CENTER); bullets(s,['Ubuntu 18.04','64 GB RAM','Intel i7-10700','SGX enclave: 128 MB','Intel SGX SSL + OpenSSL 1.1.1n','SHA-256 fingerprints','20 repetitions; average reported'],.95,2.45,2.65,3.25,11,RGBColor(226,235,250))
# use paper crop
s.shapes.add_picture(str(AS/'paper_results_clean.png'),Inches(4.25),Inches(1.65),width=Inches(4.15),height=Inches(2.75)); txt(s,'Paper Fig. 8–9: upload delay and throughput trends',4.35,4.48,3.95,.22,8,MID,False,PP_ALIGN.CENTER)
panel(s,8.65,1.65,3.8,1.45,'Headline result','Upload throughput exceeds 400 TPS.',BLUE,14)
panel(s,8.65,3.3,3.8,1.45,'Membership checking','About 320 ms for 1,600 chunks in the reported configuration.',CYAN,12)
panel(s,8.65,4.95,3.8,1.45,'Observed trends','More nodes and larger requests reduce blockchain throughput; more non-duplicate chunks improve upload throughput.',GOLD,11)
footer(s); note(s,'Student 3 (1:25). Report the setup and avoid inventing chart values. The prototype uses Ubuntu 18.04, 64 GB RAM, Intel i7-10700, a 128 MB SGX enclave, Intel SGX SSL, OpenSSL 1.1.1n, SHA-256, and 20-run averages. The paper reports more than 400 TPS upload throughput and about 320 ms for membership checking over 1,600 chunks.')

# 14 conclusion
s=ss[13]; header(s,'Conclusions, contributions, and discussion',num=14,dark=True)
for i,(h,b) in enumerate([('01','Oblivious deduplication\nprotects against the two targeted attacks.'),('02','Filter-aided ORAM + double trees\naddress memory and verification.'),('03','Concurrency optimizations\nimprove practical throughput.')]):
 x=.75+i*4.18; shape(s,x,1.7,3.75,2.25,WHITE,True,WHITE); txt(s,h,x+.2,1.98,.5,.35,24,[BLUE,CYAN,GOLD][i],True); txt(s,h.replace('01','Core security').replace('02','Core architecture').replace('03','Core performance'),x+.2,2.55,3.1,.3,14,NAVY,True); txt(s,b,x+.2,3.1,3.1,.6,12,INK)
shape(s,.75,4.55,11.85,1.15,RGBColor(33,61,120),True,RGBColor(33,61,120)); txt(s,'Primary reference',1.0,4.78,1.8,.25,12,RGBColor(192,210,240),True); txt(s,'S. Qi et al., “DedupChain: A Secure Blockchain-Enabled Storage System With Deduplication for Zero-Trust Network,” IEEE JSAC, vol. 43, no. 6, 2025. DOI: 10.1109/JSAC.2025.3560043.',2.9,4.66,9.25,.46,10,WHITE)
txt(s,'Thank you · Discussion and questions',.9,6.15,11.5,.42,22,WHITE,True,PP_ALIGN.CENTER); footer(s,'All scientific content and numerical results are grounded in the supplied paper.',True); note(s,'Student 3 (1:10). Close with the three contributions and restate the research value. DedupChain makes a permissioned blockchain more practical as a zero-trust storage foundation by moving the deduplication decision into a trusted, oblivious proxy. Invite the five-minute discussion.')

# save
prs.save(str(PPTX))
# concise updated script
D=Document(); D.add_heading('DedupChain Presentation Script — Manual Redesign',0); D.add_paragraph('14 slides | 15-minute presentation + 5-minute discussion | Academic English')
D.add_paragraph('Source: Qi et al., IEEE JSAC, vol. 43, no. 6, 2025. DOI 10.1109/JSAC.2025.3560043.')
assign=[('Student 1 — Amal Ali Alghamdi (Slides 1–5)',[(1,'0:45','Introduce the paper, title, presenters, and the specific problem: secure deduplication for zero-trust blockchain storage.'),(2,'1:00','State the research question and roadmap: problem, mechanism, system, and evidence.'),(3,'1:10','Explain zero trust, permissioned blockchain, full-backup storage, and the resulting tension.'),(4,'1:15','Explain why deterministic MLE-style deduplication enables offline brute-force and frequency analysis.'),(5,'1:10','Define what the adversary observes and which two attack paths the paper targets.')]),('Student 2 — Nouf Mabrouk Alghamdi (Slides 6–9)',[(6,'1:00','Walk through the DedupChain architecture and the roles of the client, proxy, policy chain, and data chain.'),(7,'1:05','Explain attestation, chunking, c-LDCF membership, ORAM reads, encrypted writes, and key return.'),(8,'1:10','Explain c-LDCF and filter-aided ORAM as the memory-efficient replacement for a large position map.'),(9,'1:05','Explain how the on-chain Merkle tree and off-chain ORAM tree provide verification and fast access.')]),('Student 3 — Samia Jumaan Alghamdi (Slides 10–14)',[(10,'1:05','Explain multi-path ORAM, mutually exclusive ORAM, asynchronous execution, and their consistency constraints.'),(11,'1:00','Explain encrypted version graphs, branching, public/private recipes, and secure download.'),(12,'1:15','Map each leakage phase to its defense and state the paper’s security-model boundary.'),(13,'1:25','Present the exact experimental setup and reported results: 128 MB SGX, 20-run averages, >400 TPS, and ~320 ms for 1,600 chunks.'),(14,'1:10','Summarize the three contributions, cite the paper, and open discussion.')])]
for who,parts in assign:
 D.add_heading(who,1)
 for sl,dur,body in parts:
  p=D.add_paragraph(); p.add_run(f'Slide {sl} | {dur} — ').bold=True; p.add_run(body)
D.add_heading('Discussion prompts',1); D.add_paragraph('Be prepared to explain why SGX alone is insufficient, why ORAM is needed, why two trees are maintained, how c-LDCF controls enclave memory, and which values are explicitly reported by the authors.')
D.save(str(SCRIPT))
print(PPTX)
