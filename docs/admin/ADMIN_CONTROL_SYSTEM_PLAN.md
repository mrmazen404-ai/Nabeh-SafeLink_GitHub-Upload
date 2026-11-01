# خطة بناء نظام التحكم Admin بالكامل — Nabeh SafeLink

## 1. الهدف

بناء نظام تحكم إداري كامل وآمن لإدارة مستخدمي Nabeh SafeLink، الفحوصات، الإحصائيات، البلاغات، النماذج، الإعدادات، الجلسات، الصلاحيات وسجل التدقيق، دون تغيير تجربة المستخدم العادية أو كسر API الحالي.

النظام الإداري سيكون تطبيقاً منفصلاً منطقياً عن واجهة المستخدم، لكنه يستخدم Backend وSupabase نفسه عبر مسار محمي:

```text
Admin Browser
    ↓ HTTPS
Admin Frontend
    ↓ Admin API فقط
FastAPI Admin Router
    ↓ service_role داخل الخادم فقط
Supabase Admin Tables + SafeLink Business Tables
```

## 2. الحالة الحالية المؤكدة

### المنفذ حالياً

- Admin JWT منفصل.
- Scrypt لكلمات المرور.
- TOTP 2FA مع تشفير السر.
- Recovery Codes مخزنة كـ hashes.
- Refresh Sessions مع تدوير Token.
- Logout وLogout All.
- Rate Limit لمحاولات الدخول و2FA.
- RBAC مبدئي للأدوار:
  - `SUPERVISOR`
  - `ADMIN`
  - `SUPER_ADMIN`
- Audit Logs append-only على مستوى المخطط.
- جداول Admin موجودة في Supabase.
- واجهة Admin أولية لتسجيل الدخول و2FA والجلسات.
- Migration آمنة للتحقق من أطوال Hash وإصلاحها.

### غير مكتمل

- لوحة تحكم حقيقية.
- إدارة المستخدمين.
- إدارة الفحوصات.
- إدارة البلاغات والدعم.
- إحصائيات تشغيلية.
- إدارة النماذج والإصدارات.
- إدارة المؤشرات الخطرة.
- الإعدادات والسياسات.
- إدارة Admins والدعوات والصلاحيات الدقيقة.
- Protected Frontend Routes كاملة.
- اختبار E2E شامل.

## 3. مبادئ غير قابلة للتفاوض

1. **لا توجد صلاحيات Admin في الواجهة فقط**؛ كل قرار صلاحية يُفرض في Backend.
2. **لا يتم كشف service_role أو أي سر داخل Frontend.**
3. **كل عملية تغيير إدارية تُسجل في Audit Log.**
4. **البيانات الحساسة لا تظهر كاملة في القوائم أو السجلات.**
5. **لا نحذف بيانات تشغيلية مباشرة**؛ نستخدم حالات وتعطيل وSoft Delete حيث يلزم.
6. **أي Migration تفشل قبل التعديل إذا كانت البيانات الحالية غير متوافقة.**
7. **لا نغير جداول المستخدمين أو API الحالي دون Migration موثقة واختبارات Regression.**
8. **كل مرحلة تنتهي باختبارات Backend وFrontend وSecurity قبل الانتقال للمرحلة التالية.**

## 4. نموذج الصلاحيات المقترح

| المجال | SUPERVISOR | ADMIN | SUPER_ADMIN |
|---|---:|---:|---:|
| قراءة Dashboard | نعم | نعم | نعم |
| قراءة المستخدمين | نعم | نعم | نعم |
| تعديل حالة مستخدم | لا | نعم | نعم |
| قراءة تفاصيل الفحص المقنعة | نعم | نعم | نعم |
| إدارة البلاغات والدعم | نعم | نعم | نعم |
| قراءة Audit Logs | نعم | نعم | نعم |
| تعديل إعدادات التشغيل | لا | محدود | نعم |
| مراجعة Feedback | نعم | نعم | نعم |
| إدارة المؤشرات الخطرة | لا | نعم | نعم |
| إدارة Model Versions | قراءة | محدود | نعم |
| دعوة Admin | لا | لا | نعم |
| تغيير أدوار Admin | لا | لا | نعم |
| إيقاف Admin آخر | لا | لا | نعم |
| إدارة سياسات الخصوصية | قراءة | لا | نعم |
| إدارة إعدادات حساسة | لا | لا | نعم |
| حذف أو إتلاف بيانات | لا | لا | لا/إجراء منفصل |

