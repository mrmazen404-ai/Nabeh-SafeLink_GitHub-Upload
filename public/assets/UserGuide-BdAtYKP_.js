import{S as e,b as t,n,r}from"./LanguageContext-ClgsjDPp.js";import{_ as i,a,c as o,h as s,i as c,l,o as u,p as d,r as f,s as p,t as m,v as h,w as g}from"./index-Bd4IJ-m7.js";import{t as _}from"./Footer-Cn7wEgL7.js";var v=e(t(),1),y=r();function b({activeTab:e,setActiveTab:t}){let{t:r,dir:b}=n(),[x,S]=(0,v.useState)(`sec1`),[C,w]=(0,v.useState)(!1),T=[{id:`sec1`,title:r(`guide.section1Title`),icon:g},{id:`sec2`,title:r(`guide.section2Title`),icon:s},{id:`sec3`,title:r(`guide.section3Title`),icon:h},{id:`sec4`,title:r(`guide.section4Title`),icon:u},{id:`sec5`,title:r(`guide.section5Title`),icon:c},{id:`sec6`,title:r(`guide.section6Title`),icon:f}],E=T.findIndex(e=>e.id===x);return(0,y.jsxs)(`div`,{className:`page-wrapper`,children:[(0,y.jsx)(m,{activeTab:e,setActiveTab:t}),(0,y.jsx)(`main`,{className:`main-content`,id:`main-content`,children:(0,y.jsxs)(`div`,{className:`guide-page-container`,children:[(0,y.jsxs)(`nav`,{className:`breadcrumb`,"aria-label":`Breadcrumb`,children:[(0,y.jsx)(`button`,{type:`button`,className:`breadcrumb-link`,onClick:()=>t(`home`),children:r(`nav.breadcrumbHome`)}),(0,y.jsx)(`span`,{className:`breadcrumb-separator`,children:`/`}),(0,y.jsx)(`span`,{className:`breadcrumb-current`,children:r(`nav.guide`)})]}),(0,y.jsxs)(`div`,{className:`guide-header-card`,children:[(0,y.jsx)(`div`,{className:`guide-title-icon`,children:(0,y.jsx)(a,{size:28,color:`var(--color-primary)`})}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`h1`,{className:`guide-h1`,children:r(`guide.title`)}),(0,y.jsx)(`p`,{className:`guide-subtitle`,children:r(`guide.subtitle`)})]})]}),(0,y.jsxs)(`div`,{className:`mobile-toc-wrapper`,children:[(0,y.jsxs)(`button`,{type:`button`,className:`mobile-toc-toggle`,onClick:()=>w(e=>!e),children:[(0,y.jsxs)(`span`,{children:[r(`guide.tocTitle`),`: `,T[E]?.title]}),(0,y.jsx)(p,{size:18})]}),C&&(0,y.jsx)(`div`,{className:`mobile-toc-dropdown`,children:T.map(e=>(0,y.jsx)(`button`,{type:`button`,className:`mobile-toc-item ${x===e.id?`active`:``}`,onClick:()=>{S(e.id),w(!1)},children:(0,y.jsx)(`span`,{children:e.title})},e.id))})]}),(0,y.jsxs)(`div`,{className:`guide-layout`,children:[(0,y.jsxs)(`aside`,{className:`guide-toc-sidebar`,children:[(0,y.jsx)(`h3`,{className:`toc-sidebar-title`,children:r(`guide.tocTitle`)}),(0,y.jsx)(`nav`,{className:`toc-nav-list`,children:T.map(e=>{let t=e.icon,n=x===e.id;return(0,y.jsxs)(`button`,{type:`button`,className:`toc-nav-btn ${n?`active`:``}`,onClick:()=>S(e.id),children:[(0,y.jsx)(t,{size:16}),(0,y.jsx)(`span`,{children:e.title})]},e.id)})})]}),(0,y.jsxs)(`article`,{className:`guide-content-article`,children:[x===`sec1`&&(0,y.jsxs)(`div`,{className:`guide-section-card`,children:[(0,y.jsx)(`h2`,{children:r(`guide.section1Title`)}),(0,y.jsx)(`p`,{children:r(`guide.section1Desc`)}),(0,y.jsxs)(`div`,{className:`guide-tip-banner`,children:[(0,y.jsx)(g,{size:20,color:`var(--color-secondary)`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`تلميحة سريعة:`}),` نبيه مجاني بالكامل ولا يطلب أي كلمة مرور أو بيانات تسجيل دخول.`]})]}),(0,y.jsxs)(`button`,{type:`button`,className:`btn-primary`,onClick:()=>t(`scan`),children:[(0,y.jsx)(g,{size:16}),(0,y.jsx)(`span`,{children:r(`guide.quickScanBtn`)})]})]}),x===`sec2`&&(0,y.jsxs)(`div`,{className:`guide-section-card`,children:[(0,y.jsx)(`h2`,{children:r(`guide.section2Title`)}),(0,y.jsx)(`p`,{children:r(`guide.section2Desc`)}),(0,y.jsxs)(`div`,{className:`steps-list`,children:[(0,y.jsxs)(`div`,{className:`step-item`,children:[(0,y.jsx)(`div`,{className:`step-badge`,children:`1`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`نسخ الرابط المشتبه به:`}),` انسخ النص الكامل للرابط مع البروتوكول (http/https).`]})]}),(0,y.jsxs)(`div`,{className:`step-item`,children:[(0,y.jsx)(`div`,{className:`step-badge`,children:`2`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`اللصق في الفحص:`}),` اختر تبويب "فحص رابط" وانقر على زر "لصق" المساعد.`]})]}),(0,y.jsxs)(`div`,{className:`step-item`,children:[(0,y.jsx)(`div`,{className:`step-badge`,children:`3`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`بدء الفحص واستعراض التقرير:`}),` اضغط على زر "بدء الفحص الآمن" وتابع التحليل التفسيري التوليدي.`]})]})]})]}),x===`sec3`&&(0,y.jsxs)(`div`,{className:`guide-section-card`,children:[(0,y.jsx)(`h2`,{children:r(`guide.section3Title`)}),(0,y.jsx)(`p`,{children:r(`guide.section3Desc`)}),(0,y.jsxs)(`div`,{className:`steps-list`,children:[(0,y.jsxs)(`div`,{className:`step-item`,children:[(0,y.jsx)(`div`,{className:`step-badge`,children:`1`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`تحديد محتوى الرسالة:`}),` انسخ نص الرسالة النصية أو البريد المريب كاملاً.`]})]}),(0,y.jsxs)(`div`,{className:`step-item`,children:[(0,y.jsx)(`div`,{className:`step-badge`,children:`2`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`فحص الرسالة:`}),` اختر تبويب "فحص نص / رسالة (SMS)" في صفحة الفحص والصق النص.`]})]}),(0,y.jsxs)(`div`,{className:`step-item`,children:[(0,y.jsx)(`div`,{className:`step-badge`,children:`3`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`قراءة التحليل:`}),` سيقوم المحرك بتحليل نصوص الادعاءات المالية ومحاولات الانتحال.`]})]})]})]}),x===`sec4`&&(0,y.jsxs)(`div`,{className:`guide-section-card`,children:[(0,y.jsx)(`h2`,{children:r(`guide.section4Title`)}),(0,y.jsx)(`p`,{children:r(`guide.section4Desc`)}),(0,y.jsxs)(`div`,{className:`badge-explain-grid`,children:[(0,y.jsxs)(`div`,{className:`badge-explain-box safe`,children:[(0,y.jsx)(`span`,{className:`explain-tag safe`,children:`آمن (Safe)`}),(0,y.jsx)(`p`,{children:`الرابط خالٍ من التهديدات المعروفة ويمكن تصفحه بسلام.`})]}),(0,y.jsxs)(`div`,{className:`badge-explain-box suspicious`,children:[(0,y.jsx)(`span`,{className:`explain-tag suspicious`,children:`مشبوه (Suspicious)`}),(0,y.jsx)(`p`,{children:`توجد مؤشرات خطورة محتملة. تجنب إدخال أي بيانات بنكية أو شخصية.`})]}),(0,y.jsxs)(`div`,{className:`badge-explain-box dangerous`,children:[(0,y.jsx)(`span`,{className:`explain-tag dangerous`,children:`خطر (Dangerous)`}),(0,y.jsx)(`p`,{children:`تهديد مؤكد برابط احتيالي أو خبيث. يُحظر النقر عليه إطلاقاً.`})]})]})]}),x===`sec5`&&(0,y.jsxs)(`div`,{className:`guide-section-card`,children:[(0,y.jsx)(`h2`,{children:r(`guide.section5Title`)}),(0,y.jsx)(`p`,{children:r(`guide.section5Desc`)}),(0,y.jsxs)(`ul`,{className:`guide-bullets`,children:[(0,y.jsx)(`li`,{children:`استخدم خانة البحث في صفحة "السجل" للوصول المباشر إلى فحص سابق باسم الرابط.`}),(0,y.jsx)(`li`,{children:`تتيح لك أزرار الفلترة تصفية الفحوصات الخطيرة أو المشبوهة بسهولة.`}),(0,y.jsx)(`li`,{children:`تعرض صفحة "الإحصائيات" رسوماً بيانية توضح توزيع التهديدات وتكرارها.`})]})]}),x===`sec6`&&(0,y.jsxs)(`div`,{className:`guide-section-card`,children:[(0,y.jsx)(`h2`,{children:r(`guide.section6Title`)}),(0,y.jsx)(`p`,{children:r(`guide.section6Desc`)}),(0,y.jsxs)(`div`,{className:`guide-danger-banner`,children:[(0,y.jsx)(f,{size:20,color:`var(--color-danger)`}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`strong`,{children:`قاعدة ذهبية:`}),` عند الشك في رسالة تطلب بياناتك المالية أو رمز تحقق، اتصل بالجهة عبر أرقامها الرسمية المعتمدة ولا تنقر على الروابط الواردة في الرسائل.`]})]})]}),(0,y.jsxs)(`div`,{className:`guide-pagination-bar`,children:[(0,y.jsxs)(`button`,{type:`button`,className:`guide-nav-btn`,onClick:()=>{E>0&&(S(T[E-1].id),window.scrollTo({top:120,behavior:`smooth`}))},disabled:E===0,children:[b===`rtl`?(0,y.jsx)(l,{size:16}):(0,y.jsx)(o,{size:16}),(0,y.jsx)(`span`,{children:r(`guide.prevSection`)})]}),(0,y.jsxs)(`button`,{type:`button`,className:`guide-nav-btn`,onClick:()=>{E<T.length-1&&(S(T[E+1].id),window.scrollTo({top:120,behavior:`smooth`}))},disabled:E===T.length-1,children:[(0,y.jsx)(`span`,{children:r(`guide.nextSection`)}),b===`rtl`?(0,y.jsx)(o,{size:16}):(0,y.jsx)(l,{size:16})]})]})]})]}),(0,y.jsxs)(`div`,{className:`guide-bottom-cta`,children:[(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`h3`,{children:r(`guide.needMoreHelpTitle`)}),(0,y.jsx)(`p`,{children:r(`guide.needMoreHelpSub`)})]}),(0,y.jsxs)(`div`,{className:`cta-actions`,children:[(0,y.jsxs)(`button`,{type:`button`,className:`btn-secondary`,onClick:()=>t(`faq`),children:[(0,y.jsx)(d,{size:16}),(0,y.jsx)(`span`,{children:r(`nav.faq`)})]}),(0,y.jsxs)(`button`,{type:`button`,className:`btn-primary`,onClick:()=>t(`contact`),children:[(0,y.jsx)(i,{size:16}),(0,y.jsx)(`span`,{children:r(`nav.contact`)})]})]})]})]})}),(0,y.jsx)(_,{activeTab:e,setActiveTab:t}),(0,y.jsx)(`style`,{children:`
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

        .guide-page-container {
          max-width: 960px;
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

        .guide-header-card {
          display: flex;
          align-items: center;
          gap: var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5, 20px);
          box-shadow: var(--shadow-sm);
        }

        .guide-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: var(--color-secondary-subtle);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .guide-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 4px;
        }

        .guide-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .mobile-toc-wrapper {
          display: none;
          position: relative;
        }

        .mobile-toc-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 16px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          cursor: pointer;
        }

        .mobile-toc-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          z-index: 100;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .mobile-toc-item {
          padding: 12px 16px;
          background: none;
          border: none;
          border-bottom: 1px solid var(--color-border);
          text-align: start;
          font-family: inherit;
          font-size: 13px;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .mobile-toc-item.active {
          background: var(--color-bg-subtle);
          color: var(--color-secondary);
          font-weight: 600;
        }

        .guide-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: var(--space-6, 24px);
          align-items: start;
        }

        .guide-toc-sidebar {
          position: sticky;
          top: 80px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-4, 16px);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .toc-sidebar-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .toc-nav-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .toc-nav-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          text-align: start;
          transition: all var(--transition-fast);
        }

        .toc-nav-btn:hover,
        .toc-nav-btn.active {
          background: var(--color-bg-subtle);
          color: var(--color-secondary);
          font-weight: 600;
        }

        .guide-content-article {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .guide-section-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          box-shadow: var(--shadow-xs);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .guide-section-card h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text);
        }

        .guide-section-card p {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: var(--color-text-secondary);
        }

        .guide-tip-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--color-secondary-subtle);
          border: 1px solid var(--color-secondary);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          font-size: 13px;
          color: var(--color-text);
        }

        .guide-danger-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--color-danger-subtle);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          font-size: 13px;
          color: var(--color-danger);
        }

        .steps-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--color-text-secondary);
        }

        .step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          background: var(--color-primary);
          color: #ffffff;
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .badge-explain-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .badge-explain-box {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .explain-tag {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          width: fit-content;
        }

        .explain-tag.safe {
          background: var(--color-success-subtle);
          color: var(--color-success);
        }

        .explain-tag.suspicious {
          background: var(--color-warning-subtle);
          color: var(--color-warning);
        }

        .explain-tag.dangerous {
          background: var(--color-danger-subtle);
          color: var(--color-danger);
        }

        .badge-explain-box p {
          font-size: 12px;
          margin: 0;
          line-height: 1.5;
        }

        .guide-bullets {
          margin: 0;
          padding-inline-start: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-secondary);
        }

        .guide-pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
        }

        .guide-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 10px 16px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .guide-nav-btn:hover:not(:disabled) {
          border-color: var(--color-secondary);
          color: var(--color-secondary);
        }

        .guide-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-primary {
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
          width: fit-content;
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
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .guide-bottom-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          gap: 16px;
        }

        .guide-bottom-cta h3 {
          margin: 0 0 4px;
          font-size: 16px;
          color: var(--color-text);
        }

        .guide-bottom-cta p {
          margin: 0;
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .cta-actions {
          display: flex;
          gap: 10px;
        }

        @media (max-width: 800px) {
          .guide-layout {
            grid-template-columns: 1fr;
          }
          .guide-toc-sidebar {
            display: none;
          }
          .mobile-toc-wrapper {
            display: block;
          }
          .badge-explain-grid {
            grid-template-columns: 1fr;
          }
          .guide-bottom-cta {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `})]})}export{b as default};