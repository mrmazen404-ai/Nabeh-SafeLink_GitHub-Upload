import { useCallback, useEffect, useMemo, useState } from 'react';

const GROUPS = [
  {
    title: 'المظهر وتجربة الاستخدام',
    description: 'قيم افتراضية للحسابات الجديدة أو التي لم تحفظ تفضيلًا بعد.',
    settings: [
      { key: 'ui.default_theme', title: 'الثيم الافتراضي', description: 'يبدأ المستخدم الجديد بالوضع المختار، ويستمر تفضيل المستخدم الحالي إذا كان قد اختار ثيمًا.', type: 'select', options: [{ value: 'light', label: 'فاتح' }, { value: 'dark', label: 'داكن' }] },
      { key: 'ui.default_language', title: 'اللغة الافتراضية', description: 'لغة الموقع للزائر والحساب الجديد قبل تسجيل أي تفضيل شخصي.', type: 'select', options: [{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }] },
      { key: 'ui.allow_theme_override', title: 'السماح بتغيير الثيم', description: 'عند الإيقاف تُخفى أدوات التبديل ويُطبق الثيم الافتراضي دون مسح التفضيل المحفوظ.', type: 'boolean' },
      { key: 'ui.allow_language_override', title: 'السماح بتغيير اللغة', description: 'عند الإيقاف تُخفى أدوات التبديل وتُستخدم اللغة الافتراضية على مستوى الواجهة.', type: 'boolean' },
    ],
  },
  {
    title: 'التشغيل والخصائص',
    description: 'تُفرض هذه الخيارات في واجهة المستخدم وواجهات API الخلفية.',
    settings: [
      { key: 'system.maintenance_mode', title: 'وضع الصيانة', description: 'يحجب استخدام المنتج ويعرض صفحة صيانة. تبقى لوحة Admin وواجهة الإعدادات والصحة متاحة.', type: 'boolean', warning: true },
      { key: 'features.registration_enabled', title: 'تسجيل المستخدمين', description: 'عند الإيقاف يتوقف إنشاء الحسابات الجديدة برسالة واضحة؛ يظل تسجيل الدخول متاحًا.', type: 'boolean' },
      { key: 'features.guest_scans_enabled', title: 'فحص الزائر', description: 'عند الإيقاف يمنع Backend نقطة فحص الضيف؛ تبقى فحوصات المستخدم المسجل متاحة.', type: 'boolean' },
      { key: 'features.public_metrics_enabled', title: 'الإحصائيات العامة', description: 'يتحكم بعرض مؤشرات الصفحة العامة وبجمع الزيارات الجديدة.', type: 'boolean' },
      { key: 'features.ai_explanations_enabled', title: 'شرح Gemini', description: 'عند الإيقاف لا تستدعى Gemini؛ يستمر تحليل الرابط محليًا ومحركات التحقق الأخرى.', type: 'boolean' },
      { key: 'legal.require_latest_terms', title: 'فرض أحدث شروط الاستخدام', description: 'يطلب موافقة صريحة على رقم النسخة الحالية قبل متابعة المستخدم المسجل.', type: 'boolean' },
    ],
  },
];

function Toggle({ checked, disabled, label, onChange }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`settings-switch ${checked ? 'is-on' : ''}`} onClick={onChange}><span /></button>;
}

export default function SystemSettingsPage({ profile, api }) {
  const [settings, setSettings] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canManage = profile?.permissions?.includes('settings.manage') === true;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/settings');
      const next = data?.data || {};
      setSettings(next);
      setBaseline(next);
    } catch (failure) {
      setError(failure.response?.data?.detail || 'تعذر تحميل إعدادات النظام. تحقق من صلاحية settings.read ومن تطبيق migration.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const changes = useMemo(() => {
    if (!settings || !baseline) return {};
    return Object.fromEntries(Object.entries(settings).filter(([key, value]) => value !== baseline[key]));
  }, [settings, baseline]);

  const update = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setNotice('');
  };

  const save = async () => {
    if (!canManage || Object.keys(changes).length === 0 || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch('/settings', changes);
      const committed = { ...baseline, ...(data?.data || changes) };
      setSettings(committed);
      setBaseline(committed);
      setNotice('تم حفظ الإعدادات وتسجيل التغيير في سجل التدقيق.');
    } catch (failure) {
      setError(failure.response?.data?.detail || 'تعذر حفظ الإعدادات. لم تُعتمد التغييرات.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) return <div className="loading-state"><div className="loader" /> جارٍ تحميل إعدادات النظام...</div>;
  if (!settings && error) return <section className="panel"><div className="notice">{error}</div><button type="button" className="filter-button settings-retry" onClick={load}>إعادة المحاولة</button></section>;

  return <div className="page-stack system-settings-page">
    <section className="hero-card settings-hero"><div><span className="eyebrow">تحكم مركزي · System Settings</span><h2>إعدادات النظام</h2><p>تؤثر التغييرات على التطبيق عبر جميع النسخ بعد انتهاء التخزين المؤقت القصير.</p></div><div className="hero-shield">⚙</div></section>
    {!canManage && <div className="notice" role="alert">لديك صلاحية القراءة فقط؛ يلزم settings.manage لتعديل الإعدادات.</div>}
    {error && <div className="notice" role="alert">{error}</div>}
    {notice && <div className="settings-success" role="status">{notice}</div>}
    {GROUPS.map((group) => <section className="panel settings-group" key={group.title}>
      <div className="panel-heading"><div><span className="eyebrow">إدارة مركزية</span><h3>{group.title}</h3><p>{group.description}</p></div></div>
      <div className="settings-list">
        {group.settings.map((item) => <article className={`settings-row ${item.warning && settings[item.key] ? 'settings-row-warning' : ''}`} key={item.key}>
          <div className="settings-copy"><h4>{item.title}</h4><p>{item.description}</p><code>{item.key}</code></div>
          <div className="settings-control">
            {item.type === 'select' ? <select aria-label={item.title} value={settings[item.key] ?? ''} disabled={!canManage || saving} onChange={(event) => update(item.key, event.target.value)}>{item.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <Toggle checked={Boolean(settings[item.key])} disabled={!canManage || saving} label={item.title} onChange={() => update(item.key, !settings[item.key])} />}
            <span className={`settings-state ${settings[item.key] ? 'state-on' : 'state-off'}`}>{item.type === 'select' ? (item.options.find((option) => option.value === settings[item.key])?.label || settings[item.key]) : (settings[item.key] ? 'مفعّل' : 'متوقف')}</span>
          </div>
        </article>)}
      </div>
    </section>)}
    <div className="settings-actions"><span>{Object.keys(changes).length ? `${Object.keys(changes).length} تغيير غير محفوظ` : 'كل التغييرات محفوظة'}</span><button type="button" className="filter-button settings-reset" disabled={!Object.keys(changes).length || saving} onClick={() => { setSettings(baseline); setError(''); setNotice(''); }}>تراجع</button><button type="button" className="settings-save" disabled={!canManage || !Object.keys(changes).length || saving} onClick={save}>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button></div>
  </div>;
}
