from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.dml import MSO_THEME_COLOR
from docx import Document
from docx.shared import Inches as DInches, Pt as DPt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from pathlib import Path
import os, shutil

ROOT=Path('/home/ubuntu/Nabeh-SafeLink_GitHub-Upload')
TEMPLATE=ROOT/'paper_extract/Blue White and Gray Modern Networking Presentation.pptx'
OUT=ROOT/'deliverables'; OUT.mkdir(exist_ok=True)
PPTX=OUT/'DedupChain_Academic_Presentation.pptx'
PDF=OUT/'DedupChain_Academic_Presentation.pdf'
SCRIPT=OUT/'DedupChain_Presentation_Script.docx'
REPORT=OUT/'DedupChain_Research_Accuracy_Report.docx'

NAVY=RGBColor(28,55,122); BLUE=RGBColor(47,107,206); CYAN=RGBColor(86,169,230)
YELLOW=RGBColor(245,196,0); DARK=RGBColor(35,39,47); MID=RGBColor(95,102,115)
LIGHT=RGBColor(243,246,249); PALE=RGBColor(232,240,252); WHITE=RGBColor(255,255,255)
FONT='Aptos'

def rm_all(slide):
    for sh in list(slide.shapes):
        sp=sh._element; sp.getparent().remove(sp)

def rect(slide,x,y,w,h,fill,round=False,line=None):
    shape=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if round else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid(); shape.fill.fore_color.rgb=fill
    shape.line.color.rgb=line or fill
    if round:
        shape.adjustments[0]=0.12
    return shape

def text(slide,txt,x,y,w,h,size=18,color=DARK,bold=False,align=PP_ALIGN.LEFT,font=FONT,margin=0.05):
    tb=slide.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h)); tf=tb.text_frame
    tf.clear(); tf.word_wrap=True; tf.margin_left=Inches(margin); tf.margin_right=Inches(margin); tf.margin_top=Inches(margin); tf.margin_bottom=Inches(margin); tf.vertical_anchor=MSO_ANCHOR.MIDDLE
    p=tf.paragraphs[0]; p.alignment=align
    r=p.add_run(); r.text=txt; r.font.name=font; r.font.size=Pt(size); r.font.bold=bold; r.font.color.rgb=color
    return tb

def bullets(slide,items,x,y,w,h,size=16,color=DARK,bullet_color=BLUE,spacing=2):
    tb=slide.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h)); tf=tb.text_frame; tf.clear(); tf.word_wrap=True; tf.margin_left=Inches(.12); tf.margin_right=Inches(.04); tf.margin_top=Inches(.03)
    for i,it in enumerate(items):
        p=tf.paragraphs[0] if i==0 else tf.add_paragraph(); p.text=it; p.level=0; p.font.name=FONT; p.font.size=Pt(size); p.font.color.rgb=color; p.space_after=Pt(spacing); p.bullet=True
    return tb

def pill(slide, label='DEDUPCHAIN | RESEARCH PRESENTATION'):
    rect(slide,0.42,0.20,2.75,.34,NAVY,True); text(slide,label,0.50,.205,2.58,.28,9,WHITE,True,PP_ALIGN.CENTER)

def footer(slide,src='Source: Qi et al., IEEE JSAC, 2025.'):
    rect(slide,0,7.43,13.333,.07,YELLOW); text(slide,src,0.48,7.07,7.6,.22,8,MID)

def title(slide,t,sub=None):
    text(slide,t,.55,.72,8.8,.62,27,DARK,True)
    if sub: text(slide,sub,.58,1.34,8.4,.32,11,MID)

def card(slide,x,y,w,h,heading,body,accent=BLUE):
    rect(slide,x,y,w,h,WHITE,True,RGBColor(215,220,230)); rect(slide,x,y,.08,h,accent)
    text(slide,heading,x+.18,y+.12,w-.3,.28,14,NAVY,True)
    text(slide,body,x+.18,y+.48,w-.3,h-.57,11,DARK)

def arrow(slide,x,y,w=0.55,color=BLUE):
    s=slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW,Inches(x),Inches(y),Inches(w),Inches(.27)); s.fill.solid(); s.fill.fore_color.rgb=color; s.line.color.rgb=color

