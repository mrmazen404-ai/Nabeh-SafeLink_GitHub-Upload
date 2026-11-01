# إصلاح خطأ فشل اتصال FastAPI في فحص الرابط والرسالة

## التشخيص المؤكد

تم اختبار الإنتاج على:

```text
GET  https://intellidefenda.com/health
GET  https://intellidefenda.com/api/v1/health
POST https://intellidefenda.com/api/v1/scans/guest
```

مسار فحص الرابط أعاد `HTTP 200` ونتيجة تصنيف كاملة، مع:

```text
access-control-allow-origin: https://intellidefenda.com
x-request-id: موجود
```

لذلك لم يكن العطل انقطاع FastAPI أو CORS في المسار المنشور.

## سبب العطل

دالة `analyze_sms_message` كانت تمر على عدة نماذج Gemini ومحاولتي Search/JSON لكل نموذج دون مهلة إجمالية. عند بطء مزود Gemini كان طلب الرسالة يبقى معلقاً، ثم ينتهي Axios برسالة عامة:

```text
تعذر الاتصال بخادم FastAPI
```

كما أن واجهة المستخدم كانت تخفي تفاصيل HTTP الحقيقية وتعرض نفس الرسالة لأي خطأ.

## الإصلاح

- إضافة `SCAN_AI_TIMEOUT_SECONDS` بقيمة افتراضية 18 ثانية.
- وضع `asyncio.wait_for` حول تحليل Gemini للرسائل والروابط.
- إرجاع تحليل محلي آمن عند Timeout أو فشل Gemini بدلاً من إسقاط الطلب.
- الحفاظ على تحليل VirusTotal والـ ML عند توفر الرابط.
- رفع مهلة Axios من 30 إلى 60 ثانية لتتسق مع زمن مزودي التحليل.
- عرض رسالة HTTP القادمة من Backend إن وجدت.
- عرض رسالة Timeout واضحة بدلاً من رسالة اتصال مضللة.

## متغير الإنتاج

أضف إلى Vercel Backend:

```env
SCAN_AI_TIMEOUT_SECONDS=18
```

ثم أعد Deploy. لا تضع أي مفتاح Gemini أو Supabase في Frontend.

## الاختبارات

```bash
python -m compileall -q backend main.py
pytest -q
npm run build --prefix admin_frontend
npm run build --prefix frontend
git diff --check
```

النتيجة المحلية:

- 38 اختبار Backend ناجح.
- Build Admin ناجح.
- Build Main Frontend ناجح.
- اختبار Timeout مخصص لفحص الرسائل ناجح.

## اختبار الإنتاج بعد النشر

```bash
curl -fsS https://intellidefenda.com/health
curl -fsS https://intellidefenda.com/api/v1/health

curl -fsS \
  -H 'Origin: https://intellidefenda.com' \
  -H 'Content-Type: application/json' \
  -X POST https://intellidefenda.com/api/v1/scans/guest \
  -d '{"input_type":"URL","input_value":"https://example.com","language":"ar"}'
```

اختبار الرسالة يجب تنفيذه بعد نشر Commit الإصلاح:

```bash
curl -fsS \
  -H 'Origin: https://intellidefenda.com' \
  -H 'Content-Type: application/json' \
  -X POST https://intellidefenda.com/api/v1/scans/guest \
  -d '{"input_type":"TEXT","input_value":"السلام عليكم","language":"ar"}'
```

## ملاحظة تشغيل محلي

يحتاج تشغيل FastAPI محلياً إلى قيم Supabase في `.env`. إذا ظهرت:

```text
supabase_url is required
```

فهذا يعني أن `.env` غير مكتمل، وليس خطأ في مسار الفحص. يجب ضبط `SUPABASE_URL` و`SUPABASE_SECRET_KEY` قبل تشغيل Uvicorn.
