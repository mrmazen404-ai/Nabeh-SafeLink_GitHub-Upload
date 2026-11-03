# تقرير التحقق الإنتاجي — Nabeh SafeLink

## نطاق التعديل

تم تنفيذ إصلاحات تشغيلية حقيقية دون إضافة مفاتيح أو نتائج وهمية:

- حالة `health` تصبح `degraded` عندما يكون Gemini مهيأً لكن آخر استدعاء فشل أو تعرض لـ429.
- `/ready` يبقى قابلًا للاستخدام عند عمل ML وVirusTotal مع توضيح أن Gemini متدهور، لأن fallback المحلي مفعل.
- أضيفت `provider_status` و`evidence_timestamp` إلى نتائج VirusTotal الناتجة من الاستدعاء الفعلي.
- صُنفت أخطاء VirusTotal إلى `AUTH_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK_ERROR`, `PROVIDER_ERROR`, `ANALYSIS_PENDING` وغيرها.
- لا تتحول أخطاء المزود إلى `SAFE`؛ النتيجة عند نقص الدليل هي `UNKNOWN`.
- أضيف حد تزامن لـGemini ومتغيرات retry/backoff قابلة للتهيئة.
- تم وسم fallback المحلي صراحةً بـ`provider_status=DEGRADED` و`classification_source=LOCAL_RULES`.
- أضيفت اختبارات readiness وحالات 401 و429 في VirusTotal.
- أضيف `pytest` و`pytest-asyncio` إلى مجموعة التطوير في `pyproject.toml`.
- تم تحديث `follow-redirects` عبر npm override، ونتج عن `npm audit` صفر ثغرات في لوحة الإدارة وقت التحقق.

## نتائج الاختبارات المحلية

آخر تشغيل:

```text
196 passed, 4 warnings in 2.56s
```

التحذيرات صادرة من اعتمادات خارجية ولا تمثل فشلًا في اختبارات المشروع. يجب تحديثها دوريًا، لكن لا يجوز إخفاؤها بادعاء عدم وجود تحذيرات.

الأوامر المستخدمة:

```bash
uv lock
uv sync --frozen --group dev
uv run pytest -q
python3 -m compileall -q backend main.py
npm install --package-lock-only --ignore-scripts --prefix admin_frontend
npm audit --prefix admin_frontend
```

## ما لا يمكن إثباته محليًا دون أسرار حقيقية

لا يحتوي المستودع على مفاتيح تشغيل حقيقية، وهذا مقصود. لذلك لم يتم الادعاء بأن التكامل الحي مع Gemini أو VirusTotal ناجح بعد هذا التعديل. يلزم تشغيل الاختبارات التالية في staging بعد حقن أسرار حقيقية:

```bash
NABEH_ENVIRONMENT=staging \
NABEH_TRUST_MODEL_ARTIFACT=1 \
GEMINI_API_KEY='real-staging-key' \
GEMINI_MODEL='model-listed-by-your-google-project' \
VIRUSTOTAL_API_KEY='real-staging-key' \
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

ثم:

```bash
curl -fsS http://127.0.0.1:8000/health | jq
curl -i -fsS http://127.0.0.1:8000/ready | jq
```

يجب أن تظهر:

- `ml_model.status=ready` مع artifact حقيقي.
- `virustotal.status=configured` ثم نتيجة حقيقية عند تنفيذ scan.
- `gemini.last_call.status=ready` بعد طلب شرح ناجح.
- لا يجوز اعتبار `configured` وحده دليلًا على نجاح Gemini أو VirusTotal.

إذا ظهر `429` من Gemini، فالخلل في quota أو حدود المشروع أو الفوترة أو اسم النموذج المتاح، وليس شيئًا يمكن إصلاحه بوضع قيمة ثابتة في الكود. في هذه الحالة يجب أن يظهر النظام `degraded` ويستخدم fallback الموثق.

## معايير عدم التزوير

- لا توجد counters ثابتة لـVirusTotal داخل الكود.
- لا توجد إجابة Gemini ثابتة تدعي نجاح المزود.
- لا يتم تحويل timeout أو 401 أو 429 إلى `SAFE`.
- لا تُعرض ثقة ML للمستخدم العام باعتبارها معايرة ما لم يثبت ذلك بتقرير مستقل.
- اختبارات mocks موسومة ضمنيًا بأنها اختبارات وحدات، ولا تمثل نجاح مزود خارجي.

## ملفات الدليل

- `backend/app/main.py`: health/readiness وحالة degraded.
- `backend/app/virustotal/client.py`: حالات المزود ونتائج الدليل.
- `backend/app/gemini/client.py`: retry وsemaphore وتصنيف 429.
- `backend/app/scans/service.py`: fallback ومصدر التصنيف.
- `backend/tests/test_provider_readiness.py`: اختبارات الإصلاحات الجديدة.