> هذه الصلاحيات تُنفذ كـ permission codes في Backend، وليس كفحص role نصي مبعثر داخل المسارات.

## 5. المراحل التنفيذية

## المرحلة 0 — تثبيت النطاق والـ Baseline

### الأعمال

- تجميد وظائف المستخدم الحالية.
- تثبيت Commit مرجعي.
- توثيق API الحالي وجداول Supabase.
- تحديد البيئة: Local / Staging / Production.
- التأكد من عدم وجود Admin secrets في Git.
- اعتماد مصفوفة الأدوار والصلاحيات.

### مخرجات المرحلة

- Baseline موثق.
- قائمة API الحالية.
- مصفوفة صلاحيات معتمدة.
- قائمة مخاطر مفتوحة.

### معيار القبول

- كل اختبارات النظام الحالية ناجحة.
- لا يوجد تغيير في سلوك المستخدم العادي.

## المرحلة 1 — تثبيت قاعدة بيانات Admin

### الأعمال

1. تشغيل استعلام فحص أطوال Hash.
2. تشغيل Migration `admin_hash_lengths_migration.sql` في Staging.
3. التحقق من:
   - `character_maximum_length = 64`.
   - Foreign Keys.
   - RLS.
   - Grants.
   - Audit Trigger.
4. مراجعة أنواع العلاقات الخاصة بـ Admin.
5. إضافة Indexes اللازمة للقوائم والتصفية.
6. إعداد Backup قبل Production.

### معيار القبول

- لا توجد أعمدة Hash بطول 1.
- لا يمكن لـ `anon` أو `authenticated` الوصول إلى جداول Admin.
- `service_role` فقط يستخدمه Backend.
- Audit Logs لا تقبل UPDATE أو DELETE.

## المرحلة 2 — تقوية Admin Authentication

### Backend

- توحيد Response Contract للمصادقة.
- إنهاء تدفق Bootstrap لمرة واحدة.
- منع إعادة استخدام Bootstrap Token.
- تحسين Refresh Token Rotation.
- إضافة كشف Token Reuse وإلغاء Token Family.
- تسجيل كل محاولات الدخول الناجحة والفاشلة.
- قفل مؤقت للحساب أو IP عند الهجوم.
- التحقق من `aud`, `iss`, `exp`, `iat`, `sid` في JWT.
- إضافة Correlation/Request ID لكل طلب.
- منع تسجيل الأسرار أو Tokens في Logs.

### Frontend

- حفظ Access Token في الذاكرة قدر الإمكان.
- استخدام Refresh Token عبر مسار مضبوط وآمن.
- Logout عند انتهاء الجلسة.
- عدم عرض Recovery Codes إلا مرة واحدة.
- تحذير المستخدم قبل مغادرة شاشة Recovery Codes.

### الاختبارات

- Login صحيح وخاطئ.
- 2FA صحيح وخاطئ.
- Recovery Code يستخدم مرة واحدة.
- Refresh Rotation.
- Token Reuse.
- Suspended Admin.
- انتهاء الجلسة.
- Rate Limit.

## المرحلة 3 — Admin Shell والواجهة الأساسية

### الصفحات

- Login.
- 2FA Setup.
- 2FA Verify.
- Dashboard.
- Profile.
- Sessions.
- Notifications.
- صفحة 403.
- صفحة 404.
- صفحة انتهاء الجلسة.

### التصميم

- هوية بصرية مستوحاة من Welcome.
- Responsive فعلي من 390px إلى الشاشات الكبيرة.
- RTL وLTR.
- Dark Mode.
- Sidebar للكمبيوتر.
- Bottom Navigation للهاتف.
- Breadcrumbs.
- Loading / Empty / Error States.
- عدم وجود روابط شكلية غير موصولة.

### معيار القبول

