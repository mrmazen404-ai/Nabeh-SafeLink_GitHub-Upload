"""Legal Policy Documents API router with Supabase persistence and embedded fallbacks."""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

PolicyType = Literal["TERMS", "PRIVACY", "DISCLAIMER"]

DEFAULT_POLICIES = {
    "TERMS": {
        "ar": {
            "title": "شروط الاستخدام",
            "version": "1.0",
            "content_markdown": """## شروط استخدام Nabeh SafeLink

تقدم Nabeh SafeLink خدمة مساعدة لتحليل الروابط والرسائل والمؤشرات المرتبطة بالاحتيال. النتائج احتمالية وليست ضمانًا أمنيًا أو قرارًا قانونيًا أو ماليًا.

يلتزم المستخدم باستخدام الخدمة لأغراض مشروعة، وعدم إرسال كلمات المرور أو مفاتيح الوصول أو بيانات البطاقات أو أي أسرار. لا يجوز محاولة تعطيل الخدمة أو تجاوز حدود الاستخدام أو استخدام النتائج لإيذاء الآخرين.

يستطيع المستخدم إدارة فحوصاته وطلب إخفائها أو حذف بيانات حسابه وفق سياسة الخصوصية والاحتفاظ. قد تعتمد الخدمة على مزودين خارجيين للتحليل عند تفعيلهم، ولا ينبغي إرسال معلومات لا يملك المستخدم حق مشاركتها.

تحتفظ Nabeh بحق تحديث هذه الشروط مع نشر رقم إصدار جديد. استمرار الاستخدام بعد نشر التحديث يعني قبول النسخة الجديدة عندما يطلب النظام ذلك.""",
        },
        "en": {
            "title": "Terms of Use",
            "version": "1.0",
            "content_markdown": """## Nabeh SafeLink Terms of Use

Nabeh SafeLink provides an assistance service for analyzing links, messages, and fraud-related signals. Results are probabilistic and are not a security guarantee or legal, financial, or professional advice.

Use the service lawfully. Do not submit passwords, access keys, payment-card data, or other secrets. Do not disrupt the service, bypass limits, or use results to harm others.

You can manage scans and request hiding or deletion of account data under the privacy and retention policy. Third-party analysis providers may be used when enabled; do not submit information you are not authorized to share.

We may publish updated versions of these terms. The system will request consent when a material update requires it.""",
        },
    },
    "PRIVACY": {
        "ar": {
            "title": "سياسة الخصوصية",
            "version": "1.0",
            "content_markdown": """## سياسة الخصوصية

نجمع بيانات الحساب اللازمة للتسجيل وتقديم الخدمة، مثل البريد والاسم، ونسجل الفحوصات المحفوظة للحساب عند اختيار المستخدم ذلك. تُحفظ مدخلات الفحص بصيغة مقنّعة قدر الإمكان، ولا ينبغي للمستخدم إدخال أسرار أو بيانات شخصية غير لازمة.

قد تُرسل قيمة الفحص إلى خدمات تحليل خارجية مفعّلة مثل VirusTotal أو Gemini حسب إعدادات الخدمة. يستخدم النظام نتائج التحليل لتحسين القرار وشرح التصنيف، مع تقليل البيانات الحساسة في السجلات.

يستطيع المستخدم الاطلاع على موافقاته، إخفاء الفحص من السجل، طلب حذف الفحص، تصدير بياناته، وطلب حذف الحساب. عند الحذف قد نحتفظ بسجل تدقيق منزوع الهوية إذا كان الاحتفاظ مطلوبًا لأمن الخدمة أو الالتزامات النظامية.

لا نبيع بيانات المستخدمين. نستخدم ضوابط وصول وسجلات تدقيق، لكن لا توجد وسيلة تقنية تضمن أمانًا مطلقًا. للاستفسارات استخدم صفحة التواصل.""",
        },
        "en": {
            "title": "Privacy Policy",
            "version": "1.0",
            "content_markdown": """## Privacy Policy

We collect account data needed to provide the service, such as email and display name, and retain authenticated scans when the user chooses to save them. Scan inputs should never contain secrets or unnecessary personal data.

When enabled, scan values may be sent to external analysis providers such as VirusTotal or Gemini. Results are used to produce a classification and explanation, while sensitive data is minimized in logs.

Users can review consents, hide or delete scans, export account data, and request account deletion. A de-identified audit record may be retained when needed for service security or legal obligations.

We do not sell user data. Access controls and audit logging are used, but no technical system can guarantee absolute security. Contact us through the support page for questions.""",
        },
    },
    "DISCLAIMER": {
        "ar": {
            "title": "إخلاء المسؤولية",
            "version": "1.0",
            "content_markdown": """## إخلاء المسؤولية

SafeLink أداة مساعدة لاتخاذ الحذر وليست بديلًا عن برامج الحماية أو مراجعة الجهة الرسمية أو المختص. قد تكون النتيجة غير دقيقة بسبب تغير المواقع أو نقص البيانات أو أخطاء النماذج والخدمات الخارجية.

لا تفتح رابطًا لمجرد أنه صُنّف آمنًا، ولا تدخل بيانات حساسة قبل التحقق من الجهة عبر قناة مستقلة. لا تتحمل الخدمة مسؤولية الخسائر الناتجة عن الاعتماد المنفرد على نتيجة الفحص.""",
        },
        "en": {
            "title": "Disclaimer",
            "version": "1.0",
            "content_markdown": """## Disclaimer

SafeLink is an assistance tool for cautious decision-making, not a replacement for security controls, official verification, or professional advice. Results may be inaccurate because websites change and models or external providers can fail.

Do not open a link solely because it was classified as safe, and verify the organization independently before entering sensitive data. The service is not liable for losses caused by relying on a scan result alone.""",
        },
    },
}


