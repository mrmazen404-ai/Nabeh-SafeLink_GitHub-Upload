# المرحلة الثانية — المصادقة والجلسات وRBAC

## المنفذ

### JWT Admin

- إضافة `iss` و`aud` إلى Admin JWT.
- إلزام Claims الأساسية: `sub`, `type`, `purpose`, `jti`, `iat`, `nbf`, `exp`, `iss`, `aud`.
- إبقاء JWT Admin منفصلاً عن JWT المستخدمين.
- رفض Token ذي Audience أو Purpose غير صحيح.

### ربط Token بالجلسة

- كل Access Token صادر بعد المصادقة يحتوي `sid` لجلسة موجودة فعلياً في `admin_sessions`.
- `current_admin` يتحقق من:
  - وجود المسؤول.
  - حالة المسؤول `ACTIVE`.
  - تحقق البريد.
  - صحة الدور.
  - وجود الجلسة.
  - عدم إلغاء الجلسة.
  - عدم انتهاء الجلسة.
- إلغاء الجلسة يمنع استخدام Access Token المرتبط بها.

### Refresh Token Rotation

- كل Refresh Token يستخدم مرة واحدة.
- التدوير يتم بشرط أن تكون الجلسة غير ملغاة.
- الجلسة الجديدة تحافظ على `token_family`.
- إعادة استخدام Token ملغى تؤدي إلى إبطال الجلسات المتبقية في العائلة وتسجيل سبب `REUSE_DETECTED`.
- تحديث `last_used_at` عند التدوير.

### حماية Password Verification

- تقييد معاملات scrypt المقبولة لمنع Stored-Hash DoS.
- رفض salt أو parameters غير صالحة.

### Rate Limit Audit

- تسجيل محاولات `RATE_LIMITED` في `admin_login_attempts` بدلاً من إسقاطها دون أثر.

### IP Trust

- عدم الثقة في `X-Forwarded-For` افتراضياً.
- قراءة Proxy Header فقط عند تفعيل `NABEH_TRUST_PROXY_HEADERS=true` خلف Reverse Proxy موثوق.

### RBAC

تم إضافة Permission Codes مركزية حسب الدور، منها:

- `dashboard.read`
- `users.read`
- `users.manage`
- `scans.read`
- `scans.review`
- `feedback.read`
- `feedback.manage`
- `support.read`
- `support.manage`
- `audit.read`
- `sessions.read`
- `sessions.manage`
- `indicators.manage`
- `models.approve`
- `admins.manage`
- `settings.manage`
- `policies.manage`

تم ربط مسارات الجلسات وسجل التدقيق بـ Permission Codes بدلاً من فحص أسماء الأدوار مباشرة.

### Admin Frontend

- Access Token محفوظ في `sessionStorage`.
- Refresh Token محفوظ في `localStorage` للتوافق مع التدفق الحالي.
- تجديد تلقائي عند استجابة 401 للمسارات المحمية.
- منع حلقة تجديد للمسارات الخاصة بالمصادقة.
- مسح Tokens عند فشل التجديد.
- استعادة جلسة Admin عند إعادة فتح الصفحة إذا كانت Tokens موجودة.

## التحقق

- Backend tests: `37 passed`.
- Admin frontend production build: ناجح.
- Frontend production build: ناجح قبل استعادة ملفات `dist` المولدة.
- OpenAPI: `13` مسار Admin مسجل، والمسارات الأساسية موجودة.
- `git diff --check`: ناجح.

## ملاحظات التشغيل

- لم يتم الاتصال بقاعدة Production من بيئة التطوير.
- لا توجد Migration جديدة مطلوبة لهذه المرحلة؛ تعتمد على جداول Admin التي تم تثبيتها في المرحلة الأولى.
- يجب نشر Backend وAdmin Frontend معاً لأن Access Token أصبح يتطلب `sid` وJWT أصبح يتطلب Issuer/Audience.
- يجب ضبط متغيري البيئة التاليين في كل بيئة:

```env
ADMIN_JWT_ISSUER=nabeh-admin
ADMIN_JWT_AUDIENCE=nabeh-admin-api
```