- لا يمكن فتح أي صفحة داخلية بدون Admin Token.
- لا توجد شاشة بيضاء عند انتهاء الجلسة.
- جميع أزرار التنقل موصولة بمسارات حقيقية.
- لا يوجد overflow أفقي في 390×844 و768×1024 و1440×900.

## المرحلة 4 — Dashboard التشغيلي

### مؤشرات رئيسية

- إجمالي المستخدمين.
- المستخدمون النشطون والموقوفون.
- عدد الفحوصات اليوم والأسبوع والشهر.
- نتائج `SAFE`, `SUSPICIOUS`, `DANGEROUS`, `UNKNOWN`.
- الفحوصات الفاشلة.
- البلاغات الجديدة.
- طلبات الدعم المفتوحة.
- نشاط Admins.

### قواعد البيانات

- Queries محددة ومفهرسة.
- Pagination وعدم تحميل كل البيانات.
- فلترة زمنية واضحة.
- تجنب كشف input الأصلي.
- إظهار وقت آخر تحديث.

### معيار القبول

- الأرقام قابلة للمطابقة مع SQL مستقل.
- لا تؤثر Queries على أداء فحص المستخدم.
- تظهر حالات Loading وNo Data وError بوضوح.

## المرحلة 5 — إدارة المستخدمين

### الوظائف

- قائمة المستخدمين مع Pagination.
- بحث بالبريد أو الاسم بعد masking مناسب.
- فلترة حسب الحالة واللغة والدور والتاريخ.
- عرض ملف المستخدم.
- عرض آخر نشاط وعدد الفحوصات.
- Suspend / Activate.
- عرض طلب حذف الحساب.
- إضافة ملاحظة إدارية دون تخزين أسرار.
- منع تعديل كلمة المرور مباشرة من Admin.

### الحماية

- لا تعرض `password_hash` أو OTP أو secrets.
- كل Suspend/Activate يتطلب سبباً.
- كل تعديل يسجل Before/After بشكل مقنع.
- لا يسمح Admin بتعديل Admin من خلال هذا القسم.

## المرحلة 6 — إدارة الفحوصات والنتائج

### الوظائف

- قائمة الفحوصات.
- فلترة حسب النوع والحالة والتصنيف والمصدر والتاريخ.
- تفاصيل الفحص.
- عرض Signals وExplanations.
- عرض Model Version.
- عرض نتيجة Gemini أو Rule أو ML حسب الصلاحية.
- إخفاء URL أو الرسالة الأصلية افتراضياً.
- كشف البيانات الحساسة عند الحاجة وبصلاحية منفصلة.
- تسجيل كل عملية Reveal في Audit.

### معيار القبول

- لا تظهر مدخلات حساسة في القوائم.
- الفحص لا يمكن تعديله يدوياً دون عملية Review موثقة.
- لا يمكن للمسؤول تغيير classification مباشرة دون Audit وسبب.

## المرحلة 7 — Feedback والدعم وطلبات حذف الحساب

### Feedback

- قائمة البلاغات الجديدة.
- فلترة حسب التصنيف والحالة.
- فتح البلاغ المرتبط بالفحص.
- تغيير الحالة إلى Reviewed أو Used for Analysis.
- تحديد المراجع.
- تسجيل التعليق الإداري.

### Support Requests

- Open / In Progress / Resolved / Closed.
- Priority.
- Assignment إلى Admin.
- رد داخلي وملاحظات.
- Audit لكل تغيير.

### Account Deletion Requests

- قائمة الطلبات.
- التحقق من حالة الطلب.
- Cancel / Process وفق سياسة واضحة.
- منع الإكمال اليدوي غير القابل للتراجع.
- تسجيل سبب القرار.

## المرحلة 8 — الإحصائيات والتقارير

### التقارير

- اتجاهات الفحوصات.
- معدل التهديدات.
- أنواع الاحتيال.
- مصادر الإشارات.
- جودة النموذج.
- توزيع اللغات.
- معدل الأخطاء.
- نشاط الدعم.

### متطلبات تقنية

- Endpoints منفصلة للإحصائيات.
- Aggregation في SQL وليس في المتصفح.
- Timezone واضح.
- حماية من استعلامات مكلفة.
- Cache قصير للرسوم غير الحساسة عند الحاجة.
- Export CSV فقط بعد تطبيق masking والصلاحية.