def _get_policy(policy_type: str, language: str) -> dict:
    try:
        result = (
            supabase.table("policy_documents")
            .select("id,policy_type,language,version,title,content_markdown,content_hash,published_at")
            .eq("policy_type", policy_type)
            .eq("language", language)
            .eq("is_active", True)
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception as error:
        logger.warning("policy_documents_db_query_fallback policy_type=%s lang=%s error=%s", policy_type, language, type(error).__name__)

    lang_key = "ar" if language == "ar" else "en"
    default_doc = DEFAULT_POLICIES.get(policy_type, {}).get(lang_key)
    if default_doc:
        return {
            "id": f"default-{policy_type.lower()}-{lang_key}",
            "policy_type": policy_type,
            "language": lang_key,
            "version": default_doc["version"],
            "title": default_doc["title"],
            "content_markdown": default_doc["content_markdown"],
            "published_at": None,
        }

    raise HTTPException(status_code=404, detail="الوثيقة القانونية غير متاحة")


@router.get("/{policy_type}")
async def get_policy(
    policy_type: PolicyType,
    language: str = Query("ar", pattern="^(ar|en)$"),
):
    return {"success": True, "data": _get_policy(policy_type, language)}


@router.get("")
async def get_active_policies(language: str = Query("ar", pattern="^(ar|en)$")):
    lang_key = "ar" if language == "ar" else "en"
    try:
        result = (
            supabase.table("policy_documents")
            .select("id,policy_type,language,version,title,content_markdown,content_hash,published_at")
            .eq("language", lang_key)
            .eq("is_active", True)
            .order("policy_type")
            .execute()
        )
        if result.data:
            return {"success": True, "data": result.data}
    except Exception:
        pass

    fallback_docs = [
        _get_policy("TERMS", lang_key),
        _get_policy("PRIVACY", lang_key),
        _get_policy("DISCLAIMER", lang_key),
    ]
    return {"success": True, "data": fallback_docs}
