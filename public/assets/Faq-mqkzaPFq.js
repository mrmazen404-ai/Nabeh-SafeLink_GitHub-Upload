import{S as e,b as t,n,r}from"./LanguageContext-ClgsjDPp.js";import{O as i,_ as a,a as o,p as s,s as c,t as l,u,x as d}from"./index-Bd4IJ-m7.js";import{t as f}from"./Footer-Cn7wEgL7.js";var p=e(t(),1),m=r();function h({activeTab:e,setActiveTab:t}){let{t:r,lang:h}=n(),[g,_]=(0,p.useState)(``),[v,y]=(0,p.useState)(`all`),[b,x]=(0,p.useState)(0),S=(0,p.useMemo)(()=>[{id:`q1`,category:`general`,question:h===`ar`?`كيف أفحص رابطاً أو رسالة نصية عبر نبيه؟`:`How do I scan a URL or SMS message with Nabeh?`,answer:h===`ar`?`انسخ الرابط الإلكتروني أو نص الرسالة المشبوهة، ثم انتقل إلى تبويب "الفحص" في القائمة الرئيسية. الصق النص في حقل الإدخال وانقر على "بدء الفحص الآمن". ستظهر النتيجة التقييمية خلال ثوانٍ قليلة.`:`Copy the suspicious URL or SMS message text, then go to the "Scan" tab in the navigation. Paste it into the input field and click "Start Safe Scan". Results will appear in seconds.`,linkToGuide:!0},{id:`q2`,category:`results`,question:h===`ar`?`ماذا تعني نتائج التصنيف الثلاثة: آمن (Safe)، مشبوه (Suspicious)، وخطر (Dangerous)؟`:`What do the three classifications (Safe, Suspicious, Dangerous) mean?`,answer:h===`ar`?`• آمن (Safe): لم يتم رصد أي مؤشرات خطر أو روابط احتيالية.
• مشبوه (Suspicious): توجد مؤشرات توجب الحذر ويُنصح بعدم إدخال بيانات بنكية أو شخصية.
• خطر (Dangerous): تم اكتشاف تهديد أمني مؤكد أو رابط تصيد خبيث، يُحظر النقر عليه إطلاقاً.`:`• Safe: No threat indicators or phishing links detected.
• Suspicious: Risk indicators detected; exercise caution and avoid credentials input.
• Dangerous: Verified security threat or phishing link; do not click!`},{id:`q3`,category:`results`,question:h===`ar`?`ما هي درجة الثقة (Confidence Score) وهل تعني أن النتيجة مضمونة 100%؟`:`What is the Confidence Score and does it guarantee 100% accuracy?`,answer:h===`ar`?`تعبر درجة الثقة (مثلاً 95%) عن مدى مطابقة المؤشرات المحللة مع أنماط التهديدات السيبرانية المعروفة. نبيه يوفر أداة إرشادية مساعدة لتقييم المخاطر ولا يوجد أي نظام أمني إلكتروني يضمن عدم وجود تهديدات مجهولة بنسبة 100%.`:`The Confidence Score (e.g. 95%) represents how strongly analyzed indicators match known threat patterns. Nabeh provides decision-support risk evaluation; no security system guarantees 100% immunity against unknown threats.`},{id:`q4`,category:`results`,question:h===`ar`?`كيف يجمع نبيه بين الذكاء الاصطناعي (Gemini)، محركات VirusTotal والتعلم الآلي (ML)؟`:`How does Nabeh combine Gemini AI, VirusTotal, and Machine Learning?`,answer:h===`ar`?`يعتمد نبيه على محرك هجين: يفحص الهيكل النحوي عبر نموذج التعلم الآلي المحمول (Scikit-Learn ML)، ثم يستعلم أكثر من 70 محرك أمان عالمي عبر VirusTotal v3 API، ويحلل النص بصائغ الذكاء الاصطناعي التوليدي Google Gemini لتوفير شرح بليغ وتوصية حذرة.`:`Nabeh employs a hybrid engine: syntax inspection via local Scikit-Learn ML, VirusTotal v3 querying 70+ global vendor engines, and Google Gemini Generative AI for plain-language explanations and security advice.`},{id:`q5`,category:`general`,question:h===`ar`?`ماذا أفعل إذا ظهرت النتيجة "مشبوهة" أو "خطيرة"؟`:`What should I do if a result is "Suspicious" or "Dangerous"?`,answer:h===`ar`?`إذا ظهرت النتيجة "مشبوهة" أو "خطيرة"، يُنصح بشدة بعدم النقر على الرابط، وعدم إدخال أي كلمات مرور أو رموز تحقق أو بيانات بطاقات ائتمانية. يمكنك الإبلاغ عن الرسالة أو مسحها فوراً.`:`If classified as Suspicious or Dangerous, avoid clicking the link or entering sensitive credentials or banking info. Delete the message or report it.`},{id:`q6`,category:`privacy`,question:h===`ar`?`هل يفتح نبيه الرابط تلقائياً أثناء الفحص؟`:`Does Nabeh automatically open the link during scanning?`,answer:h===`ar`?`لا إطلاقاً. لا يقوم نبيه بفتح الرابط المشبوه أو تشغيل الكود في متصفحك أو جهازك أثناء الفحص. يتم تحليل المعطيات والنطاق بأمان عبر خوادم الأمان دون تعريض جهازك لأي خطر.`:`No, absolutely not. Nabeh does not open the link or execute code on your device. Analysis is performed safely on security engines without exposing your browser.`},{id:`q7`,category:`privacy`,question:h===`ar`?`هل تُحفظ الروابط أو النصوص التي أفحصها؟ ومن يستطيع رؤيتها؟`:`Are my scanned links or texts saved, and who can view them?`,answer:h===`ar`?`تُحفظ سجلات الفحص محلياً على جهازك في سياق الجلسة والسجل لتتمكن من مراجعة عملياتك. لا يتم مشاركة مدخلاتك الحساسة أو بياناتك الشخصية مع أي طرف ثالث.`:`Scan logs are kept locally on your session history so you can review past operations. Your sensitive personal data is never sold or shared with third parties.`},{id:`q8`,category:`url_scan`,question:h===`ar`?`لماذا قد يفشل الفحص أو تظهر النتيجة "غير محددة" (Unknown)؟`:`Why might a scan fail or display an "Unknown" classification?`,answer:h===`ar`?`قد يحدث ذلك في حال انقطاع الاتصال بالإنترنت، أو إذا كان الرابط غير صالح أو خادماً جديداً كلياً لم يُسجل في قواعد بيانات التهديدات بعد. يرجى التأكد من كتابة URL صحيح وإعادة الفحص.`:`This may occur if network connectivity drops, if the URL syntax is invalid, or if it is a brand-new domain not yet indexed. Verify the URL syntax and try again.`},{id:`q9`,category:`msg_scan`,question:h===`ar`?`هل يمكن استخدام نبيه لفحص الرسائل النصية القصيرة (SMS) والبريد؟`:`Can Nabeh inspect SMS messages and email text?`,answer:h===`ar`?`نعم، يتيح نبيه تبويب "فحص نص/رسالة" لتحليل نصوص الرسائل والبريد لكشف محاولات الهندسة الاجتماعية، الوعود المالية الكاذبة، والروابط التصيدية المضمنة.`:`Yes, Nabeh provides an "SMS / Text Scan" tab to inspect message text for social engineering, fake monetary promises, and embedded phishing URLs.`},{id:`q10`,category:`privacy`,question:h===`ar`?`هل أحتاج لتسجيل الدخول لاستخدام نظام نبيه؟`:`Do I need to sign in or create an account to use Nabeh?`,answer:h===`ar`?`لا، يمكنك استخدام كافة أدوات الفحص والسجل والإحصائيات مباشرة ودون الحاجة لتسجيل حساب أو إدخال بيانات شخصية.`:`No, all scanning tools, scan history, and analytics are freely accessible directly without account creation.`}],[h]),C=[{id:`all`,label:r(`faq.categoryAll`)},{id:`general`,label:r(`faq.categoryGeneral`)},{id:`url_scan`,label:r(`faq.categoryUrlScan`)},{id:`msg_scan`,label:r(`faq.categoryMsgScan`)},{id:`results`,label:r(`faq.categoryResults`)},{id:`privacy`,label:r(`faq.categoryPrivacy`)}],w=(0,p.useMemo)(()=>S.filter(e=>{let t=v===`all`||e.category===v,n=g.trim().toLowerCase(),r=!n||e.question.toLowerCase().includes(n)||e.answer.toLowerCase().includes(n);return t&&r}),[S,v,g]);return(0,m.jsxs)(`div`,{className:`page-wrapper`,children:[(0,m.jsx)(l,{activeTab:e,setActiveTab:t}),(0,m.jsx)(`main`,{className:`main-content`,id:`main-content`,children:(0,m.jsxs)(`div`,{className:`faq-page-container`,children:[(0,m.jsxs)(`nav`,{className:`breadcrumb`,"aria-label":`Breadcrumb`,children:[(0,m.jsx)(`button`,{type:`button`,className:`breadcrumb-link`,onClick:()=>t(`home`),children:r(`nav.breadcrumbHome`)}),(0,m.jsx)(`span`,{className:`breadcrumb-separator`,children:`/`}),(0,m.jsx)(`span`,{className:`breadcrumb-current`,children:r(`nav.faq`)})]}),(0,m.jsxs)(`div`,{className:`faq-header-card`,children:[(0,m.jsx)(`div`,{className:`faq-title-icon`,children:(0,m.jsx)(s,{size:28,color:`var(--color-primary)`})}),(0,m.jsxs)(`div`,{children:[(0,m.jsx)(`h1`,{className:`faq-h1`,children:r(`faq.title`)}),(0,m.jsx)(`p`,{className:`faq-subtitle`,children:r(`faq.subtitle`)})]})]}),(0,m.jsx)(`div`,{className:`faq-search-wrapper`,children:(0,m.jsxs)(`div`,{className:`faq-search-input-box`,children:[(0,m.jsx)(d,{size:20,color:`var(--color-text-muted)`}),(0,m.jsx)(`input`,{type:`text`,className:`faq-search-input`,placeholder:r(`faq.searchPlaceholder`),value:g,onChange:e=>_(e.target.value),"aria-label":r(`faq.searchPlaceholder`)}),g&&(0,m.jsx)(`button`,{type:`button`,className:`faq-clear-btn`,onClick:()=>_(``),title:r(`faq.clearSearch`),"aria-label":r(`faq.clearSearch`),children:(0,m.jsx)(i,{size:18,color:`var(--color-text-muted)`})})]})}),(0,m.jsx)(`div`,{className:`faq-categories-row`,role:`tablist`,"aria-label":`FAQ Categories`,children:C.map(e=>{let t=v===e.id;return(0,m.jsx)(`button`,{type:`button`,className:`faq-chip-btn ${t?`active`:``}`,onClick:()=>y(e.id),role:`tab`,"aria-selected":t,children:e.label},e.id)})}),w.length>0?(0,m.jsx)(`div`,{className:`faq-accordion-list`,children:w.map((e,n)=>{let i=b===n;return(0,m.jsxs)(`div`,{className:`faq-accordion-item ${i?`open`:``}`,children:[(0,m.jsxs)(`button`,{type:`button`,className:`faq-question-btn`,onClick:()=>x(i?-1:n),"aria-expanded":i,children:[(0,m.jsx)(`span`,{className:`faq-question-text`,children:e.question}),i?(0,m.jsx)(u,{size:20,color:`var(--color-primary)`}):(0,m.jsx)(c,{size:20,color:`var(--color-text-muted)`})]}),i&&(0,m.jsxs)(`div`,{className:`faq-answer-body`,children:[(0,m.jsx)(`p`,{className:`faq-answer-text`,children:e.answer}),e.linkToGuide&&(0,m.jsxs)(`button`,{type:`button`,className:`faq-guide-link-btn`,onClick:()=>t(`guide`),children:[(0,m.jsx)(o,{size:16}),(0,m.jsx)(`span`,{children:r(`faq.viewGuideBtn`)})]})]})]},e.id)})}):(0,m.jsxs)(`div`,{className:`faq-empty-card`,children:[(0,m.jsx)(d,{size:40,color:`var(--color-text-muted)`}),(0,m.jsx)(`h3`,{children:r(`faq.noResultsTitle`)}),(0,m.jsx)(`p`,{children:r(`faq.noResultsSub`)}),(0,m.jsxs)(`div`,{className:`faq-empty-actions`,children:[(0,m.jsx)(`button`,{type:`button`,className:`btn-secondary`,onClick:()=>{_(``),y(`all`)},children:r(`faq.clearSearch`)}),(0,m.jsxs)(`button`,{type:`button`,className:`btn-primary`,onClick:()=>t(`contact`),children:[(0,m.jsx)(a,{size:16}),(0,m.jsx)(`span`,{children:r(`faq.contactBtn`)})]})]})]}),(0,m.jsxs)(`div`,{className:`faq-bottom-cta`,children:[(0,m.jsxs)(`div`,{className:`faq-cta-content`,children:[(0,m.jsx)(`h3`,{children:r(`faq.contactCtaTitle`)}),(0,m.jsx)(`p`,{children:r(`faq.contactCtaSub`)})]}),(0,m.jsxs)(`button`,{type:`button`,className:`faq-cta-btn`,onClick:()=>t(`contact`),children:[(0,m.jsx)(a,{size:18}),(0,m.jsx)(`span`,{children:r(`faq.contactBtn`)})]})]})]})}),(0,m.jsx)(f,{activeTab:e,setActiveTab:t}),(0,m.jsx)(`style`,{children:`
        .page-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg);
        }

        .main-content {
          flex: 1;
          padding: var(--space-6, 24px) var(--space-4, 16px);
        }

        .faq-page-container {
          max-width: 820px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-5, 20px);
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--color-text-muted);
        }

        .breadcrumb-link {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 13px;
          color: var(--color-secondary);
          cursor: pointer;
        }

        .breadcrumb-link:hover {
          text-decoration: underline;
        }

        .faq-header-card {
          display: flex;
          align-items: center;
          gap: var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5, 20px);
          box-shadow: var(--shadow-sm);
        }

        .faq-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: var(--color-secondary-subtle);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .faq-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 4px;
        }

        .faq-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .faq-search-wrapper {
          position: relative;
        }

        .faq-search-input-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          box-shadow: var(--shadow-xs);
          transition: border-color var(--transition-fast);
        }

        .faq-search-input-box:focus-within {
          border-color: var(--color-secondary);
        }

        .faq-search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          color: var(--color-text);
        }

        .faq-clear-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
        }

        .faq-categories-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .faq-chip-btn {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 8px 16px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .faq-chip-btn:hover {
          border-color: var(--color-secondary);
          color: var(--color-text);
        }

        .faq-chip-btn.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #ffffff;
        }

        .faq-accordion-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .faq-accordion-item {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color var(--transition-fast);
        }

        .faq-accordion-item.open {
          border-color: var(--color-secondary);
        }

        .faq-question-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 16px 20px;
          background: none;
          border: none;
          font-family: inherit;
          text-align: start;
          cursor: pointer;
          gap: 12px;
        }

        .faq-question-text {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text);
        }

        .faq-answer-body {
          padding: 0 20px 20px;
          border-top: 1px solid var(--color-border);
          padding-top: 14px;
        }

        .faq-answer-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: var(--color-text-secondary);
          white-space: pre-line;
        }

        .faq-guide-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-secondary);
          cursor: pointer;
        }

        .faq-guide-link-btn:hover {
          text-decoration: underline;
        }

        .faq-empty-card {
          text-align: center;
          padding: var(--space-8, 48px) var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .faq-empty-card h3 {
          margin: 0;
          font-size: 18px;
          color: var(--color-text);
        }

        .faq-empty-card p {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .faq-empty-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-primary {
          background: var(--color-primary);
          color: #ffffff;
          border: none;
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-secondary {
          background: var(--color-bg);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .faq-bottom-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          gap: var(--space-4, 16px);
          margin-top: var(--space-4, 16px);
        }

        .faq-cta-content h3 {
          margin: 0 0 4px;
          font-size: 16px;
          color: var(--color-text);
        }

        .faq-cta-content p {
          margin: 0;
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .faq-cta-btn {
          background: var(--color-primary);
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }

        @media (max-width: 600px) {
          .faq-bottom-cta {
            flex-direction: column;
            align-items: flex-start;
          }
          .faq-cta-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `})]})}export{h as default};