## المرحلة 9 — إدارة Model Versions والمؤشرات الخطرة

### Model Versions

- عرض الإصدارات.
- Training / Candidate / Approved / Retired.
- مقارنة Metrics.
- Approval يتطلب `SUPER_ADMIN`.
- منع اعتماد نسخة دون Metrics وArtifact Reference.
- تسجيل المسؤول والتاريخ والسبب.

### Dangerous Indicators

- عرض المؤشرات المقنعة.
- DOMAIN / URL_HASH / IP / EMAIL / KEYWORD.
- Severity.
- Active / Inactive.
- إضافة وتعديل وتعطيل.
- عدم تخزين قيمة سرية خام عند عدم الحاجة.
- منع التلاعب دون Audit.

## المرحلة 10 — إدارة Admins والدعوات والصلاحيات

### الوظائف

- دعوة Admin.
- تحديد الدور.
- انتهاء الدعوة وإلغاؤها.
- قبول الدعوة وإعداد كلمة المرور و2FA.
- Suspend / Activate Admin.
- تغيير الدور وفق قواعد منع التصعيد.
- عرض جلسات كل Admin.
- Logout All لمسؤول محدد.
- منع `SUPER_ADMIN` الأخير من إلغاء نفسه أو تعطيله.

### قواعد إلزامية

- لا يمكن إنشاء `SUPER_ADMIN` من الواجهة العادية.
- لا يمكن لـ Admin منح نفسه صلاحية.
- لا يمكن حذف آخر Super Admin فعال.
- كل تغيير Role يسجل Before/After وسبباً.

## المرحلة 11 — Audit Center والإشعارات

### Audit Center

- Pagination.
- فلترة حسب المسؤول والإجراء والمورد والتاريخ.
- عرض Before/After بعد masking.
- عرض Request ID.
- البحث دون كشف الأسرار.
- Export مقيد.

### Notifications

- تنبيهات Admin.
- unread/read.
- تنبيه تسجيل دخول مشبوه.
- تنبيه فشل خدمة تحليل.
- تنبيه ارتفاع الفحوصات الخطرة.
- تنبيه فشل أو تأخر Jobs.

## المرحلة 12 — Settings والسياسات

### System Settings

- قراءة الإعدادات العامة.
- تعديل الإعدادات المسموح بها فقط.
- Validation للأنواع والقيم.
- Versioning أو Audit لكل تعديل.
- منع تخزين Secrets في `system_settings`.

### Policy Documents

- Terms / Privacy / Disclaimer.
- عربي وإنجليزي.
- Draft / Active.
- Version.
- Publish يتطلب `SUPER_ADMIN`.
- منع حذف نسخة منشورة؛ يتم إنشاء نسخة جديدة.

## المرحلة 13 — الاختبارات الشاملة

### Backend

- Unit Tests.
- API Tests.
- RBAC Matrix Tests.
- SQL/Migration Verification.
- Rate Limit Tests.
- Token Rotation Tests.
- Audit Immutability Tests.
- Sensitive Data Masking Tests.

### Frontend

- Build Production.
- Route Guards.
- Forms Validation.
- Loading/Error/Empty States.
- RTL/LTR.
- Dark Mode.
- Responsive Screenshots.

### E2E

1. Bootstrap.
2. Login.
3. Setup 2FA.
4. Logout.
5. Login + 2FA.
6. Refresh Session.
7. Invite Admin.
8. Change Role.
9. Suspend User.
10. Review Scan.
11. Review Feedback.
12. View Audit.
13. Logout All.

### معيار الإطلاق

- كل الاختبارات ناجحة.
- لا توجد Secrets في Git.
- لا توجد أخطاء Console.
- لا توجد روابط وهمية.
- لا توجد أخطاء 404 للـ Assets.
- لا يوجد Horizontal Overflow.

## المرحلة 14 — Staging ثم Production

### Staging

- نسخة Supabase منفصلة أو مشروع Staging.
- تطبيق Migration Hash.
- إنشاء Super Admin تجريبي.
- اختبار كامل ببيانات غير حساسة.
- اختبار Restore/Backup.
- اختبار الأداء.
- فحص Security Headers وCORS.