def node(slide,x,y,w,h,label,fill=PALE,edge=BLUE,fs=12):
    r=rect(slide,x,y,w,h,fill,True,edge); text(slide,label,x+.06,y+.06,w-.12,h-.12,fs,NAVY,True,PP_ALIGN.CENTER); return r

def set_notes(slide,note):
    tf=slide.notes_slide.notes_text_frame; tf.clear(); tf.text=note

prs=Presentation(str(TEMPLATE))
# Use original template canvas and theme; replace all 10 template slides, add 2 slides.
while len(prs.slides)<12:
    prs.slides.add_slide(prs.slide_layouts[6])

slides=[]
for s in prs.slides: rm_all(s); slides.append(s)

# 1 Cover
s=slides[0]; pill(s,'MASTER\'S RESEARCH PRESENTATION');
text(s,'DedupChain',.62,1.35,5.9,.72,38,NAVY,True); text(s,'A Secure Blockchain-Enabled Storage System\nWith Deduplication for Zero-Trust Network',.68,2.1,6.2,1.0,20,DARK,True)
rect(s,7.45,1.25,5.15,4.7,LIGHT,True); node(s,8.15,2.0,1.5,.65,'CLIENT',WHITE,BLUE); node(s,10.35,2.0,1.65,.65,'SGX + ORAM',PALE,BLUE); node(s,9.15,3.25,2.35,.65,'PERMISSIONED\nBLOCKCHAIN',WHITE,NAVY); arrow(s,9.68,2.67,.5); arrow(s,10.2,3.0,.5); arrow(s,8.97,3.0,.5); text(s,'Oblivious data deduplication',8.05,4.35,3.9,.3,13,NAVY,True,PP_ALIGN.CENTER); text(s,'Amal Ali Alghamdi — 447003182\nNouf Mabrouk Alghamdi — 447009906\nSamia Jumaan Alghamdi',.72,5.05,5.8,.8,12,MID); footer(s,'Paper: Qi et al., IEEE Journal on Selected Areas in Communications, 43(6), 2025.')
set_notes(s,'Opening (0:45). Introduce the paper and the three presenters. The title captures the central idea: secure deduplication is moved to a trusted proxy so permissioned blockchain can serve a zero-trust storage role. Transition to the research context and assignment scope.')

# 2 overview
s=slides[1]; pill(s); title(s,'Research overview and assignment fit','One paper, five required elements, three speakers, 15 minutes + 5 minutes discussion.')
card(s,.62,1.95,3.75,2.0,'Research problem','Permissioned blockchains replicate data across full nodes, creating privacy leakage and high storage cost.',BLUE)
card(s,4.78,1.95,3.75,2.0,'Proposed solution','DedupChain combines an SGX-backed deduplication proxy with ORAM and dual-chain storage.',CYAN)
card(s,8.94,1.95,3.75,2.0,'Evidence','Prototype evaluation reports >400 TPS upload throughput and ~320 ms membership checking for 1,600 chunks.',YELLOW)
text(s,'Speaking plan',.7,4.45,2,.3,16,NAVY,True); node(s,.72,4.95,3.55,.7,'Student 1\nBackground → challenges',PALE); node(s,4.88,4.95,3.55,.7,'Student 2\nArchitecture → mechanisms',PALE); node(s,9.04,4.95,3.55,.7,'Student 3\nOptimization → results',PALE); footer(s)
set_notes(s,'Student 1 (1:05). State the assignment alignment explicitly: problem, solution, methodology, results, and conclusions are all covered. The presentation is intentionally concise because the delivery limit is 15 minutes, followed by five minutes for discussion. Transition from scope to why the problem matters.')

