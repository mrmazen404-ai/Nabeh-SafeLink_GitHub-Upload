import{n as e,r as t}from"./LanguageContext-ClgsjDPp.js";import{A as n,C as r,_ as i,a,i as o,k as s,m as c,n as l,p as u,w as d}from"./index-Bd4IJ-m7.js";var f=t(),p={home:`/dashboard`,scan:`/scan`,history:`/history`,stats:`/stats`,faq:`/faq`,guide:`/guide`,contact:`/contact`,about:`/about`,notifications:`/notifications`,alerts:`/settings/alerts`};function m({activeTab:t,setActiveTab:m}){let{t:h,dir:g}=e(),{isGuest:_}=s(),v=n(),y=new Date().getFullYear(),b=e=>{typeof m==`function`&&m(e);let t=p[e]||(_&&e===`home`?`/welcome`:`/scan`);v(t)},x=[{id:`faq`,label:h(`nav.faq`),icon:u},{id:`guide`,label:h(`nav.guide`),icon:a},{id:`contact`,label:h(`nav.contact`),icon:i},{id:`about`,label:h(`nav.about`),icon:c}],S=[{id:`terms`,label:g===`rtl`?`شروط الاستخدام`:`Terms of use`,path:`/terms`},{id:`privacy`,label:g===`rtl`?`سياسة الخصوصية`:`Privacy policy`,path:`/privacy`},{id:`disclaimer`,label:g===`rtl`?`إخلاء المسؤولية`:`Disclaimer`,path:`/disclaimer`},..._?[]:[{id:`data`,label:g===`rtl`?`إدارة بياناتي`:`My data controls`,path:`/settings/privacy`}]],C=_?[{id:`scan`,label:h(`nav.scan`),icon:d},{id:`about`,label:h(`nav.about`),icon:c},{id:`guide`,label:h(`nav.guide`),icon:a},{id:`faq`,label:h(`nav.faq`),icon:u}]:[{id:`home`,label:h(`nav.home`),icon:d},{id:`scan`,label:h(`nav.scan`),icon:d},{id:`history`,label:h(`nav.history`),icon:o},{id:`stats`,label:h(`nav.stats`),icon:c}];return(0,f.jsxs)(`footer`,{className:`app-footer`,role:`contentinfo`,dir:g,children:[(0,f.jsxs)(`div`,{className:`footer-container`,children:[(0,f.jsxs)(`div`,{className:`footer-brand-section`,children:[(0,f.jsx)(`button`,{type:`button`,className:`footer-logo-btn`,onClick:()=>b(`home`),"aria-label":h(`nav.goHome`),children:(0,f.jsx)(l,{size:`sm`,showTagline:!1})}),(0,f.jsx)(`p`,{className:`footer-tagline`,children:h(`footer.tagline`)}),(0,f.jsxs)(`div`,{className:`footer-version-badge`,children:[(0,f.jsx)(r,{size:14,color:`#16A34A`}),(0,f.jsx)(`span`,{children:`v1.0.0 MVP Stable`})]})]}),(0,f.jsxs)(`div`,{className:`footer-links-column`,children:[(0,f.jsx)(`h3`,{className:`footer-column-title`,children:h(`footer.supportSection`)}),(0,f.jsx)(`ul`,{className:`footer-links-list`,children:x.map(e=>{let n=e.icon,r=t===e.id;return(0,f.jsx)(`li`,{children:(0,f.jsxs)(`button`,{type:`button`,className:`footer-link-btn ${r?`active`:``}`,onClick:()=>b(e.id),children:[(0,f.jsx)(n,{size:15}),(0,f.jsx)(`span`,{children:e.label})]})},e.id)})})]}),(0,f.jsxs)(`div`,{className:`footer-links-column`,children:[(0,f.jsx)(`h3`,{className:`footer-column-title`,children:h(`footer.quickLinksSection`)}),(0,f.jsx)(`ul`,{className:`footer-links-list`,children:C.map(e=>{let n=e.icon,r=t===e.id;return(0,f.jsx)(`li`,{children:(0,f.jsxs)(`button`,{type:`button`,className:`footer-link-btn ${r?`active`:``}`,onClick:()=>b(e.id),children:[(0,f.jsx)(n,{size:15}),(0,f.jsx)(`span`,{children:e.label})]})},e.id)})})]}),(0,f.jsxs)(`div`,{className:`footer-links-column`,children:[(0,f.jsx)(`h3`,{className:`footer-column-title`,children:g===`rtl`?`الحقوق والبيانات`:`Legal & data`}),(0,f.jsx)(`ul`,{className:`footer-links-list`,children:S.map(e=>(0,f.jsx)(`li`,{children:(0,f.jsx)(`button`,{type:`button`,className:`footer-link-btn`,onClick:()=>v(e.path),children:(0,f.jsx)(`span`,{children:e.label})})},e.id))})]}),(0,f.jsxs)(`div`,{className:`footer-notice-card`,children:[(0,f.jsxs)(`div`,{className:`notice-card-header`,children:[(0,f.jsx)(r,{size:18,color:`var(--color-secondary)`}),(0,f.jsx)(`span`,{className:`notice-card-title`,children:h(`footer.securityTitle`)})]}),(0,f.jsx)(`p`,{className:`footer-notice-text`,children:h(`footer.securityNotice`)})]})]}),(0,f.jsx)(`div`,{className:`footer-bottom-bar`,children:(0,f.jsx)(`p`,{className:`footer-copyright`,children:h(`footer.rights`,{year:y})})}),(0,f.jsx)(`style`,{children:`
        .app-footer {
          background: var(--color-bg);
          border-top: 1px solid var(--color-border);
          margin-top: var(--space-8, 48px);
          padding: 48px 24px 28px;
          color: var(--color-text-secondary);
          font-size: 14px;
          transition: background var(--transition-base, 0.2s ease), border-color var(--transition-base, 0.2s ease);
        }

        .footer-container {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.3fr;
          gap: 32px;
        }

        .footer-brand-section {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 14px;
        }

        [dir="rtl"] .footer-brand-section {
          align-items: flex-start;
        }

        .footer-logo-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
        }

        .footer-tagline {
          color: var(--color-text-secondary);
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
          max-width: 280px;
        }

        .footer-version-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: var(--color-bg-subtle);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 8px);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .footer-links-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .footer-column-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0;
        }

        .footer-links-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-link-btn {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: color var(--transition-fast, 0.2s ease), transform var(--transition-fast, 0.2s ease);
        }

        .footer-link-btn:hover,
        .footer-link-btn.active {
          color: var(--color-secondary);
        }

        .footer-notice-card {
          background: var(--color-bg-subtle);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .notice-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .notice-card-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
        }

        .footer-notice-text {
          margin: 0;
          font-size: 12px;
          line-height: 1.65;
          color: var(--color-text-muted);
        }

        .footer-bottom-bar {
          max-width: 1280px;
          margin: 32px auto 0;
          padding-top: 20px;
          border-top: 1px solid var(--color-border);
          text-align: center;
        }

        .footer-copyright {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
        }

        @media (max-width: 992px) {
          .footer-container {
            grid-template-columns: 1fr 1fr;
            gap: 28px;
          }
        }

        @media (max-width: 600px) {
          .footer-container {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .app-footer {
            padding: 36px 16px 88px; /* Extra bottom clearance for mobile bottom nav */
          }
        }
      `})]})}export{m as t};