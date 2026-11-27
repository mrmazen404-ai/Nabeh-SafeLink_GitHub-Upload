# Nabeh SafeLink — خط الأساس المعماري

**تاريخ القراءة:** 2026-11-16
**Commit المقروء:** `63680be`
**نطاق هذه الوثيقة:** توثيق فقط؛ لا تغيّر هذه المرحلة قرار الفحص أو شكل الاستجابة العامة.

## الوضع الحالي المثبت من الكود

مسار الضيف في `backend/app/scans/routes.py` يستقبل `input_type` بقيمتي `URL` أو `TEXT`، ويتحقق من المدخل ثم يستدعي `ScanService.process_guest_scan`. المسار يعيد الغلاف العام `{success: true, data: result}`. المسار authenticated يستخدم الخدمة نفسها ثم يحفظ النتيجة بحسب تدفق الحساب.

مسار URL في `backend/app/scans/service.py` يطبع الرابط، ثم يشغّل ML وVirusTotal بالتوازي، وبعد ذلك يطبّق `combine_scan_results`. Gemini أو التحليل المحلي ينتج شرحًا منفصلًا، ثم تُبنى `evidence_card` عبر `_build_url_evidence_card`.

مسار TEXT يستخرج الروابط الصريحة والروابط المموهة القابلة للتطبيع، ويشغّل تحليل ML وVirusTotal لكل رابط بحدود تزامن، ثم يختار أقوى نتيجة. بعد ذلك يجري تحليل Gemini أو fallback محلي، ويبني `sms_evidence_card`.

## شكل النتيجة العامة الحالية

الحقول الأساسية الموجودة في نتيجة URL تشمل:

- `classification`
- `confidence`، مع كون القيم الاحتمالية غير المعايرة محمية أو فارغة
- `source`
- `stages.stage1_ml`
- `stages.stage2_virustotal`
- `stages.stage3_gemini`
- `explanation`
- `virustotal`
- `ml_model`
- `evidence_card`

نتيجة TEXT تضيف:

- `analysis_coverage`
- `coverage_reasons`
- `extracted_urls`
- `unscanned_urls`
- `unscanned_url_candidates`
- `embedded_url_analyses`
- `ml_models`
- `virustotal_results`
- `sms evidence_card`

## موضع الخلط الحالي

`evidence_card.decision` يحتوي مدخلات من ML وVirusTotal وسياسة الدمج في جسم واحد. كما أن `evidence_card.sources` يحتوي مصدر ML ومصدر VirusTotal، لكنه لا يقدّم عقدًا عامًا مستقلًا لكل مصدر يمكن للواجهة الاعتماد عليه دون تفسير الحقول القديمة.

في `sources.ml_model.feature_attribution` القيمة الحالية الصريحة هي `NOT_AVAILABLE`. لذلك لا يجوز تفسير `url_observations` على أنها أسباب LightGBM؛ فهي خصائص مقاسة للرابط فقط.

حقل `source` في النتيجة العامة يعبّر أحيانًا عن مصدر القرار أو طريقة الدمج، وليس عن مزود واحد دائمًا. لذلك لا يصلح وحده لإثبات أن VirusTotal أو ML اتخذ القرار النهائي.

## حالات UNKNOWN الحالية المثبتة

سياسة الدمج في `service.py` تعيد `UNKNOWN` مع `decision_code = INSUFFICIENT_EVIDENCE` عندما لا توجد أدلة كافية. وتوجد حالات مزود صريحة مثل:

- ML: `ML_ERROR`, `INVALID_URL`, أو `UNKNOWN`
- VirusTotal: `TIMEOUT`, `NETWORK_ERROR`, `SUBMISSION_DISABLED`, `PRIVACY_BLOCKED`, أو `ANALYSIS_STALE`
- Gemini: `DISABLED`, `GEMINI_TIMEOUT`, `GEMINI_PROVIDER_ERROR`, أو fallback محلي

هذه الحالات مختلفة دلاليًا، لكن الاستجابة العامة الحالية لا تعرض دائمًا قائمة موحّدة من `reason_codes` للمستخدم.

## ما لا يثبته الكود الحالي

الكود الحالي لا يثبت أن كل خاصية مقاسة أثرت فعليًا في LightGBM. كما أن `feature_attribution` غير متاح في بطاقة الأدلة الحالية. كذلك لا يثبت غياب بلاغ VirusTotal أن الرابط آمن؛ `undetected` يعني عدم وجود حكم من ذلك المحرك، وليس حكمًا بالسلامة.

## حدود التغيير في المرحلة A/B

لا تغيّر هذه المرحلة:

- سياسة `combine_scan_results`.
- تصنيفات SAFE أو SUSPICIOUS أو DANGEROUS أو UNKNOWN.
- استجابة API العامة.
- واجهة المستخدم.
- استدعاءات ML أو VirusTotal أو Gemini.
- قاعدة البيانات أو النشر.

تضيف المرحلة B عقدًا داخليًا إسقاطيًا يمكن اختباره على النتائج الحالية. العقد لا يدّعي Attribution غير موجود، ويضع `available=false` عندما لا يقدّم المصدر دليلًا يمكن إثباته.

## معيار الانتقال إلى المرحلة C

لا ينتقل العمل إلى فصل VirusTotal في الاستجابة العامة قبل مراجعة هذا الخط الأساسي والتأكد من أن عقد المرحلة B يغطي حقول المصدر الحالية دون فقدان أو إعادة تسمية مضللة.