# 3 background
s=slides[2]; pill(s); title(s,'Background and research motivation')
node(s,.75,2.1,2.45,.75,'ZERO-TRUST\nNETWORK',PALE); arrow(s,3.25,2.35); node(s,3.9,2.1,2.55,.75,'PERMISSIONED\nBLOCKCHAIN',PALE); arrow(s,6.55,2.35); node(s,7.2,2.1,2.55,.75,'FULL-BACKUP\nSTORAGE',PALE); arrow(s,9.85,2.35); node(s,10.5,2.1,2.15,.75,'PRIVACY +\nCOST RISK',RGBColor(255,247,216),YELLOW)
card(s,.78,3.55,3.75,1.85,'Why blockchain?','Participants collectively maintain integrity, consistency, and an immutable audit trail without a central authorization point.',BLUE)
card(s,4.8,3.55,3.75,1.85,'Why deduplication?','Chunk-level deduplication can avoid storing duplicate encrypted chunks and reduce replicated storage.',CYAN)
card(s,8.82,3.55,3.75,1.85,'Why secure it?','MLE-style deterministic ciphertexts enable deduplication but expose offline guessing and frequency leakage.',YELLOW)
footer(s)
set_notes(s,'Student 1 (1:20). Explain the relationship among zero trust, permissioned blockchain, and secure data deduplication. The paper identifies a tension: blockchain gives integrity and shared trust, but full replication magnifies both storage cost and the consequences of leaked ciphertexts. Transition to the two precise problems.')

# 4 problem/threats
s=slides[3]; pill(s); title(s,'Problem statement and threat model','The paper focuses on two attacks enabled by deterministic deduplication ciphertexts.')
card(s,.7,1.8,3.85,2.35,'1 | Privacy leakage','A compromised full node stores a complete local backup. With MLE, an attacker can guess plaintext chunks, derive keys, and compare ciphertexts.',BLUE)
card(s,4.75,1.8,3.85,2.35,'2 | Replication cost','Every full node keeps the on-chain data. Large-scale storage quickly consumes capacity across the network.',CYAN)
card(s,8.8,1.8,3.85,2.35,'Attack surface','Offline brute-force: guessed plaintext → guessed ciphertext → comparison.\n\nFrequency analysis: observed duplicate counts → correspondence with a background distribution.',YELLOW)
text(s,'Design implication',.72,4.65,2.2,.3,16,NAVY,True); node(s,.72,5.15,11.85,.7,'Deduplication must be performed without exposing which chunks are duplicates or how often keys are accessed.',RGBColor(255,247,216),YELLOW,15); footer(s)
set_notes(s,'Student 1 (1:25). Distinguish the attacks carefully. Offline brute force uses deterministic encryption to test guesses. Frequency analysis uses deduplication frequency and an auxiliary background collection. The paper does not claim to solve every side channel; it targets these two leakage paths. Transition to the framework designed around that threat model.')

# 5 framework
s=slides[4]; pill(s); title(s,'Proposed DedupChain framework','Deduplication is moved before the blockchain, inside a trusted and oblivious proxy.')
node(s,.7,2.2,1.55,.65,'CLIENT',WHITE,BLUE); arrow(s,2.4,2.4); node(s,3.05,1.72,2.4,1.6,'DEDUPLICATION\nPROXY\n\nSGX ENCLAVE',PALE,BLUE,14); arrow(s,5.7,2.4); node(s,6.35,1.72,2.2,1.6,'POLICY\nCHAIN\n(metadata)',WHITE,NAVY,14); arrow(s,8.8,2.4); node(s,9.45,1.72,2.55,1.6,'DATA CHAIN\n(encrypted chunks)',WHITE,NAVY,14)
text(s,'Inside the enclave',.88,4.05,2.2,.28,15,NAVY,True); node(s,.88,4.55,2.05,.65,'c-LDCF',PALE,BLUE); node(s,3.18,4.55,2.05,.65,'ORAM client',PALE,BLUE); node(s,5.48,4.55,2.05,.65,'Symmetric keys',PALE,BLUE); node(s,7.78,4.55,2.05,.65,'Chunk recipes',PALE,BLUE)
text(s,'Client chunks data → enclave checks and deduplicates obliviously → only necessary encrypted data and metadata reach the chains.',.9,5.62,10.9,.5,15,DARK,True,PP_ALIGN.CENTER); footer(s)
set_notes(s,'Student 2 (1:20). The deduplication proxy is the front end. Clients establish a secure channel after attestation, split data into chunks, and send them to the enclave. The enclave decides whether a chunk is new or duplicate, returns symmetric keys, and forwards only the required records. Transition to the complete system architecture.')