### Production Checklist

- `ADMIN_JWT_SECRET` عشوائي بطول مناسب.
- `ADMIN_TOTP_ENCRYPTION_KEY` Fernet صحيح.
- `ADMIN_IP_SALT` عشوائي.
- `ADMIN_BOOTSTRAP_TOKEN` مؤقت ثم تدويره/إلغاؤه.
- `SUPABASE_SECRET_KEY` على Backend فقط.
- لا توجد مفاتيح داخل Frontend.
- HTTPS مفعل.
- CORS محدود للنطاقات الفعلية.
- Logs لا تحتوي Tokens أو كلمات مرور أو OTP.
- Backup قبل Migration.
- خطة Rollback جاهزة.

## 6. ترتيب التنفيذ العملي

الترتيب الإلزامي:

```text
0. Baseline
1. Database Verification + Hash Migration
2. Auth Hardening
3. Admin Shell
4. Dashboard
5. Users
6. Scans
7. Feedback + Support + Deletion Requests
8. Statistics
9. Models + Indicators
10. Admin Management + RBAC
11. Audit + Notifications
12. Settings + Policies
13. E2E + Security
14. Staging + Production
```

لا نبدأ إدارة المستخدمين أو الفحوصات قبل إنهاء المرحلة 2 و3، لأن أي وحدة مبنية قبل تثبيت الصلاحيات والـ Shell ستحتاج إعادة بناء.

## 7. تعريف Done لكل وحدة

لا تعتبر أي وحدة مكتملة إلا إذا توفرت:

- API حقيقي موصول بقاعدة البيانات.
- صلاحيات Backend.
- واجهة Loading/Error/Empty.
- Pagination أو حدود بيانات.
- Masking للبيانات الحساسة.
- Audit للعمليات التغييرية.
- Tests.
- RTL/LTR.
- Responsive.
- توثيق Endpoint وSQL.
- اختبار يمنع الوصول غير المصرح به.

## 8. المخاطر الرئيسية

| الخطر | التأثير | المعالجة |
|---|---|---|
| Hash بطول خاطئ | فشل Login/Refresh/2FA | تنفيذ Migration الآمنة والتحقق أولاً |
| تسريب service_role | سيطرة كاملة على القاعدة | Backend فقط وSecret Manager |
| صلاحيات في Frontend فقط | تجاوز كامل للصلاحيات | RBAC في Dependencies وServices |
| كشف URL أو رسائل المستخدمين | مشكلة خصوصية | Masking وReveal Audit |
| حذف بيانات مباشرة | فقدان غير قابل للتراجع | Soft Delete وWorkflow موثق |
| Queries غير مفهرسة | بطء أو توقف | Indexes وPagination وAggregations |
| Audit قابل للتعديل | فقدان الثقة والتحقيق | Trigger + صلاحيات append-only |
| تضارب custom_users/admin_users | سجل هوية غير صحيح | حقول Admin مستقلة للعمليات الإدارية |

## 9. أول Sprint مقترح

### Sprint 1

1. تشغيل استعلام فحص Hash.
2. تطبيق Migration في Staging.
3. التحقق من RLS وForeign Keys.
4. توحيد Permission Codes.
5. بناء Auth Client في Admin Frontend.
6. بناء Protected Route.
7. بناء Admin Layout Responsive.
8. بناء صفحة Dashboard أولية ببيانات حقيقية.
9. إضافة اختبارات RBAC وSession Refresh.

### مخرجات Sprint 1

- دخول Admin قابل للاستخدام.
- 2FA قابل للاستخدام.
- جلسة محمية.
- Layout فعلي.
- Dashboard أولي حقيقي.
- تقرير اختبارات.

## 10. قرار التنفيذ

لن يتم تعديل قاعدة Production أو حذف بيانات أو نشر Admin للعامة قبل:

1. تحقق أطوال Hash.
2. نجاح Migration في Staging.
3. نجاح اختبارات Auth وRBAC.
4. مراجعة RLS وGrants.
5. نجاح اختبار E2E الأساسي.
6. وجود Rollback واضح.
