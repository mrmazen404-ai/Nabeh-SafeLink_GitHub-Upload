import{S as e,b as t,g as n,n as r,r as i}from"./LanguageContext-DQde-FNV.js";import{A as a,D as o,S as s,_ as c,g as l,k as u,o as d,p as f,r as p,t as m}from"./index-X70wDX--.js";import{t as h}from"./Footer-CgZHATSS.js";var g=e(t(),1),_=i();function v({activeTab:e,setActiveTab:t}){let{t:i}=r(),{user:v,isGuest:y}=u(),b=a(),[x,S]=(0,g.useState)(`scan_issue`),[C,w]=(0,g.useState)(``),[T,E]=(0,g.useState)(``),[D,O]=(0,g.useState)(``),[k,A]=(0,g.useState)(``),[j,M]=(0,g.useState)(!1),[N,P]=(0,g.useState)(``),[F,I]=(0,g.useState)(null);return(0,g.useEffect)(()=>{v&&v.email&&w(v.email)},[v]),(0,_.jsxs)(`div`,{className:`page-wrapper`,children:[(0,_.jsx)(m,{activeTab:e,setActiveTab:t}),(0,_.jsx)(`main`,{className:`main-content`,id:`main-content`,children:(0,_.jsxs)(`div`,{className:`contact-page-container`,children:[(0,_.jsxs)(`nav`,{className:`breadcrumb`,"aria-label":`Breadcrumb`,children:[(0,_.jsx)(`button`,{type:`button`,className:`breadcrumb-link`,onClick:()=>t(`home`),children:i(`nav.breadcrumbHome`)}),(0,_.jsx)(`span`,{className:`breadcrumb-separator`,children:`/`}),(0,_.jsx)(`span`,{className:`breadcrumb-current`,children:i(`nav.contact`)})]}),(0,_.jsxs)(`div`,{className:`contact-header-card`,children:[(0,_.jsx)(`div`,{className:`contact-title-icon`,children:(0,_.jsx)(c,{size:28,color:`var(--color-primary)`})}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`h1`,{className:`contact-h1`,children:i(`contact.title`)}),(0,_.jsx)(`p`,{className:`contact-subtitle`,children:i(`contact.subtitle`)})]})]}),(0,_.jsxs)(`div`,{className:`contact-info-card`,children:[(0,_.jsxs)(`div`,{className:`info-card-header`,children:[(0,_.jsx)(c,{size:18,color:`var(--color-secondary)`}),(0,_.jsx)(`h3`,{children:i(`contact.supportCardTitle`)})]}),(0,_.jsxs)(`div`,{className:`info-card-body`,children:[(0,_.jsxs)(`p`,{children:[(0,_.jsx)(`strong`,{children:i(`contact.supportEmailLabel`)}),` `,(0,_.jsx)(`a`,{href:`mailto:support@nabeh-safelink.com`,className:`support-email-link`,children:`support@nabeh-safelink.com`})]}),(0,_.jsx)(`p`,{className:`hours-note`,children:i(`contact.supportHoursLabel`)})]})]}),y||!v?(0,_.jsxs)(`div`,{className:`guest-policy-card`,children:[(0,_.jsx)(`div`,{className:`policy-icon-badge`,children:(0,_.jsx)(l,{size:32,color:`var(--color-secondary)`})}),(0,_.jsx)(`h2`,{children:`التواصل مع المطور يتطلب إنشاء حساب`}),(0,_.jsx)(`p`,{className:`policy-desc`,children:`لحماية أمان المنظومة وضمان متابعة تذاكر الدعم والرد عليها بدقة، يتطلب إرسال الرسائل والاستفسارات أو التواصل المباشر مع مطوري النظام وجود حساب مفعّل وتسجيل الدخول لحسابك المعتمد.`}),(0,_.jsxs)(`div`,{className:`policy-actions`,children:[(0,_.jsxs)(`button`,{type:`button`,className:`btn-primary`,onClick:()=>b(`/login?next=/contact`),children:[(0,_.jsx)(o,{size:16}),(0,_.jsx)(`span`,{children:`تسجيل الدخول`})]}),(0,_.jsxs)(`button`,{type:`button`,className:`btn-outline`,onClick:()=>b(`/register?next=/contact`),children:[(0,_.jsx)(o,{size:16}),(0,_.jsx)(`span`,{children:`إنشاء حساب جديد`})]}),(0,_.jsxs)(`button`,{type:`button`,className:`btn-secondary`,onClick:()=>t(`faq`),children:[(0,_.jsx)(f,{size:16}),(0,_.jsx)(`span`,{children:`الأسئلة الشائعة`})]})]})]}):F?(0,_.jsxs)(`div`,{className:`contact-success-card`,children:[(0,_.jsx)(`div`,{className:`success-icon-badge`,children:(0,_.jsx)(d,{size:48,color:`var(--color-success)`})}),(0,_.jsx)(`h2`,{children:i(`contact.successTitle`)}),(0,_.jsx)(`p`,{className:`success-msg`,children:i(`contact.successMsg`,{ticketId:F})}),(0,_.jsxs)(`div`,{className:`success-actions`,children:[(0,_.jsx)(`button`,{type:`button`,className:`btn-secondary`,onClick:()=>{I(null),E(``),O(``),A(``),P(``)},children:i(`contact.newRequestBtn`)}),(0,_.jsxs)(`button`,{type:`button`,className:`btn-primary`,onClick:()=>t(`faq`),children:[(0,_.jsx)(f,{size:16}),(0,_.jsx)(`span`,{children:i(`contact.backToFaqBtn`)})]})]})]}):(0,_.jsxs)(`form`,{className:`contact-form-card`,onSubmit:async e=>{if(e.preventDefault(),P(``),!C.trim()||!C.includes(`@`)){P(i(`contact.emailLabel`)+` - الرجاء إدخال بريد إلكتروني صحيح`);return}if(!T.trim()){P(i(`contact.subjectLabel`)+` - هذا الحقل مطلوب`);return}if(!k.trim()){P(i(`contact.detailsLabel`)+` - هذا الحقل مطلوب`);return}M(!0);try{let e=await n({requestType:x,email:C.trim(),subject:T.trim(),scanId:D.trim(),details:k.trim()});e&&e.success&&e.ticket_id?I(e.ticket_id):P(`تعذر حفظ طلب الدعم حاليًا. حاول لاحقًا.`)}catch(e){let t=e?.response?.status;P(t===401?`جلسة التوثيق منتهية. يرجى تسجيل الدخول مجدداً.`:t===429?`تم تجاوز حد الطلبات مؤقتًا. حاول مرة أخرى لاحقًا.`:t>=500?`خدمة الدعم غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.`:`تعذر حفظ طلب الدعم حاليًا. حاول لاحقًا.`)}finally{M(!1)}},noValidate:!0,children:[N&&(0,_.jsxs)(`div`,{className:`form-error-banner`,role:`alert`,children:[(0,_.jsx)(p,{size:18,color:`var(--color-danger)`}),(0,_.jsx)(`span`,{children:N})]}),(0,_.jsxs)(`div`,{className:`form-group`,children:[(0,_.jsx)(`label`,{htmlFor:`requestType`,children:i(`contact.typeLabel`)}),(0,_.jsxs)(`select`,{id:`requestType`,className:`form-control`,value:x,onChange:e=>S(e.target.value),children:[(0,_.jsx)(`option`,{value:`scan_issue`,children:i(`contact.typeScanIssue`)}),(0,_.jsx)(`option`,{value:`inaccurate_result`,children:i(`contact.typeInaccurateResult`)}),(0,_.jsx)(`option`,{value:`account_general`,children:i(`contact.typeAccountGeneral`)}),(0,_.jsx)(`option`,{value:`suggestion`,children:i(`contact.typeSuggestion`)}),(0,_.jsx)(`option`,{value:`other`,children:i(`contact.typeOther`)})]})]}),(0,_.jsxs)(`div`,{className:`form-group`,children:[(0,_.jsxs)(`label`,{htmlFor:`contactEmail`,children:[i(`contact.emailLabel`),` `,(0,_.jsx)(`span`,{className:`verified-badge`,children:`✓ البريد المعتمد للحساب`})]}),(0,_.jsx)(`input`,{id:`contactEmail`,type:`email`,className:`form-control verified-input`,value:C,readOnly:!0,required:!0})]}),(0,_.jsxs)(`div`,{className:`form-group`,children:[(0,_.jsx)(`label`,{htmlFor:`contactSubject`,children:i(`contact.subjectLabel`)}),(0,_.jsx)(`input`,{id:`contactSubject`,type:`text`,className:`form-control`,placeholder:i(`contact.subjectPlaceholder`),value:T,onChange:e=>E(e.target.value),required:!0})]}),(0,_.jsxs)(`div`,{className:`form-group`,children:[(0,_.jsx)(`label`,{htmlFor:`scanId`,children:i(`contact.scanIdLabel`)}),(0,_.jsx)(`input`,{id:`scanId`,type:`text`,className:`form-control`,placeholder:i(`contact.scanIdPlaceholder`),value:D,onChange:e=>O(e.target.value)}),(0,_.jsx)(`span`,{className:`field-hint`,children:i(`contact.scanIdHint`)})]}),(0,_.jsxs)(`div`,{className:`form-group`,children:[(0,_.jsx)(`label`,{htmlFor:`contactDetails`,children:i(`contact.detailsLabel`)}),(0,_.jsx)(`textarea`,{id:`contactDetails`,rows:5,className:`form-control textarea`,placeholder:i(`contact.detailsPlaceholder`),value:k,onChange:e=>A(e.target.value),required:!0})]}),(0,_.jsxs)(`div`,{className:`contact-privacy-alert`,children:[(0,_.jsx)(p,{size:18,color:`var(--color-warning)`}),(0,_.jsx)(`p`,{children:i(`contact.privacyNotice`)})]}),(0,_.jsxs)(`div`,{className:`form-actions`,children:[(0,_.jsx)(`button`,{type:`button`,className:`btn-secondary`,onClick:()=>t(`home`),children:i(`contact.cancelBtn`)}),(0,_.jsx)(`button`,{type:`submit`,className:`btn-primary`,disabled:j,children:j?(0,_.jsx)(`span`,{children:i(`contact.sendingBtn`)}):(0,_.jsxs)(_.Fragment,{children:[(0,_.jsx)(s,{size:16}),(0,_.jsx)(`span`,{children:i(`contact.sendBtn`)})]})})]})]})]})}),(0,_.jsx)(h,{activeTab:e,setActiveTab:t}),(0,_.jsx)(`style`,{children:`
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

        .contact-page-container {
          max-width: 720px;
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

        .contact-header-card {
          display: flex;
          align-items: center;
          gap: var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5, 20px);
          box-shadow: var(--shadow-sm);
        }

        .contact-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: var(--color-secondary-subtle);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .contact-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 4px;
        }

        .contact-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .contact-info-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-4, 16px) var(--space-5, 20px);
        }

        .info-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .info-card-header h3 {
          margin: 0;
          font-size: 15px;
          color: var(--color-text);
        }

        .info-card-body p {
          margin: 4px 0;
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .support-email-link {
          color: var(--color-secondary);
          text-decoration: none;
          font-weight: 600;
        }

        .support-email-link:hover {
          text-decoration: underline;
        }

        .hours-note {
          font-size: 12px;
          color: var(--color-text-muted);
        }

        /* Guest Policy Card */
        .guest-policy-card {
          background: var(--color-surface);
          border: 1.5px solid color-mix(in srgb, var(--color-secondary) 30%, var(--color-border));
          border-radius: var(--radius-lg);
          padding: 36px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-md);
        }

        .policy-icon-badge {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--color-secondary-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .guest-policy-card h2 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          color: var(--color-primary);
        }

        .policy-desc {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.65;
          color: var(--color-text-secondary);
          max-width: 540px;
        }

        .policy-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .contact-form-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          display: flex;
          flex-direction: column;
          gap: var(--space-4, 16px);
          box-shadow: var(--shadow-sm);
        }

        .form-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-danger-subtle);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          color: var(--color-danger);
          font-size: 13px;
          font-weight: 500;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .verified-badge {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--color-success);
          background: var(--color-success-bg);
          border: 1px solid var(--color-success-border);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
        }

        .verified-input {
          background: var(--color-bg-subtle) !important;
          color: var(--color-text-secondary) !important;
          cursor: not-allowed;
        }

        .form-control {
          width: 100%;
          padding: 10px 14px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          color: var(--color-text);
          outline: none;
          transition: border-color var(--transition-fast);
          box-sizing: border-box;
        }

        .form-control:focus {
          border-color: var(--color-secondary);
        }

        .textarea {
          resize: vertical;
          min-height: 100px;
        }

        .field-hint {
          font-size: 12px;
          color: var(--color-text-muted);
        }

        .contact-privacy-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: var(--color-warning-subtle);
          border: 1px solid var(--color-warning);
          border-radius: var(--radius-md);
          padding: 12px 14px;
        }

        .contact-privacy-alert p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--color-text);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-primary {
          background: var(--color-primary);
          color: #ffffff;
          border: none;
          padding: 10px 22px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--color-bg);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all var(--transition-fast, 0.2s ease);
        }

        .btn-outline {
          background: var(--color-bg);
          color: var(--color-primary);
          border: 1.5px solid var(--color-border-strong, var(--color-border));
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all var(--transition-fast, 0.2s ease);
        }

        .btn-outline:hover {
          background: var(--color-secondary-subtle);
          border-color: var(--color-secondary);
          color: var(--color-secondary);
        }

        .contact-success-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-8, 48px) var(--space-6, 24px);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .contact-success-card h2 {
          margin: 0;
          font-size: 20px;
          color: var(--color-text);
        }

        .success-msg {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-secondary);
          max-width: 500px;
          line-height: 1.6;
        }

        .success-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        @media (max-width: 600px) {
          .form-actions {
            flex-direction: column-reverse;
          }
          .btn-primary, .btn-secondary, .btn-outline {
            width: 100%;
            justify-content: center;
          }
          .policy-actions {
            flex-direction: column;
            width: 100%;
          }
        }
      `})]})}export{v as default};