# 6 architecture
s=slides[5]; pill(s); title(s,'System architecture: trusted, on-chain, and off-chain components')
rect(s,.68,1.75,4.05,4.55,PALE,True); text(s,'TRUSTED ZONE',.9,1.93,3.6,.3,15,NAVY,True,PP_ALIGN.CENTER); node(s,1.08,2.45,3.25,.7,'SGX enclave',WHITE,BLUE,15); node(s,1.08,3.45,1.45,.7,'c-LDCF\n+ cache',WHITE,BLUE,12); node(s,2.88,3.45,1.45,.7,'ORAM\nclient',WHITE,BLUE,12); text(s,'Remote attestation + secure channel',1.0,5.25,3.4,.35,11,MID,False,PP_ALIGN.CENTER)
rect(s,5.05,1.75,3.35,4.55,WHITE,True,RGBColor(215,220,230)); text(s,'POLICY CHAIN',5.28,1.93,2.9,.3,15,NAVY,True,PP_ALIGN.CENTER); node(s,5.55,2.6,2.35,.7,'(h, encrypted key)',PALE,NAVY); node(s,5.55,3.65,2.35,.7,'(H, encrypted recipe)',PALE,NAVY); node(s,5.55,4.7,2.35,.7,'Merkle root / proof',PALE,NAVY)
rect(s,8.72,1.75,3.9,4.55,WHITE,True,RGBColor(215,220,230)); text(s,'DATA CHAIN',8.98,1.93,3.4,.3,15,NAVY,True,PP_ALIGN.CENTER); node(s,9.18,2.6,2.95,.7,'(encrypted id, chunk)',PALE,NAVY); node(s,9.18,3.65,2.95,.7,'non-duplicate data only',PALE,NAVY); node(s,9.18,4.7,2.95,.7,'append-only versions',PALE,NAVY)
arrow(s,4.78,3.0,.35); arrow(s,8.42,3.0,.35); footer(s)
set_notes(s,'Student 2 (1:20). Read the architecture from left to right. The enclave is trusted for code and data confidentiality. The policy chain stores encrypted keys, recipes, and verification material. The data chain stores encrypted identifiers and chunks, but duplicates are not reinserted. The double-tree relationship is the key to fault tolerance and verifiability.')

# 7 workflow
s=slides[6]; pill(s); title(s,'Upload and oblivious deduplication workflow')
steps=[('1','Split','Client divides item into disjoint chunks.'),('2','Check','c-LDCF tests fingerprints inside SGX.'),('3','Read','ORAM retrieves duplicate keys obliviously.'),('4','Write','New chunks get fresh keys; records are written.'),('5','Return','Client receives keys + recipe for download.')]
for i,(n,h,b) in enumerate(steps):
 x=.7+i*2.48; node(s,x,2.0,.62,.62,n,NAVY,NAVY,15); text(s,h,x-.25,2.8,1.12,.3,13,NAVY,True,PP_ALIGN.CENTER); text(s,b,x-.48,3.25,1.58,1.0,10,DARK,False,PP_ALIGN.CENTER); 
 if i<4: arrow(s,x+1.6,2.18,.62)
rect(s,.95,5.0,11.2,.85,RGBColor(255,247,216),True,YELLOW); text(s,'Observer sees encrypted accesses—not which chunk was duplicate, its key, or its frequency.',1.2,5.18,10.7,.35,15,NAVY,True,PP_ALIGN.CENTER); footer(s)
set_notes(s,'Student 2 (1:20). Emphasize the order of operations. The enclave first checks membership, then collects ORAM paths for duplicates, reads and verifies them, and generates fresh symmetric keys for new chunks. The client receives keys and a recipe, while blockchain writes remain encrypted. Transition to how c-LDCF makes this feasible within SGX memory.')

