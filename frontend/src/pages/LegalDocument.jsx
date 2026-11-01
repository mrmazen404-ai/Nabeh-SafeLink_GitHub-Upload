import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLegalDocument } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

function MarkdownView({ content }) {
  return <div className="legal-markdown">{String(content || '').split(/\\n|\n/).map((line, index) => {
    const value = line.trim();
    if (!value) return <div key={index} className="legal-space" />;
    if (value.startsWith('## ')) return <h2 key={index}>{value.slice(3)}</h2>;
    if (value.startsWith('# ')) return <h1 key={index}>{value.slice(2)}</h1>;
    if (value.startsWith('- ')) return <li key={index}>{value.slice(2)}</li>;
    return <p key={index}>{value}</p>;
  })}</div>;
}

export default function LegalDocument({ type = 'privacy' }) {
  const { lang, dir } = useLanguage();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [error, setError] = useState('');
  const normalized = type.toUpperCase() === 'TERMS' ? 'TERMS' : type.toUpperCase() === 'DISCLAIMER' ? 'DISCLAIMER' : 'PRIVACY';

  useEffect(() => {
    getLegalDocument(normalized, lang === 'en' ? 'en' : 'ar')
      .then((result) => setDocument(result.data))
      .catch(() => setError(lang === 'en' ? 'This document is currently unavailable.' : 'الوثيقة غير متاحة حاليًا. تأكد من تطبيق Migration الخصوصية.'));
  }, [normalized, lang]);

  return <main className="legal-page" dir={dir}>
    <div className="legal-shell">
      <button type="button" className="legal-back" onClick={() => navigate(-1)}>{lang === 'en' ? 'Back' : 'رجوع'}</button>
      {error && <div className="legal-error" role="alert">{error}</div>}
      {document && <>
        <p className="legal-eyebrow">Nabeh SafeLink · v{document.version}</p>
        <h1>{document.title}</h1>
        <p className="legal-date">{lang === 'en' ? 'Published' : 'تاريخ النشر'}: {document.published_at ? new Date(document.published_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA') : '—'}</p>
        <MarkdownView content={document.content_markdown} />
      </>}
    </div>
    <style>{`.legal-page{min-height:100vh;min-height:100dvh;padding:40px 20px;background:var(--color-bg,#f8fafc);color:var(--color-text,#172033)}.legal-shell{max-width:860px;margin:auto;background:var(--color-surface,#fff);border:1px solid var(--color-border,#e5e7eb);border-radius:20px;padding:clamp(24px,5vw,56px);box-shadow:0 12px 35px rgba(15,23,42,.06)}.legal-back{border:0;background:transparent;color:var(--color-secondary,#2563eb);font:inherit;cursor:pointer;margin-bottom:30px}.legal-eyebrow{font-size:13px;color:var(--color-text-muted,#64748b);margin:0 0 10px}.legal-shell h1{margin:0 0 8px;font-size:clamp(28px,4vw,42px)}.legal-date{color:var(--color-text-muted,#64748b);font-size:13px;margin-bottom:35px}.legal-markdown{line-height:1.9;font-size:16px}.legal-markdown h2{font-size:21px;margin:30px 0 10px}.legal-markdown p{margin:0 0 16px}.legal-markdown li{margin:0 0 8px}.legal-space{height:4px}.legal-error{padding:14px;border-radius:12px;background:#fff1f2;color:#be123c;margin-bottom:20px}`}</style>
  </main>;
}
