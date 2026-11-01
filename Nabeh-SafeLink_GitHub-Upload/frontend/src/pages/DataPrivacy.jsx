import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api, { cancelAccountDeletion, deleteAccount, exportUserData, getDeletionRequest, requestAccountDeletion } from '../services/api';

export default function DataPrivacy() {
  const { logout } = useAuth();
  const { lang, dir } = useLanguage();
  const en = lang === 'en';
  const [scans, setScans] = useState([]);
  const [deletion, setDeletion] = useState(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [scanResult, deletionResult] = await Promise.all([api.get('/scans/'), getDeletionRequest()]);
      setScans(scanResult.data?.data || []);
      setDeletion(deletionResult.data || null);
    } catch (requestError) { setError(requestError?.response?.status === 401 ? (en ? 'Your session has expired. Please sign in again.' : 'انتهت جلستك. سجّل الدخول مرة أخرى.') : (en ? 'Unable to load data controls.' : 'تعذر تحميل إعدادات البيانات.')); }
  };
  useEffect(() => { load(); }, []);

  const download = async () => {
    setBusy(true); setError('');
    try {
      const result = await exportUserData();
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'nabeh-account-data.json'; anchor.click(); URL.revokeObjectURL(url);
      setMessage(en ? 'Your data export was downloaded.' : 'تم تنزيل نسخة بياناتك.');
    } catch (requestError) { setError(requestError?.response?.status === 401 ? (en ? 'Your session has expired. Please sign in again.' : 'انتهت جلستك. سجّل الدخول مرة أخرى.') : (en ? 'Export failed.' : 'فشل تصدير البيانات.')); }
    finally { setBusy(false); }
  };

  const hide = async (id) => { setBusy(true); setError(''); try { await api.post(`/scans/${encodeURIComponent(id)}/hide`); setScans((items) => items.filter((item) => item.id !== id)); setMessage(en ? 'The scan was hidden from your history.' : 'تم إخفاء الفحص من السجل.'); } catch (e) { setError(e?.response?.status === 401 ? (en ? 'Your session has expired. Please sign in again.' : 'انتهت جلستك. سجّل الدخول مرة أخرى.') : (en ? 'The scan could not be hidden.' : 'تعذر إخفاء الفحص.')); } finally { setBusy(false); } };
  const removeScan = async (id) => { if (!window.confirm(en ? 'Delete this scan data from your account?' : 'هل تريد حذف بيانات هذا الفحص من حسابك؟')) return; setBusy(true); try { await api.delete(`/scans/${encodeURIComponent(id)}`); setScans((items) => items.filter((item) => item.id !== id)); setMessage(en ? 'The scan data was deleted from your account.' : 'تم حذف بيانات الفحص من حسابك.'); } catch (e) { setError(e?.response?.status === 401 ? (en ? 'Your session has expired. Please sign in again.' : 'انتهت جلستك. سجّل الدخول مرة أخرى.') : (en ? 'Deletion failed.' : 'فشل حذف الفحص.')); } finally { setBusy(false); } };

  const startDeletion = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const result = await requestAccountDeletion(reason); setDeletion(result.data); setMessage(en ? 'Deletion request created. Confirm it below.' : 'تم إنشاء طلب الحذف. أكده بالأسفل.'); } catch (e) { setError(e?.response?.status === 401 ? (en ? 'Your session has expired. Please sign in again.' : 'انتهت جلستك. سجّل الدخول مرة أخرى.') : (en ? 'Could not create deletion request.' : 'تعذر إنشاء طلب الحذف.')); } finally { setBusy(false); } };
  const cancelDeletion = async () => { setBusy(true); try { const result = await cancelAccountDeletion(); setDeletion(result.data); setMessage(en ? 'Deletion request cancelled.' : 'تم إلغاء طلب الحذف.'); } catch (e) { setError(e?.response?.status === 401 ? (en ? 'Your session has expired. Please sign in again.' : 'انتهت جلستك. سجّل الدخول مرة أخرى.') : (en ? 'Could not cancel the request.' : 'تعذر إلغاء الطلب.')); } finally { setBusy(false); } };
  const confirmDeletion = async (event) => { event.preventDefault(); if (confirmation !== 'DELETE MY ACCOUNT') { setError(en ? 'Type DELETE MY ACCOUNT exactly.' : 'اكتب DELETE MY ACCOUNT كما هي تمامًا.'); return; } setBusy(true); try { await deleteAccount(password, confirmation); await logout(); } catch (e) { setError(e?.response?.status === 401 ? (en ? 'Your session has expired. Please sign in again.' : 'انتهت جلستك. سجّل الدخول مرة أخرى.') : (en ? 'Account deletion failed.' : 'فشل حذف الحساب.')); setBusy(false); } };

  return <main className="data-page" dir={dir}><div className="data-shell"><h1>{en ? 'Privacy & data controls' : 'الخصوصية وإدارة البيانات'}</h1><p className="data-lead">{en ? 'Control what remains in your account. Hiding removes a scan from history; deletion removes its account association and masks stored input.' : 'تحكم في بيانات حسابك. الإخفاء يزيل الفحص من السجل، والحذف يزيل ارتباطه بالحساب ويمسح المدخل المخزن.'}</p>{message && <div className="data-success" role="status">{message}</div>}{error && <div className="data-error" role="alert">{error}</div>}
    <section className="data-card"><h2>{en ? 'Export my data' : 'تصدير بياناتي'}</h2><p>{en ? 'Download an export containing your account, consents, masked scans, feedback, and support requests.' : 'نزّل نسخة تشمل الحساب والموافقات والفحوصات المقنّعة والبلاغات وطلبات الدعم.'}</p><button className="data-button" type="button" disabled={busy} onClick={download}>{en ? 'Download JSON export' : 'تنزيل نسخة JSON'}</button></section>
    <section className="data-card"><h2>{en ? 'Saved scans' : 'الفحوصات المحفوظة'}</h2>{scans.length === 0 ? <p>{en ? 'No visible saved scans.' : 'لا توجد فحوصات ظاهرة.'}</p> : <div className="data-list">{scans.map((scan) => <div className="data-row" key={scan.id}><div><strong>{scan.classification || scan.input_type}</strong><small>{scan.input_value_masked || '—'} · {scan.created_at ? new Date(scan.created_at).toLocaleString() : ''}</small></div><div className="data-actions"><button type="button" disabled={busy} onClick={() => hide(scan.id)}>{en ? 'Hide' : 'إخفاء'}</button><button type="button" disabled={busy} onClick={() => removeScan(scan.id)}>{en ? 'Delete' : 'حذف'}</button></div></div>)}</div>}</section>
    <section className="data-card danger-card"><h2>{en ? 'Delete account and data' : 'حذف الحساب والبيانات'}</h2><p>{en ? 'This disables your account, anonymizes retained audit references, removes profile data, deletes feedback and notifications, and removes your association with saved scans. This cannot be undone.' : 'سيؤدي ذلك إلى تعطيل الحساب، وإخفاء مرجعك في سجلات التدقيق، وحذف بيانات الملف والبلاغات والإشعارات، وإزالة ارتباطك بالفحوصات. لا يمكن التراجع عن ذلك.'}</p>{deletion?.status === 'COMPLETED' ? <p>{en ? 'The account deletion was completed.' : 'اكتمل حذف الحساب.'}</p> : deletion?.status === 'PENDING' || deletion?.status === 'CONFIRMED' ? <><p>{en ? `Request status: ${deletion.status}` : `حالة الطلب: ${deletion.status}`}</p><button type="button" className="data-button secondary" disabled={busy} onClick={cancelDeletion}>{en ? 'Cancel request' : 'إلغاء الطلب'}</button><form onSubmit={confirmDeletion} className="delete-form"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={en ? 'Current password' : 'كلمة المرور الحالية'} required /><input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="DELETE MY ACCOUNT" required /><button className="data-button danger-button" disabled={busy} type="submit">{en ? 'Confirm permanent deletion' : 'تأكيد الحذف النهائي'}</button></form></> : <form onSubmit={startDeletion} className="delete-form"><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={en ? 'Optional reason' : 'سبب اختياري'} maxLength={1000} /><button className="data-button danger-button" disabled={busy} type="submit">{en ? 'Start deletion request' : 'بدء طلب حذف الحساب'}</button></form>}</section>
  </div><style>{`.data-page{min-height:100vh;min-height:100dvh;padding:36px 18px;background:var(--color-bg,#f8fafc);color:var(--color-text,#172033)}.data-shell{max-width:900px;margin:auto}.data-shell h1{font-size:clamp(28px,5vw,42px);margin:0 0 10px}.data-lead{color:var(--color-text-secondary,#64748b);line-height:1.8}.data-card{background:var(--color-surface,#fff);border:1px solid var(--color-border,#e5e7eb);border-radius:18px;padding:24px;margin:18px 0}.data-card h2{margin-top:0}.data-card p{line-height:1.75}.danger-card{border-color:#fecdd3}.data-success,.data-error{padding:12px 14px;border-radius:12px;margin:15px 0}.data-success{background:#ecfdf5;color:#047857}.data-error{background:#fff1f2;color:#be123c}.data-button{border:0;border-radius:10px;background:#2563eb;color:white;padding:11px 16px;cursor:pointer;font:inherit}.data-button:disabled{opacity:.6;cursor:not-allowed}.secondary{background:#64748b}.danger-button{background:#be123c}.data-list{display:grid;gap:10px}.data-row{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:13px;border:1px solid var(--color-border,#e5e7eb);border-radius:12px}.data-row small{display:block;color:var(--color-text-muted,#64748b);margin-top:5px}.data-actions{display:flex;gap:7px}.data-actions button{border:1px solid var(--color-border,#e5e7eb);background:transparent;border-radius:8px;padding:7px 10px;cursor:pointer}.delete-form{display:grid;gap:10px;margin-top:16px}.delete-form input,.delete-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--color-border,#cbd5e1);border-radius:10px;padding:11px;font:inherit;background:var(--color-bg,#fff);color:inherit}.delete-form textarea{min-height:80px}@media(max-width:600px){.data-row{align-items:flex-start;flex-direction:column}.data-actions{width:100%}.data-actions button{flex:1}}`}</style></main>;
}