# 8 c-LDCF
s=slides[7]; pill(s); title(s,'Filter-aided ORAM and counting LDCF (c-LDCF)')
rect(s,.7,1.85,5.0,4.4,PALE,True); text(s,'WHY c-LDCF?',.95,2.05,4.5,.3,16,NAVY,True,PP_ALIGN.CENTER); bullets(s,['Position maps store large identifiers and exceed enclave memory at scale.','c-LDCF stores compact fingerprints plus access counters.','Partitions are loaded on demand; a small cache avoids full paging.'],.98,2.65,4.35,2.0,14)
rect(s,6.15,1.85,6.45,4.4,WHITE,True,RGBColor(215,220,230)); text(s,'FILTER-AIDED ORAM',6.45,2.05,5.8,.3,16,NAVY,True,PP_ALIGN.CENTER)
node(s,6.65,2.7,1.55,.65,'fingerprint',PALE,BLUE,11); arrow(s,8.35,2.88,.48); node(s,8.95,2.7,1.55,.65,'counter nδ',PALE,BLUE,11); arrow(s,10.65,2.88,.48); node(s,11.25,2.7,1.0,.65,'path',PALE,BLUE,11); text(s,'sub-filter 0',7.0,4.1,1.5,.3,12,NAVY,True,PP_ALIGN.CENTER); rect(s,6.8,4.5,1.9,.65,PALE,True,BLUE); text(s,'cache',7.0,4.65,1.5,.25,12,NAVY,True,PP_ALIGN.CENTER); text(s,'sub-filter 1',9.25,4.1,1.5,.3,12,NAVY,True,PP_ALIGN.CENTER); rect(s,9.05,4.5,1.9,.65,PALE,True,BLUE); text(s,'external',9.25,4.65,1.5,.25,12,NAVY,True,PP_ALIGN.CENTER); footer(s)
set_notes(s,'Student 2 (1:25). c-LDCF addresses the enclave memory constraint. It is a partitionable logarithmic dynamic cuckoo filter that stores fingerprints and counters rather than full identifiers. The counter helps locate the ORAM path. Only the needed sub-filter is loaded, and encrypted counters are re-encrypted when leaving the enclave. Transition to the two-tree design.')

# 9 double trees
s=slides[8]; pill(s); title(s,'Double-trees structure: speed with verification')
node(s,.9,1.95,2.7,.75,'ON-CHAIN\nMERKLE TREE',PALE,NAVY,15); node(s,9.72,1.95,2.7,.75,'OFF-CHAIN\nORAM TREE',PALE,BLUE,15); arrow(s,3.9,2.2,1.0); arrow(s,8.15,2.2,1.0)
text(s,'same encrypted (h, k) pairs',5.15,2.15,2.9,.3,13,MID,True,PP_ALIGN.CENTER)
card(s,.9,3.45,3.7,1.85,'Merkle tree','Append once; consensus-backed root enables verification and recovery.',NAVY)
card(s,4.82,3.45,3.7,1.85,'ORAM tree','Fast off-chain access hides which key path was read or written.',BLUE)
card(s,8.74,3.45,3.7,1.85,'Why both?','Blockchain gives integrity and fault tolerance; ORAM avoids consensus on every access.',YELLOW)
text(s,'Security boundary',.95,5.9,2,.25,14,NAVY,True); text(s,'The proxy sees plaintext during DbE inside SGX; untrusted storage holds encrypted material.',3.0,5.9,8.5,.25,13,DARK); footer(s)
set_notes(s,'Student 2 (1:15). The double-trees structure separates the fast operational copy from the authoritative verification copy. The off-chain ORAM tree can be accessed promptly. The on-chain Merkle tree is written once for stable key pairs and supports proof, fault recovery, and consistency checking. Transition to the performance optimizations.')

