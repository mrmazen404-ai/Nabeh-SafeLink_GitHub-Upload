# 🛡️ نظام نباهة (Nabeh SafeLink) — دليل التشغيل الشامل والخصوصية

مشروع **نباهة (Nabeh SafeLink)** هو نظام ذكي متكامل لكشف واكتشاف روابط ورسائل التصيد والاحتيال الإلكتروني (Phishing & Fraud Detection System)، يعتمد على دمج نماذج الذكاء الاصطناعي (Gemini AI)، التعلم الآلي (Machine Learning Predictor)، وقواعد بيانات التهديدات العالمية (VirusTotal API).

---

## 📋 1. المتطلبات الأساسية (Prerequisites)

- **Python:** إصدار `3.11` أو أحدث.
- **Node.js:** إصدار `20.19.0` أو أحدث مع **npm**.
- **Supabase:** مشروع قاعدة بيانات مجهّز ومربوط.
- **الخدمات الإضافية (اختيارية حسب البيئة):**
  - **Gemini API Key:** لتحليل سياق الرسائل والنصوص العربية.
  - **VirusTotal API Key:** للمطابقة مع القوائم السوداء العالمية.
  - **Upstash Redis:** لإدارة معدل الطلبات وحفظ الجلسات.
  - **EmailJS:** لرسائل التحقق واستعادة الحساب.

---

## 🗄️ 2. إعداد قاعدة البيانات (Supabase Setup)

يتم إعداد المخطط على قاعدة بيانات Supabase من خلال تشغيل النصوص البرمجية التالية بالترتيب في **Supabase SQL Editor**:

1. **تطبيق المخطط الأساسي (مرة واحدة):**
   ```text
   backend/sql/nabeh_complete_database_study_schema.sql
   ```
2. **تطبيق مخطط حماية وبيانات الخصوصية:**
   ```text
   backend/sql/user_privacy_data_schema.sql
   ```

> ⚠️ **ملاحظة هامة:** يجب عدم تشغيل ملف الخصوصية قبل المخطط الأساسي كونه يعتمد على جداول وأعمدة مسبقة. يُنصح بمراجعة النصوص القانونية والسياسات مع الجهة المختصة قبل بيئة الإنتاج.

---

## ⚙️ 3. تهيئة بيئة العمل والمتغيرات (`.env`)

قم بنسخ ملف الإعدادات المرجعي `.env.example` وإنشاء ملف `.env` في المجلد الرئيسي:

- **Windows (PowerShell):**
  ```powershell
  copy .env.example .env
  ```
- **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

قم بتعبئة القيم المطلوبة في ملف `.env` مثل:
- `SUPABASE_URL` و `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEY` و `VIRUSTOTAL_API_KEY`
- `ADMIN_JWT_SECRET` و `AUTH_JWT_SECRET`

---

## 🐍 4. تشغيل الخادم الخلفي (Backend - Python FastAPI)

### أ. إنشاء البيئة الافتراضية وتثبيت المكتبات:
```bash
# إنشاء البيئة الافتراضية
python -m venv .venv

# تفعيل البيئة (Linux / macOS):
source .venv/bin/activate

# تفعيل البيئة (Windows PowerShell):
.\.venv\Scripts\Activate.ps1

# تفعيل البيئة (Windows CMD):
.\.venv\Scripts\activate.bat

# تثبيت الحزم والمكتبات
pip install -r requirements.txt
```

### ب. إنشاء حساب المدير الأساسي (Bootstrap Admin) [عند أول تشغيل]:
```bash
python bootstrap_admin.py
```

### ج. تشغيل الخادم في بيئة التطوير (Development):
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### د. فحوصات الصحة والجاهزية (Health & Readiness Checks):
- **فحص الصحة (Liveness):** `GET http://localhost:8000/health`
- **فحص الجاهزية (Readiness):** `GET http://localhost:8000/ready`
- **توثيق الـ API التفاعلي (Swagger OpenAPI):** `http://localhost:8000/docs`

---

## 💻 5. تشغيل الواجهة الأمامية (Frontend - React / Vite)

### أ. بيئة التطوير (Development):
```bash
cd frontend
npm ci
npm run dev
```
*سيتم تشغيل خادم الواجهة الأمامية على الرابط المحلي (مثلاً `http://localhost:5173`).*

### ب. البناء للإنتاج والدمج مع الباك إند (Production Build):
```bash
# بناء ملفات الواجهة من المجلد الرئيسي
npm run build

# أو من داخل مجلد frontend
cd frontend
npm run build
```
*عند بناء الواجهة يتم إنشاء المجلد `frontend/dist`؛ وعند تشغيل خادم FastAPI يقوم الخادم باستضافة الموقع بالكامل مدمجاً على المنفذ `8000`.*

---

## 🌟 6. الوظائف والميزات الرئيسية للنظام

- **فحص الروابط والنصوص (Multi-Engine Scanning):** فحص ثلاثي الأبعاد يعتمد على ML + Gemini AI + VirusTotal + Heuristics.
- **إدارة الخصوصية وحقوق المستخدم:**
  - **الوثائق والسياسات العامة:** الشروط والأحكام `/terms`، سياسة الخصوصية `/privacy`، وإخلاء المسؤولية `/disclaimer`.
  - **إدارة بيانات الحساب:** إعدادات الخصوصية `/settings/privacy`.
  - **تصدير البيانات الشخصية:** `GET /api/v1/dashboard/privacy/export`.
  - **إخفاء الفحوصات (Soft Hide):** `POST /api/v1/scans/{scan_id}/hide`.
  - **حذف الفحص (Soft Delete):** `DELETE /api/v1/scans/{scan_id}` لمسح بيانات الفحص المقنّعة.
  - **حذف الحساب الدائم:** عبر `DELETE /api/v1/dashboard/account` بتأكيد كلمة المرور وتوثيق عبارة `DELETE MY ACCOUNT`.
- **لوحة التحكم الإدارية (Admin System):** إدارة وضع الصيانة، إحصائيات الاستخدام، ومتابعة محددات الزوار (Rate Limits).

---

## 🧪 7. الاختبارات والتحقق (Testing & QA)

لتشغيل فحص سلامة الأكواد والاختبارات الآلية:

```bash
# فحص وتجميع كود Python
python -m compileall -q backend main.py

# تشغيل اختبارات الوحدات باستخدام pytest
pytest -q

# فحص بناء الواجهة الأمامية
cd frontend && npm run build
```

> ℹ️ **ملاحظة:** تتطلب اختبارات التكامل الحية والتواصل مع Supabase بيئة تجريبية (Staging) ومفاتيح بيئة مكتملة في ملف `.env`.
