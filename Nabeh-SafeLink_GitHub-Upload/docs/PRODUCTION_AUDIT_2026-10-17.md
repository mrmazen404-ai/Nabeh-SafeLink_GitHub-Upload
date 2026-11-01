# تقرير التدقيق الإنتاجي — Nabeh SafeLink

**تاريخ التدقيق:** 17 أكتوبر 2026
**نطاق التدقيق:** Backend FastAPI، اتصال الواجهات، CSP/CORS، المصادقة، إحصائيات Welcome، Build، واستجابة CSS.

## النتيجة الواقعية

- **Backend:** 38 اختبارًا ناجحًا قبل إصلاحات هذا التدقيق، مع تحذير طول مفتاح JWT في اختبار متعمد.
- **Frontend:** Vite production build ناجح.
- **Admin Frontend:** Vite production build ناجح.
- **لم يتم الادعاء باختبار Supabase أو VirusTotal أو Gemini الحقيقي** لأن الأرشيف لا يحتوي أسرارًا ولا بيئة staging.
- لم تُحذف أي ملفات من المشروع. أضيفت اختبارات ووثائق ونموذج بيئة فقط، مع إصلاحات مصدرية.

## فجوات اكتُشفت وأُغلقت

### 1. CORS المحلي
كان الافتراضي `localhost:3000` بينما Vite يعمل على `5173` وAdmin على `5174`، ما يسبب فشل اتصال FastAPI محليًا. تم توحيد الافتراضي مع المنافذ الفعلية، مع إبقاء الإنتاج معتمدًا على قائمة HTTPS صريحة.

### 2. إحصائيات الزوار
كان مسار الزوار يقبل معرّفًا يرسله العميل، ويستخدم fallback salt ثابتًا، ويعيد نجاحًا أو أرقامًا صفرية عند فشل جدول Supabase. هذا قد يخفي عطلًا ويتيح تضخيم الأرقام. تم:

- إلزام `VISITOR_HASH_SALT` سريًا بطول 32 حرفًا على الأقل.
- إضافة rate limit مستقل لمساري `/api/v1/public/visit` و`/api/v1/public/overview`.
- جعل فشل التخزين أو العد يظهر كـ `503` بدل نجاح مضلل.
- الإبقاء على التجزئة غير القابلة للعكس وعدم تخزين IP الخام.

### 3. حماية خوادم Vite
كان `allowedHosts: true` في preview الرئيسي، ما يوسع سطح DNS rebinding. تم قصره على `localhost` و`127.0.0.1` في الواجهتين.

### 4. CSP
تمت إزالة `unsafe-eval` و`unsafe-inline` من `script-src`، وإضافة نطاقات `*.intellidefenda.com` لعمل API على نطاق فرعي مثل `api.intellidefenda.com`، مع إبقاء `style-src` inline لأن المشروع يستخدم أنماطًا ديناميكية موجودة في React.

### 5. قابلية إعادة البناء
تم تثبيت نسخ اعتماديات Admin بدل `latest` لضمان أن البناء القادم لا يتغير تلقائيًا بسبب إصدار خارجي جديد.

## نقاط لا تزال تعتمد على بيئة النشر

1. يجب تطبيق `backend/sql/public_metrics_migration.sql` على Supabase قبل عرض أرقام الزوار.
2. يجب ضبط `VISITOR_HASH_SALT` و`NABEH_RATE_LIMIT_SALT` بقيم عشوائية مختلفة.
3. يجب ضبط Upstash Redis في الإنتاج؛ مع `NABEH_RATE_LIMIT_FAIL_CLOSED=true` سيتوقف المسار المحمي بدل فتحه عند تعطل مزود الحد.
4. يجب إضافة كل نطاقات الإنتاج الحقيقية إلى `NABEH_CORS_ALLOWED_ORIGINS` دون wildcard.
5. يجب نشر Backend فعليًا واختبار `/health` وطلبات CORS من النطاقين الرئيسي وAdmin في staging.

## مصفوفة اختبار ما قبل الإنتاج

```bash
python -m compileall -q backend main.py
pytest -q
cd frontend && npm ci && npm run build
cd ../admin_frontend && npm ci && npm run build
```

اختبارات HTTP بعد النشر:

```bash
curl -i https://api.example.com/health
curl -i -X OPTIONS https://api.example.com/api/v1/public/overview \
  -H 'Origin: https://intellidefenda.com' \
  -H 'Access-Control-Request-Method: GET'
curl -i https://api.example.com/api/v1/public/overview
```

يجب أن تكون النتيجة `200` مع بيانات حقيقية بعد تطبيق Migration، أو `503` واضحًا عند عدم إعداد Supabase؛ لا تعتبر استجابة صفرية دليل نجاح.

## ملاحظات التجاوب

تمت مراجعة قواعد `clamp()`, `min-width: 0`, breakpoints، وتغليف المحتوى في Scanner/Result/Welcome والصفحات المتقدمة. Build يثبت سلامة التحويل، لكنه لا يثبت وحده الاختبار البصري لكل متصفح. يلزم في staging فحص 390، 412، 768، 1024، و1440 بمتصفحات Chrome/Firefox/Safari، خصوصًا الجداول وصفحة المقارنة.