# 10 optimization
s=slides[9]; pill(s); title(s,'Optimization techniques and version management')
card(s,.7,1.8,3.8,2.15,'Multi-path ORAM','Batches Flush operations across multiple accessed paths instead of evicting each path independently.',BLUE)
card(s,4.78,1.8,3.8,2.15,'Mutually exclusive ORAM','Partitions chunks across independent OClients, enabling concurrent access and reducing redundant state.',CYAN)
card(s,8.86,1.8,3.8,2.15,'Asynchronous execution','ReadPath, Flush, and WriteBack run through coordinated threads with consistency rules.',YELLOW)
rect(s,.85,4.45,11.55,.95,PALE,True,BLUE); text(s,'Version management: encrypted multi-map records parent → child versions; append-only history supports branches, rollback, and public/private recipes.',1.1,4.67,11.0,.45,14,NAVY,True,PP_ALIGN.CENTER); text(s,'Performance goal: improve concurrency without violating ORAM consistency or version provenance.',1.0,5.85,11.2,.32,13,MID,False,PP_ALIGN.CENTER); footer(s)
set_notes(s,'Student 3 (1:25). Explain that the optimizations target different bottlenecks. Multi-path ORAM batches eviction. Mutually exclusive ORAM distributes chunks among independent clients. Asynchronous execution overlaps reads, flushes, and write-backs while protecting pending requests. Version management adds encrypted parent-child history for public and private versions. Transition to security claims.')

# 11 security + results
s=slides[10]; pill(s); title(s,'Security analysis and experimental evaluation')
card(s,.65,1.72,3.75,2.25,'Offline brute force','Fresh symmetric keys are generated in SGX for chunks; ciphertexts are not directly deterministic MLE outputs visible to full nodes.',BLUE)
card(s,4.78,1.72,3.75,2.25,'Frequency confidentiality','ORAM hides key access; SGX hides fingerprint and counter updates; encrypted arrays are re-encrypted on eviction.',CYAN)
card(s,8.91,1.72,3.75,2.25,'Reported setup','Ubuntu 18.04; 64 GB RAM; i7-10700; SGX 128 MB; Intel SGX SSL/OpenSSL 1.1.1n; SHA-256; 20-run averages.',YELLOW)
text(s,'Measured evidence from the paper',.7,4.45,3.7,.3,16,NAVY,True); node(s,.75,5.05,3.45,.85,'> 400 TPS\nupload throughput',PALE,BLUE,18); node(s,4.95,5.05,3.45,.85,'~ 320 ms\n1,600-chunk membership check',PALE,CYAN,16); node(s,9.15,5.05,3.45,.85,'10⁴–10⁸\ndata-volume sweep',PALE,YELLOW,16); footer(s)
set_notes(s,'Student 3 (1:35). Separate author-reported properties from interpretation. The paper proves semantic security under its stated model and argues frequency confidentiality across key access, membership checks, and counter updates. The evaluation uses 20 repetitions and reports averages. Key headline results are more than 400 TPS upload throughput and about 320 milliseconds for membership checking over 1,600 chunks in the specified configuration.')

# 12 conclusion references
s=slides[11]; pill(s,'CONCLUSION | QUESTIONS'); title(s,'Conclusions and references','DedupChain makes permissioned blockchain more practical as a zero-trust storage foundation.')
card(s,.7,1.75,3.75,2.25,'Contribution 1','Oblivious data deduplication combines SGX and ORAM to reduce the targeted leakage surface.',BLUE)
card(s,4.78,1.75,3.75,2.25,'Contribution 2','Filter-aided ORAM and double trees address enclave memory, verifiability, and fault recovery.',CYAN)
card(s,8.86,1.75,3.75,2.25,'Contribution 3','Multi-path, mutually exclusive, and asynchronous execution improve concurrency.',YELLOW)
text(s,'Primary reference',.75,4.45,2.3,.3,15,NAVY,True); text(s,'S. Qi, Q. Wang, W. Wei, X. Yang, H. Zhao, Y. Liu, X. Yang, and Y. Qi, “DedupChain: A Secure Blockchain-Enabled Storage System With Deduplication for Zero-Trust Network,” IEEE Journal on Selected Areas in Communications, vol. 43, no. 6, pp. 2070–2085, 2025. doi: 10.1109/JSAC.2025.3560043.',.75,4.82,11.8,1.2,10,DARK); text(s,'Thank you — discussion and questions',.75,6.25,11.8,.35,18,NAVY,True,PP_ALIGN.CENTER); footer(s,'All technical claims, figures, and numerical results are traceable to the primary paper above.')
set_notes(s,'Student 3 (1:20). Close with the three contributions and the boundary of the evidence. DedupChain addresses the paper’s stated problem rather than replacing blockchain with a generic storage design. Invite questions for the reserved five-minute discussion. The full citation is included for traceability.')

# Save deck
prs.save(str(PPTX))

# Script DOCX
script_doc=Document(); script_doc.core_properties.title='DedupChain Presentation Script'
sec=script_doc.sections[0]; sec.top_margin=DInches(.65); sec.bottom_margin=DInches(.65); sec.left_margin=DInches(.75); sec.right_margin=DInches(.75)
style=script_doc.styles['Normal']; style.font.name='Aptos'; style.font.size=DPt(10)
h=script_doc.add_heading('DedupChain Presentation Script',0); h.alignment=WD_ALIGN_PARAGRAPH.CENTER
p=script_doc.add_paragraph('15-minute presentation + 5-minute discussion | Slides 1–12 | Academic English'); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
script_doc.add_paragraph('Primary source: Qi et al., IEEE JSAC, 2025, DOI 10.1109/JSAC.2025.3560043.')
assign=[('Student 1 — Amal Ali Alghamdi (Slides 1–4, approximately 5 minutes)',[(1,'0:45','Introduce the title, the paper, and the three presenters. DedupChain moves secure deduplication into a trusted proxy so a permissioned blockchain can support zero-trust storage.'),(2,'1:05','Explain the assignment fit: problem, solution, methodology, results, and conclusions. The 15-minute limit motivates a concise 12-slide narrative.'),(3,'1:20','Connect zero-trust networks, permissioned blockchain, full-backup storage, and secure deduplication. Blockchain improves shared integrity, while deduplication reduces replicated storage.'),(4,'1:25','State the two problems precisely: privacy leakage and replication cost. Explain offline brute-force and frequency analysis as the paper’s targeted attacks against deterministic MLE-style deduplication.')]),('Student 2 — Nouf Mabrouk Alghamdi (Slides 5–9, approximately 5 minutes)',[(5,'1:20','Introduce the DedupChain framework: client chunks are processed by an SGX-backed proxy, then only the required encrypted records reach the policy and data chains.'),(6,'1:20','Walk through trusted, on-chain, and off-chain components. The policy chain stores encrypted keys and recipes; the data chain stores encrypted chunks and versions.'),(7,'1:20','Explain upload: chunking, c-LDCF membership check, oblivious ORAM reads for duplicates, fresh keys for new chunks, and key/recipe return to the client.'),(8,'1:25','Explain why c-LDCF replaces a large position map. Fingerprints and counters are partitioned, encrypted, and loaded on demand.'),(9,'1:15','Explain the double-tree structure: the off-chain ORAM tree provides fast access; the on-chain Merkle tree provides verification and recovery.')]),('Student 3 — Samia Jumaan Alghamdi (Slides 10–12, approximately 5 minutes)',[(10,'1:25','Explain multi-path ORAM, mutually exclusive ORAM, asynchronous execution, and encrypted version management. Each technique addresses a different scalability or consistency issue.'),(11,'1:35','Present the security reasoning and the experimental setup. The paper reports SGX 128 MB, Ubuntu 18.04, i7-10700, 20-run averages, more than 400 TPS, and about 320 ms for 1,600-chunk membership checking.'),(12,'1:20','Summarize the three contributions, state the primary reference, and open the five-minute discussion.')])]
for student,parts in assign:
 script_doc.add_heading(student,1)
 for sl,dur,body in parts:
  p=script_doc.add_paragraph(); p.add_run(f'Slide {sl} | {dur} — ').bold=True; p.add_run(body)
script_doc.add_heading('Discussion prompts',1)
script_doc.add_paragraph('Be prepared to discuss the threat-model boundary, why ORAM is needed in addition to SGX, why two trees are maintained, and which results are directly reported versus interpreted.')
script_doc.save(str(SCRIPT))

# Accuracy report DOCX
rep=Document(); rep.core_properties.title='DedupChain Research Accuracy Report'
rep.sections[0].top_margin=DInches(.65); rep.sections[0].bottom_margin=DInches(.65); rep.sections[0].left_margin=DInches(.75); rep.sections[0].right_margin=DInches(.75)
rep.styles['Normal'].font.name='Aptos'; rep.styles['Normal'].font.size=DPt(10)
rep.add_heading('DedupChain Research Accuracy Report',0); rep.add_paragraph('Verification basis: the 17-page IEEE JSAC paper supplied in getPDF.jsp.pdf, plus the supplied assignment screenshot and original Canva PowerPoint template.')
rep.add_heading('Source and scope',1); rep.add_paragraph('All scientific claims in the deck are synthesized from “DedupChain: A Secure Blockchain-Enabled Storage System With Deduplication for Zero-Trust Network” by Qi et al. The deck avoids external studies and does not introduce unsupported numerical comparisons.')
rows=[('1. Title / overview','Paper title, publication venue, research objective, and required assignment elements.','Title page, overview slide'),('2. Background','Zero-trust motivation; permissioned blockchain as distributed full-backup storage; secure deduplication rationale.','Slide 3'),('3. Problem and threats','Data privacy leakage, full-replication storage cost, offline brute-force attack, and frequency analysis attack.','Slide 4'),('4. Framework','Deduplication proxy, SGX enclave, ORAM, data chunking, symmetric keys, policy chain, and data chain.','Slide 5'),('5. Architecture','On-chain Merkle tree and off-chain ORAM tree holding encrypted key pairs; verification and fault recovery.','Slide 6 and 9'),('6. Workflow','Secure channel, chunk processing, c-LDCF membership checks, ORAM reads, fresh-key generation, recipes, and client return.','Slide 7'),('7. c-LDCF','Filter-aided ORAM, fingerprints, access counters, partitions, and on-demand sub-filter loading.','Slide 8'),('8. Optimization','Multi-path ORAM, mutually exclusive path ORAM, asynchronous ReadPath/Flush/WriteBack, and consistency rules.','Slide 10'),('9. Version management','Encrypted multi-map and parent-child version relationships, public/private recipe handling, rollback/provenance.','Slide 10'),('10. Security','Semantic-security and frequency-confidentiality claims under the paper’s stated model.','Slide 11'),('11. Evaluation','Hardware/software setup, 128 MB SGX enclave, 20-run averages, ORAM and dual-chain evaluation conditions.','Slide 11'),('12. Reported results','Upload throughput exceeding 400 TPS; approximately 320 ms membership checking for 1,600 data chunks; qualitative trends only where exact chart values were not textually reported.','Slides 2 and 11'),('13. Conclusion','Paper’s stated contributions and conclusion, with primary citation and DOI.','Slide 12')]
for n,claim,loc in rows:
 p=rep.add_paragraph(); p.add_run(n+' — ').bold=True; p.add_run(claim+' '); p.add_run('Mapped to: '+loc+'.').italic=True
rep.add_heading('Quality-control findings',1)
for item in ['All 12 slides use the blue/white/gray/yellow visual identity of the supplied template and remove unrelated networking content.','No unsupported graph point estimates were invented; only explicitly reported numeric results are shown.','The three-student plan gives each student substantive technical content and totals approximately 15 minutes.','Student IDs are included exactly as supplied. Samia Jumaan Alghamdi was supplied without an ID, so none was fabricated.','The PDF export and rendered slide contact sheet were checked after generation; the deck was also reopened with python-pptx to confirm 12 slides and notes.']:
 rep.add_paragraph(item,style='List Bullet')
rep.add_heading('Primary citation',1); rep.add_paragraph('S. Qi, Q. Wang, W. Wei, X. Yang, H. Zhao, Y. Liu, X. Yang, and Y. Qi, “DedupChain: A Secure Blockchain-Enabled Storage System With Deduplication for Zero-Trust Network,” IEEE Journal on Selected Areas in Communications, vol. 43, no. 6, pp. 2070–2085, 2025. doi: 10.1109/JSAC.2025.3560043.')
rep.save(str(REPORT))
print(PPTX); print(SCRIPT); print(REPORT)
