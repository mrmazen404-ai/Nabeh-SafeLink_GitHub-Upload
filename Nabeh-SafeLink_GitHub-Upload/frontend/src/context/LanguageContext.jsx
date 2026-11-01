import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRuntimeConfig } from './RuntimeConfigContext';
import api from '../services/api';

const LanguageContext = createContext();

export const translations = {
  ar: {
    // Header & Navigation
    nav: {
      home: 'الرئيسية',
      scan: 'الفحص',
      history: 'السجل',
      stats: 'الإحصائيات',
      help: 'المساعدة والدعم',
      faq: 'الأسئلة الشائعة',
      guide: 'دليل الاستخدام',
      contact: 'تواصل معنا',
      about: 'عن نبيه',
      protectionActive: 'الحماية نشطة',
      goHome: 'الانتقال للرئيسية - نبيه SafeLink',
      languageSelect: 'اختيار اللغة',
      changeLanguage: 'تغيير اللغة',
      arabic: 'العربية',
      english: 'English',
      breadcrumbHome: 'الرئيسية',
      breadcrumbHelp: 'المساعدة والدعم',
      profile: 'الملف الشخصي',
      profileAria: 'فتح الملف الشخصي',
    },

    // Home Page
    home: {
      heroTag: 'NABEH SECURITY DASHBOARD',
      heroTitle: 'نظام الكشف والوقاية الذكي من التهديدات',
      heroDesc: 'تحليل وفحص الروابط والرسائل بدقة متناهية عبر الذكاء الاصطناعي التوليدي ومحركات الأمان العالمية لضمان سلامة جهازك وبياناتك.',
      startScanBtn: 'بدء فحص رابط الآن',
      statsSafe: 'روابط آمنة',
      statsSafeSub: 'روابط موثوقة',
      statsSuspicious: 'روابط مشبوهة',
      statsSuspiciousSub: 'بحاجة للحذر',
      statsDangerous: 'تهديدات خطيرة',
      statsDangerousSub: 'محاولات احتيال',
      recentTitle: 'آخر الفحوصات المنجزة',
      recentSub: 'سجل أحدث العمليات المعالجة عبر المحرك',
      viewFullHistory: 'عرض السجل الكامل ←',
      rescan: 'إعادة فحص ←',
      rescanLabel: 'إعادة فحص {url}',
      safeStatus: 'آمن',
      dangerousStatus: 'خطر',
      suspiciousStatus: 'مشبوه',
      recentFallback: 'مؤخراً',
      scannedUrl: 'رابط مفحوص',
    },

    // Scanner Page
    scanner: {
      pageTitle: 'فحص وكشف التهديدات السيبرانية',
      tabUrl: 'فحص رابط (URL)',
      tabText: 'فحص نص / رسالة (SMS)',
      subUrl: 'ضع الرابط المطلوب تحليله للكشف عن محاولات التصيد والروابط الخبيثة باستخدام الذكاء الاصطناعي',
      subText: 'أدخل نص الرسالة المشبوهة أو البريد الإلكتروني للتحقق من مؤشرات الاحتيال والانتحال',
      placeholderUrl: 'ضع الرابط هنا... e.g. https://example.com',
      placeholderText: 'ضع نص الرسالة هنا...',
      inputLabelUrl: 'رابط الفحص',
      inputLabelText: 'نص الرسالة المفحوصة',
      clear: 'مسح',
      paste: 'لصق',
      startBtn: 'بدء الفحص الآمن',
      scanningBtn: 'جاري الفحص...',
      errEmptyInput: 'الرجاء إدخال رابط أو نص صحيح للتحقق منه',
      errScanFailed: 'حدث خطأ أثناء الفحص، حاول مرة أخرى',
      errServerConnection: 'تعذر الوصول إلى خدمة الفحص حاليًا. تحقق من اتصالك وحاول مرة أخرى.',
      errPaste: 'تعذر القراءة من المحافظة تلقائياً',
      recentScansTitle: 'آخر الفحوصات',
      recentCount: '{count} فحوصات',
      rescanTooltip: 'انقر لإعادة الفحص المباشر',
      rescanAria: 'إعادة فحص {url} - الحالة {status}',
      guestTitle: 'فحص كضيف:', guestDesc: 'يمكنك فحص رابط أو رسالة دون حساب. لا تحفظ Nabeh النتيجة في قاعدة بياناتها، لكن قد يُرسل الإدخال إلى VirusTotal أو Gemini للتحليل؛ لا تفحص بيانات سرية.', guestPrivacy: 'النتيجة مؤقتة ولا تُحفظ في سجل Nabeh. قد تُستخدم خدمات تحليل خارجية عند تفعيلها.', noRecentScans: 'لا توجد فحوصات محفوظة بعد.', savedScan: 'فحص محفوظ', workspace: 'مركز نابح للحماية الذكية', liveProtection: 'حماية نشطة ومراقبة فورية', capabilities: 'مزايا الفحص', aiAnalysis: 'تحليل بالذكاء الاصطناعي', multiSource: 'فحص متعدد المصادر', privacyFirst: 'الخصوصية أولاً',
    },

    // History Page
    history: {
      title: 'سجل الفحوصات (Scan History)',
      subtitle: 'استعراض وحفظ كافة العمليات والروابط التي تم فحصها مع إمكانية الفلترة والبحث السريع.',
      searchPlaceholder: 'بحث في السجل عبر اسم الرابط...',
      filterAll: 'الكل',
      filterSafe: 'آمن',
      filterSuspicious: 'مشبوه',
      filterDangerous: 'خطر',
      emptyState: 'لا توجد فحوصات تطابق الفلتر المختار',
      confidence: 'ثقة {pct}%',
      rescanBtn: 'إعادة فحص ←',
    },

    // Statistics Page
    stats: {
      title: 'الإحصائيات والتحليلات (My Statistics)',
      subtitle: 'تحليل نوعي وشامل لكافة التهديدات والفحوصات المنجزة عبر النظام.',
      totalLabel: 'إجمالي الفحوصات المنفذة',
      distributionTitle: 'توزيع نتائج الفحص',
      safeLabel: 'روابط آمنة (Safe)',
      suspiciousLabel: 'روابط مشبوهة (Suspicious)',
      dangerousLabel: 'روابط احتيالية/خطر (Dangerous)',
      fraudTypesTitle: 'أنواع التهديدات المرصودة (Fraud Types)',
      phishingType: 'انتحال الحسابات (Credential Phishing)',
      shortenerType: 'روابط الاختصار المشبوهة (Shortener Abuse)',
      malwareType: 'برمجيات التتبع والتصيد (Malware Links)',
    },

    // Result Screen
    result: {
      safeLabelAr: 'آمن وخالٍ من التهديدات',
      safeLabelEn: 'SAFE URL',
      safeTitle: 'الرابط آمن وموثوق',
      safeDesc: 'لم يتم اكتشاف أي برمجيات خبيثة أو محاولات انتحال. يمكنك المتابعة والتصفح بأمان.',

      suspiciousLabelAr: 'مشبوه بحاجة للحذر',
      suspiciousLabelEn: 'SUSPICIOUS',
      suspiciousTitle: 'تحذير: الرابط مشبوه',
      suspiciousDesc: 'تم رصد مؤشرات خطر محتملة. توخَّ الحذر وتجنب إدخال أي كلمات مرور أو معلومات بنكية.',

      dangerousLabelAr: 'خطر - تهديد إلكتروني',
      dangerousLabelEn: 'DANGEROUS',
      dangerousTitle: 'خطر! رابط احتيالي أو خبيث',
      dangerousDesc: 'تحذير شديد! يحتوي الرابط على تهديدات أمنية أو محاولة تصيد. يُنصح بعدم النقر إطلاقاً.',

      unknownLabelAr: 'تصنيف غير محدد',
      unknownLabelEn: 'UNKNOWN',
      unknownTitle: 'تعذر تحديد التصنيف',
      unknownDesc: 'لم تتمكن المحركات من تصنيف الرابط بجزم. كن حذراً دائماً عند فتح روابط مجهولة.',

      sourceLabel: 'المصدر: {source}',
      hybridSource: 'ذكاء هجين',
      inspectedUrlLabel: 'الرابط المفحوص:',
      confidenceLabel: 'درجة الثقة والموثوقية',
      aiAnalysisTitle: 'التحليل والتفسير الذكي',
      aiModelTag: 'Google Gemini AI',
      recommendationTitle: 'توصية نابه الأمنية:',
      vtEnginesTitle: 'فحص المحركات العالمية (VirusTotal v3)',
      vtDangerous: 'خطر',
      vtSuspicious: 'مشبوه',
      vtSafe: 'سليم',
      vtTotal: 'الإجمالي',
      mlModelTitle: 'تحليل نموذج التعلم الآلي (ML Model)',
      mlLocalPrediction: 'التنبؤ المحلي: ',
      mlSafeBadge: 'آمن (Safe)',
      mlDangerousBadge: 'احتيالي (Phishing)',
      mlSuspiciousBadge: 'مشبوه',
      mlRiskProb: '{prob}% خطر',
      scanNewBtn: 'فحص رابط جديد',
      copyReportBtn: 'نسخ التقرير المفصل',
      copiedReportBtn: 'تم نسخ التقرير',
      defaultRec: 'توخَّ الحذر دائماً', pageLabel: 'نتائج الفحص الرئيسية',
    },

    // Error Pages (#47)
    error: {
      notFoundTitle: 'لم نعثر على هذه الصفحة',
      notFoundDesc: 'قد يكون الرابط غير صحيح أو أن الصفحة لم تعد متاحة.',
      internalTitle: 'تعذر إكمال الطلب الآن',
      internalDesc: 'حدث خطأ غير متوقع. لم نتمكن من إكمال هذه الخطوة.',
      refCodeLabel: 'رقم مرجع الخطأ:',
      goHomeBtn: 'العودة إلى الرئيسية',
      goBackBtn: 'الرجوع للخلف',
      retryBtn: 'إعادة المحاولة',
      helpBtn: 'مركز المساعدة',
      reportIssueBtn: 'الإبلاغ عن المشكلة',
      copyRefBtn: 'نسخ الرقم المرجعي',
      copiedRefBtn: 'تم النسخ!',
    },

    // Maintenance Page (#48)
    maintenance: {
      title: 'نبيه متوقف مؤقتاً للصيانة',
      desc: 'نعمل على إجراء تحسينات وأعمال صيانة دورية للحفاظ على أعلى مستويات الحماية والخدمة. سنعود للعمل قريباً.',
      statusBadge: 'وضع الصيانة المخططة نشط',
      checkAgainBtn: 'التحقق مجدداً',
      checkingStatus: 'جاري التحقق من حالة الخدمة...',
      helpBtn: 'دليل الاستخدام والأسئلة',
    },

    // Process Confirmation (#50)
    confirmation: {
      processCompleteTitle: 'اكتمل تنفيذ العملية بنجاح',
      processCompleteDesc: 'تم معالجة الطلب وتأكيد الاستجابة من الخادم.',
      scanAnalysisComplete: 'اكتمل التحليل الفني للرابط',
      scanNotice: 'تنبيه: اكتمال التحليل يعبر عن نجاح عملية الفحص فقط، ولا يعني بالضرورة أن الرابط آمن. طالع تصنيف التهديد والتقرير المرفق.',
      continueBtn: 'متابعة',
      viewResultBtn: 'عرض التقرير التفصيلي',
      backToHomeBtn: 'العودة للرئيسية',
      copyRefId: 'نسخ رقم المرجع',
    },

    // Loading & Splash (#49)
    loading: {
      title: 'جاري الفحص الدقيق',
      urlLabel: 'الرابط:',
      hint: 'يتم الفحص عبر الذكاء الاصطناعي ومحركات الأمان العالمية',
      cancelBtn: 'إلغاء الفحص',
      messages: [
        'جاري تحليل الرابط والتحقق الهيكلي...',
        'فحص قواعد البيانات العالمية للتهديدات...',
        'التحقق عبر نموذجات التعلم الآلي والذكاء الاصطناعي...',
        'تحليل مؤشرات الاحتيال والانتحال...',
        'إعداد التقرير التفسيري الشامل...',
      ]
    },
    splash: {
      tagline: 'افحص • اكتشف • ابقَ آمناً',
      footer: 'البنية الأمنية الرقمية لـ Nabeh SafeLink — الإصدار المؤسسي المعتمد',
      status: 'جاري تهيئة الحماية...',
      statusPreparing: 'جاري تهيئة بيئة النواة وتشفير الاتصال...',
      statusChecking: 'جاري التحقق الرقمي من جلسة التوثيق والشبكة...',
      statusReady: 'اكتمل التحقق أمنياً، مرحباً بك في نبيه SafeLink',
      statusOffline: 'تعذر الاتصال بالشبكة. تحقق من اتصالك بالإنترنت...'
    },

    // FAQ Page (#32)
    faq: {
      title: 'الأسئلة الشائعة (FAQ)',
      subtitle: 'إجابات مختصرة وموثوقة عن الفحص والنتائج واستخدام نظام نبيه.',
      searchPlaceholder: 'ابحث في الأسئلة الشائعة...',
      clearSearch: 'مسح البحث',
      categoryAll: 'الكل',
      categoryGeneral: 'عام',
      categoryUrlScan: 'فحص الروابط',
      categoryMsgScan: 'فحص الرسائل',
      categoryResults: 'النتائج والثقة',
      categoryPrivacy: 'الحساب والخصوصية',
      noResultsTitle: 'لم نعثر على إجابة تطابق بحثك',
      noResultsSub: 'جرب البحث بكلمات دلالية أخرى أو تواصل مع فريق المساعدة المباشر.',
      contactCtaTitle: 'لم تجد إجابة لاستفسارك؟',
      contactCtaSub: 'فريق الدعم الفني متواجد لمساعدتك والإجابة على أي أسئلة أمنية.',
      contactBtn: 'تواصل معنا الآن',
      viewGuideBtn: 'طالع دليل الاستخدام التفصيلي ←',
    },

    // Contact Us Page (#33)
    contact: {
      title: 'تواصل معنا (Contact Us)',
      subtitle: 'أرسل استفسارك أو بلاغك الأمني وسيتم المعالجة من قبل الفريق المعني.',
      supportCardTitle: 'قناة التواصل والدعم المباشرة',
      supportEmailLabel: 'البريد الرسمي للدعم:',
      supportHoursLabel: 'ساعات العمل: الأحد - الخميس (8:00 ص - 4:00 م)',
      typeLabel: 'نوع الطلب *',
      typeScanIssue: 'مشكلة في الفحص أو النتيجة',
      typeInaccurateResult: 'الإبلاغ عن نتيجة غير دقيقة',
      typeAccountGeneral: 'استفسار عام أو بالاستخدام',
      typeSuggestion: 'اقتراح أو ملاحظة تحسين',
      typeOther: 'أخرى',
      emailLabel: 'البريد الإلكتروني للرد *',
      emailPlaceholder: 'name@example.com',
      subjectLabel: 'عنوان الرسالة *',
      subjectPlaceholder: 'ملخص مختصر لموضوع الطلب...',
      scanIdLabel: 'معرف الفحص (اختياري)',
      scanIdPlaceholder: 'مثال: #scan-10293',
      scanIdHint: 'يساعد في المراجعة والدراسة السريعة عند ارتباط الطلب بفحص سابق',
      detailsLabel: 'تفاصيل الطلب *',
      detailsPlaceholder: 'اشرح الاستفسار أو المشكلة بالتفصيل...',
      privacyNotice: 'تنبيه أمني مهم: لا ترسل كلمة المرور أو رموز التحقق أو بيانات البطاقة البنكية إطلاقاً.',
      sendBtn: 'إرسال الطلب',
      sendingBtn: 'جاري الإرسال...',
      cancelBtn: 'رجوع للرئيسية',
      successTitle: 'تم إرسال طلبك بنجاح!',
      successMsg: 'شكراً لتواصلك معنا. تم تسجيل الطلب بمرجع رقم {ticketId} وسيتم المتابعة قريباً.',
      newRequestBtn: 'إرسال طلب جديد',
      backToFaqBtn: 'العودة للأسئلة الشائعة',
    },

    // About Project Page (#34)
    about: {
      title: 'عن مشروع نبيه (About Project)',
      subtitle: 'منصة سيبرانية ذكية لتصنيف الروابط والرسائل بدقة متناهية لحمايتك قبل النقر.',
      overviewTitle: 'ما هو نبيه SafeLink؟',
      overviewDesc: 'نبيه SafeLink هو نظام أمني متقدم يعمل كخط دفاع رئيسي لتقييم وفحص الروابط والنصوص المشبوهة، من خلال الجمع بين نماذج التعلم الآلي المحلية، الذكاء الاصطناعي التوليدي Google Gemini، وقواعد بيانات التهديدات العالمية VirusTotal v3.',
      howItWorksTitle: 'كيف يعمل نبيه؟',
      step1Title: '1. التحليل الهيكلي المباشر',
      step1Desc: 'فحص الخصائص النحوية للرابط، نطاقات الاختصار، ومؤشرات الانتحال الحسابي.',
      step2Title: '2. المحرك الهجين (ML + VirusTotal)',
      step2Desc: 'التحقق السريع عبر نموذج التعلم الآلي المدرب محلياً واستعلام محركات الأمان العالمية.',
      step3Title: '3. التفسير التوليدي الذكي',
      step3Desc: 'صياغة تقرير تفسيري بأسلوب بشري بسيط ومباشر يوضح مكامن الخطر والتوصية المناسبة.',
      boundariesTitle: 'حدود الخدمة والالتزام والشفافية',
      boundary1: 'يوفر نبيه مؤشرات مساعدة وتوصيات أمنية حذرة ولا يستبدل برامج الحماية الأساسية.',
      boundary2: 'لا يتم فتح الروابط تلقائياً في متصفح المستخدم أو تشغيل البرمجيات عند الفحص.',
      boundary3: 'النتائج تبنى على المعطيات والبيانات المتوفرة وقت الفحص وقد تتأثر بالتغيرات الطارئة.',
      featuresTitle: 'الوظائف والخصائص القائمة في MVP',
      feature1: 'فحص الروابط الإلكترونية URLs وفحص الرسائل النصية SMS',
      feature2: 'تصنيف التهديد (Safe / Suspicious / Dangerous) ودرجة الثقة',
      feature3: 'سجل الفحوصات المحلي والإحصائيات والرسوم البيانية',
      feature4: 'دعم كامل للغتين العربية والإنجليزية والثيم الفاتح/الداكن',
      metaTitle: 'معلومات النسخة والمشروع',
      versionLabel: 'إصدار التطبيق: v1.0.0 (MVP Stable Release)',
      engineLabel: 'محرك التحليل: Nabeh Hybrid Security Engine v1',
      startScanCta: 'ابدأ فحص رابط الآن',
      userGuideCta: 'دليل الاستخدام الشامل',
      faqCta: 'الأسئلة الشائعة',
    },

    // User Guide Page (#35)
    guide: {
      title: 'دليل الاستخدام (User Guide)',
      subtitle: 'خطوات إرشادية مفصلة لاستخدام كافة أدوات نبيه وفهم التقييمات الأمنية.',
      tocTitle: 'فهرس المحتويات',
      section1Title: '1. البدء والمقدمة',
      section1Desc: 'نبيه متوفر للجميع مجاناً ودون الحاجة لتنصيب برمجيات إضافية. يمكنك البدء المباشر بفحص أي رابط أو رسالة غامضة عبر الواجهة الرئيسية.',
      section2Title: '2. طريقة فحص رابط (URL)',
      section2Desc: 'انسخ الرابط المشتبه به من البريد أو المحادثة، افتح تبويب "فحص رابط"، الصق الرابط في الخانة وانقر "بدء الفحص الآمن". ستظهر النتيجة خلال ثوانٍ معدودة.',
      section3Title: '3. طريقة فحص رسالة (SMS / Text)',
      section3Desc: 'انتقل لتبويب "فحص نص/رسالة"، الصق النص المريب كاملاً، وسيتم تحليله للكشف عن كلمات الاحتيال، الادعاءات المالية الزائفة، وروابط التصيد المخفية.',
      section4Title: '4. فهم النتائج ودرجة الثقة',
      section4Desc: 'يصنف النظام النتيجة إلى Safe (آمن)، Suspicious (مشبوه)، أو Dangerous (خطر). تعبر درجة الثقة (Confidence %) عن مدى تطابق المؤشرات مع أنماط الخطر المعروفة.',
      section5Title: '5. سجل الفحوصات والإحصائيات',
      section5Desc: 'يمكنك مراجعة كافة فحوصاتك المنجزة في صفحة "السجل" المتاحة في القائمة، والبحث باسم الرابط أو فلترتها. بينما تقدم "الإحصائيات" تحليلاً بائناً لأنواع التهديدات.',
      section6Title: '6. إرشادات السلوك السيبراني الآمن',
      section6Desc: 'إذا كانت النتيجة "مشبوهة" أو "خطيرة"، تجنب النقر إطلاقاً. لا تدخل بياناتك الشخصية أو البنكية في صفحات غير موثوقة حتى لو بدت رسمية.',
      prevSection: 'القسم السابق',
      nextSection: 'القسم التالي',
      quickScanBtn: 'جرب فحص رابط الآن',
      needMoreHelpTitle: 'هل ما زلت تحتاج مساعدة إضافية؟',
      needMoreHelpSub: 'استكشف الأسئلة الشائعة أو تواصل مع فريق الدعم الفني.',
    },

    // Footer Component
    footer: {
      tagline: 'نظام الكشف والوقاية الذكي من التهديدات السيبرانية',
      rights: 'جميع الحقوق محفوظة © {year} نبيه SafeLink.',
      supportSection: 'المساعدة والدعم',
      quickLinksSection: 'روابط سريعة',
      securityTitle: 'حماية موثوقة',
      securityNotice: 'تنبيه: نبيه أداة إرشادية مساعدة لتقييم مؤشرات الخطر قبل اتخاذ القرار.',
    },
    auth: {
      language: 'English', changeLanguage: 'تغيير اللغة', toggleTheme: 'تبديل الثيم', logout: 'خروج', loginTitle: 'تسجيل الدخول', loginSubtitle: 'سجّل الدخول إلى حسابك', emailOrUsername: 'البريد الإلكتروني أو اسم المستخدم', emailAddress: 'البريد الإلكتروني', password: 'كلمة المرور', newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور', confirmNewPassword: 'تأكيد كلمة المرور الجديدة', rememberMe: 'تذكرني', forgotPassword: 'نسيت كلمة المرور؟', login: 'دخول', register: 'إنشاء حساب', noAccount: 'ليس لديك حساب؟', alreadyAccount: 'لديك حساب بالفعل؟', continueGuest: 'المتابعة كزائر', createAccount: 'إنشاء حساب جديد', registerSubtitle: 'انضم إلينا نحو إنترنت أكثر أماناً', fullName: 'الاسم الكامل', registerAction: 'تسجيل الحساب', verifyEmail: 'تحقق من بريدك الإلكتروني', verifyRecovery: 'تحقق من رمز الاستعادة', codeSent: 'أرسلنا رمزاً مكوناً من 6 أرقام إلى', verifyCode: 'تحقق من الرمز', requestCodeIn: 'يمكن طلب رمز جديد بعد {seconds} ثانية', requestNewCode: 'إعادة إرسال الرمز', resendError: 'تعذر إعادة إرسال الرمز. حاول لاحقًا.', resendRateLimited: 'تم تجاوز حد إعادة الإرسال. حاول لاحقًا.', emailDeliveryError: 'تعذر إرسال رمز التحقق حاليًا. حاول لاحقًا.', backToRecovery: 'العودة لاستعادة كلمة المرور', backToRegister: 'العودة للتسجيل', resetTitle: 'إنشاء كلمة مرور جديدة', resetSubtitle: 'استخدم كلمة مرور قوية من 12 حرفاً على الأقل لحماية حسابك', updatePassword: 'تحديث كلمة المرور', requestRecovery: 'طلب رمز استعادة جديد', resetInvalid: 'جلسة الاستعادة غير صالحة أو منتهية. اطلب رابط استعادة جديداً.', passwordUpdated: 'تم تحديث كلمة المرور', passwordUpdatedDesc: 'تم تغيير كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول...', forgotTitle: 'استعادة كلمة المرور', forgotSubtitle: 'أدخل بريدك وسنرسل لك رابطاً آمناً لإعادة التعيين', sendReset: 'إرسال رابط الاستعادة', checkInbox: 'تحقق من بريدك الوارد', enterRecovery: 'إدخال رمز الاستعادة', backToSignIn: 'العودة لتسجيل الدخول', socialDivider: 'أو المتابعة باستخدام', showPassword: 'إظهار كلمة المرور', hidePassword: 'إخفاء كلمة المرور', requiredFields: 'الرجاء إكمال كافة الحقول الإلزامية', passwordMismatch: 'كلمتا المرور غير متطابقتين', passwordLength: 'يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل', invalidCode: 'رمز التحقق غير صحيح أو منتهي الصلاحية', missingEmail: 'البريد الإلكتروني المطلوب للتحقق غير موجود', resetError: 'تعذر تحديث كلمة المرور. قد تكون جلسة الاستعادة منتهية.', registerError: 'تعذر إنشاء الحساب. تأكد من البيانات أو حاول مجدداً.', registerSuccessDefault: 'إذا كان البريد الإلكتروني صحيحاً، فستصلك تعليمات تأكيد الحساب', registeredEmailFallback: 'بريدك المسجل', socialGoogle: 'المتابعة باستخدام Google', socialApple: 'المتابعة باستخدام Apple', passwordCriteriaTitle: 'متطلبات كلمة المرور الأمنية:', criteriaLength: '12 حرفاً على الأقل', criteriaUppercase: 'حرف كبير واحد (A-Z) على الأقل', criteriaLowercase: 'حرف صغير واحد (a-z) على الأقل', criteriaNumber: 'رقم واحد (0-9) على الأقل', criteriaSymbol: 'رمز خاص واحد على الأقل',
    },
    onboarding: {
      step1Title: 'مرحباً بك في نابه SafeLink',
      step1Subtitle: 'نظامك المؤسسي الفعال لكشف محاولات الاحتيال والتصيد الإلكتروني عبر الروابط والرسائل.',
      step2Title: 'فحص فوري وتحليل متقدم',
      step2Subtitle: 'دمج بين أكثر من 90 محرك فحص عالمي ونموذج تعلم آلي محلي مدرب بـ 42 ميزة لهياكل الروابط.',
      step3Title: 'تفسيرات وتوصيات ذكية باللغة العربية',
      step3Subtitle: 'تحليل دقيق مدعوم بالذكاء الاصطناعي مع إعطاء توصيات أمنية عملية لحماية بياناتك وحساباتك.',
      skip: 'تخطي إلى الفحص',
      next: 'التالي',
      start: 'بدء الاستخدام',
    },
    sessionCheck: {
      title: 'جارٍ تأمين الجلسة',
      desc: 'يتم التحقق من هوية الجلسة وتطبيق سياسات الحماية',
      status: 'اتصال مشفر · تحقق متعدد الطبقات',
    },
    dashboard: {
      loading: 'جارٍ تحميل لوحة التحكم الآمنة…',
      loadError: 'تعذر تحميل بيانات لوحة التحكم. تحقق من اتصال الخادم وقاعدة البيانات.',
      changePasswordSuccess: 'تم تغيير كلمة المرور بنجاح.',
      changePasswordError: 'تعذر تغيير كلمة المرور.',
      liveAlert: 'تنبيه أمني فوري: تم رصد نتيجة خطيرة في حسابك.',
      liveUpdate: 'وصل تحديث فوري: اكتمل فحص جديد.',
      labels: {
        safe: 'آمن',
        suspicious: 'مشبوه',
        dangerous: 'خطير',
        unknown: 'غير معروف',
      },
      tabs: {
        overview: 'نظرة عامة',
        history: 'سجل الفحوصات',
        profile: 'الملف الشخصي',
        security: 'الأمان وحسابي',
        notifications: 'الإشعارات',
        privacy: 'الخصوصية والافتراضات',
      },
      overview: {
        title: 'ملخص النشاط الأمني',
        totalScans: 'إجمالي الفحوصات',
        safeScans: 'الروابط الآمنة',
        suspiciousScans: 'الروابط المشبوهة',
        dangerousScans: 'التهديدات والخطيرة',
        liveStream: 'بث الأنشطة الفورية',
        connected: 'متصل بالبث المباشر',
        reconnecting: 'جاري إعادة الاتصال...',
        disconnected: 'منفصل',
        recentActivity: 'أحدث التنبيهات والأنشطة',
        noActivity: 'لا توجد أنشطة مسجلة حديثاً.',
      },
      profileSection: {
        title: 'الملف الشخصي والمعلومات الأساسية',
        displayName: 'اسم العرض',
        email: 'البريد الإلكتروني',
        language: 'اللغة المفضلة',
        timezone: 'النطاق الزمني',
        saveBtn: 'حفظ التغيرات',
        savingBtn: 'جاري الحفظ...',
      },
      securitySection: {
        title: 'إعدادات الأمان وتغيير كلمة المرور',
        currentPassword: 'كلمة المرور الحالية',
        newPassword: 'كلمة المرور الجديدة',
        confirmPassword: 'تأكيد كلمة المرور الجديدة',
        changePasswordBtn: 'تحديث كلمة المرور',
        activityLog: 'سجل نشاط تسجيل الدخول',
      },
      notificationsSection: {
        title: 'تفضيلات الإشعارات والتنبيهات',
        emailAlerts: 'تنبيهات البريد الإلكتروني للتهديدات',
        pushAlerts: 'التنبيهات الفورية داخل المتصفح',
        securityAlerts: 'تنبيهات تسجيل الدخول والأنشطة',
        savePreferences: 'حفظ التفضيلات',
      },
      privacySection: {
        title: 'إدارة الخصوصية والموافقات',
        consentsTitle: 'سجل الموافقات والشروط المقبولة',
      },
    },
    scanDetails: {
      title: 'تفاصيل الفحص',
      kicker: 'تقرير فحص موثق',
      backToHistory: '← العودة إلى السجل',
      loadError: 'تعذر تحميل تفاصيل الفحص.',
      loading: 'جارٍ تحميل تفاصيل الفحص…',
      inputType: 'نوع الإدخال',
      textType: 'رسالة نصية',
      urlType: 'رابط',
      confidence: 'درجة الثقة',
      notAvailable: 'غير متاحة',
      completedAt: 'وقت الإكمال',
      status: 'الحالة',
      statusCompleted: 'مكتمل',
      analysisChain: 'سلسلة التحليل',
      fullStages: 'مراحل الفحص بالكامل',
      aiSection: 'الذكاء الاصطناعي',
      explanationRecommendation: 'الشرح والتوصية',
      noExplanation: 'لا يوجد شرح محفوظ لهذا الفحص.',
      securityRecommendation: 'التوصية الأمنية',
      defaultRec: 'تعامل مع النتيجة بحذر وتحقق من المصدر.',
      actionsTitle: 'إجراءات التقرير',
      exportBtn: 'تصدير التقرير',
      compareBtn: 'مقارنة مع فحوصات أخرى',
      stageCompleted: 'مكتمل',
      localAnalysis: 'التحليل المحلي',
      finalVerdict: 'القرار النهائي',
      legacyNote: 'تم حفظ الفحص قبل تفعيل لقطة المراحل. أعد تشغيل SQL migration لحفظ التفاصيل الكاملة للفحوصات الجديدة.',
      labels: {
        SAFE: 'آمن',
        SUSPICIOUS: 'مشبوه',
        DANGEROUS: 'خطير',
        UNKNOWN: 'غير معروف',
      },
      stages: {
        stage1_ml: 'المرحلة الأولى: نموذج ML',
        stage1_text_nlp: 'المرحلة الأولى: تحليل النص',
        stage2_virustotal: 'المرحلة الثانية: VirusTotal',
        stage2_link_audit: 'المرحلة الثانية: تدقيق الرابط',
        stage3_gemini: 'المرحلة الثالثة: Gemini AI',
        stage3_gemini_sms: 'المرحلة الثالثة: تحليل الرسالة',
      },
    },
    comparison: {
      kicker: 'تحليل زمني',
      title: 'مقارنة الفحوصات',
      subtitle: 'قارن التصنيف ودرجة الثقة وتغير الخطر بين فحوصات حسابك.',
      selectTitle: 'اختر الفحوصات',
      selectMuted: 'يمكن اختيار من 2 إلى 4 فحوصات',
      runBtn: 'تشغيل المقارنة',
      loadError: 'تعذر تحميل سجل الفحوصات.',
      minError: 'اختر فحصين على الأقل للمقارنة.',
      failError: 'تعذرت المقارنة.',
      loading: 'جارٍ تحميل السجل…',
      resultsKicker: 'النتائج',
      trendTitle: 'التغير عبر الزمن',
      rowHeaderScan: 'الفحص',
      rowHeaderClass: 'التصنيف',
      rowHeaderConfidence: 'الثقة',
      rowHeaderDate: 'التاريخ',
      insightTitle: 'قراءة المقارنة',
      methodologyTitle: 'منهجية المقارنة',
      methodologyDesc: 'تعتمد المقارنة على التصنيف النهائي ودرجة الثقة والوقت المسجل لكل فحص. لا يتم كشف الرابط الأصلي، وتبقى القيم المعروضة مقنعة لحماية الخصوصية.',
      trendUp: 'الثقة ارتفعت',
      trendDown: 'الثقة انخفضت',
      trendStable: 'الثقة مستقرة',
      insightDangerous: 'تم رصد {count} نتيجة خطيرة ضمن الفحوصات المحددة. تعامل مع أحدث نتيجة باعتبارها المرجع الأهم ولا تفتح الرابط قبل التحقق.',
      insightSafe: 'لم تظهر نتيجة خطيرة ضمن الفحوصات المحددة. استمر في التحقق من المصدر لأن التصنيف قابل للتغير مع ظهور معلومات جديدة.',
    },
    exportReport: {
      kicker: 'تقارير قابلة للتنزيل',
      title: 'تصدير تقرير الفحص',
      subtitle: 'حمّل نسخة منظمة من التقرير أو اطبعها بصيغة PDF.',
      noScanError: 'لم يتم تحديد فحص لتصدير تقريره.',
      loadError: 'تعذر تحميل التقرير.',
      preparing: 'جارٍ تجهيز التقرير…',
      brandTitle: 'Nabeh SafeLink',
      brandSub: 'تقرير تحليل أمني',
      classification: 'التصنيف',
      confidence: 'الثقة',
      notAvailable: 'غير متاحة',
      scanTime: 'وقت الفحص',
      recommendationTitle: 'التوصية',
      defaultRec: 'تعامل مع النتيجة بحذر.',
      selectFormat: 'اختر الصيغة',
      jsonDesc: 'للأنظمة والتكاملات البرمجية',
      csvDesc: 'للجداول والتحليل في Excel',
      pdfDesc: 'فتح نافذة الطباعة ثم اختيار Save as PDF',
      localNotice: 'يتم إنشاء ملف JSON وCSV محلياً في جهازك. لا يتم رفع التقرير إلى خدمة خارجية.',
    },
    notificationsPage: {
      title: 'مركز الإشعارات والتنبيهات',
      subtitle: 'استعرض كافة التنبيهات الأمنية والأنشطة المسجلة في حسابك.',
      loadError: 'تعذر تحميل الإشعارات.',
      markAllSuccess: 'تم تعليم جميع الإشعارات كمقروءة.',
      markAllError: 'تعذر تحديث حالة الإشعارات.',
      markAllBtn: 'تعليم الكل كمقروء',
      emptyState: 'لا توجد إشعارات حالياً.',
      loading: 'جارٍ تحميل الإشعارات…',
    },
    alertSettingsPage: {
      title: 'إعدادات التنبيهات والأمان',
      subtitle: 'خصص القنوات والوسائط التي ترغب بتلقي التنبيهات الأمنية عبرها.',
      loadError: 'تعذر تحميل إعدادات التنبيهات.',
      saveSuccess: 'تم حفظ إعدادات التنبيهات بنجاح.',
      saveError: 'تعذر حفظ إعدادات التنبيهات.',
      emailAlerts: 'تنبيهات البريد الإلكتروني عند اكتشاف تهديد خطر',
      pushAlerts: 'التنبيهات الفورية المباشرة داخل المتصفح',
      securityAlerts: 'تنبيهات أنشطة تسجيل الدخول والجلسات الأمنية',
      saveBtn: 'حفظ الإعدادات',
      savingBtn: 'جاري الحفظ...',
    },
    welcome: {
      tagline: 'نظام الحماية والوقاية السيبرانية الذكي',
      heroTitle: 'فحص فوري ووقاية استباقية من التهديدات السيبرانية',
      heroDesc: 'حلل الروابط الإلكترونية والرسائل النصية المشبوهة بدقة متناهية بالاعتماد على نموذج التعلم الآلي المحلي، الذكاء الاصطناعي التوليدي Google Gemini، وقواعد بيانات التهديدات العالمية.',
      startScan: 'بدء فحص رابط الآن',
      scanSms: 'فحص رسالة نصية (SMS)',
      featuresTitle: 'منظومة حماية متكاملة ومحركات فحص هجينة',
      feat1Title: '1. فحص الروابط ونصوص SMS',
      feat1Desc: 'كشف محاولات الانتحال الحسابي والاحتيال المالي وروابط التتبع المخفية.',
      feat2Title: '2. نموذج تعلم آلي محلي (ML)',
      feat2Desc: 'مدرب على 42 ميزة لهياكل الروابط مع سرعة استجابة فائقة وتقييم مباشر.',
      feat3Title: '3. ذكاء اصطناعي تفسيري (Gemini)',
      feat3Desc: 'تحليل بشري مباشر يصيغ أسباب الخطر ويقدم توصية أمنية واضحة.',
      howItWorks: 'كيف يضمن نبيه سلامة بياناتك؟',
      step1: 'انسخ الرابط أو النص المشكوك فيه من البريد أو المحادثة',
      step2: 'أدخل البيانات في المحرك لبدء التحليل متعدد الطبقات',
      step3: 'احصل على التقرير الفوري والتصنيف والتوصية الأمنية',
      guestScanTitle: 'جرّب الفحص كضيف دقيقة واحدة',
      guestScanDesc: 'يمكنك فحص رابط أو نص فوراً دون الحاجة لتسجيل حساب. لا يتم حفظ النتيجة في سجل نبيه.',
    },
  },

  en: {
    // Header & Navigation
    nav: {
      home: 'Home',
      scan: 'Scan',
      history: 'History',
      stats: 'Statistics',
      help: 'Help & Support',
      faq: 'FAQ',
      guide: 'User Guide',
      contact: 'Contact Us',
      about: 'About Project',
      protectionActive: 'Protection Active',
      goHome: 'Go to Home - Nabeh SafeLink',
      languageSelect: 'Select Language',
      changeLanguage: 'Change Language',
      arabic: 'العربية',
      english: 'English',
      breadcrumbHome: 'Home',
      breadcrumbHelp: 'Help & Support',
      profile: 'Profile',
      profileAria: 'Open Profile',
    },

    // Home Page
    home: {
      heroTag: 'NABEH SECURITY DASHBOARD',
      heroTitle: 'Smart Threat Detection & Prevention System',
      heroDesc: 'Analyze and inspect links and messages with high precision using Generative AI and global security engines to protect your device and data.',
      startScanBtn: 'Scan a URL Now',
      statsSafe: 'Safe Links',
      statsSafeSub: 'Trusted Links',
      statsSuspicious: 'Suspicious Links',
      statsSuspiciousSub: 'Caution Required',
      statsDangerous: 'Dangerous Threats',
      statsDangerousSub: 'Phishing Attempts',
      recentTitle: 'Recent Completed Scans',
      recentSub: 'History of latest operations processed through the engine',
      viewFullHistory: 'View Full History →',
      rescan: 'Rescan →',
      rescanLabel: 'Rescan {url}',
      safeStatus: 'Safe',
      dangerousStatus: 'Dangerous',
      suspiciousStatus: 'Suspicious',
      recentFallback: 'Recently',
      scannedUrl: 'Scanned URL',
    },

    // Scanner Page
    scanner: {
      pageTitle: 'Cyber Threat Detection & Scanning',
      tabUrl: 'URL Scan',
      tabText: 'SMS / Text Scan',
      subUrl: 'Paste the URL to analyze and detect phishing attempts or malicious links using artificial intelligence.',
      subText: 'Enter the suspicious SMS text or email content to inspect fraud indicators and spoofing.',
      placeholderUrl: 'Paste URL here... e.g. https://example.com',
      placeholderText: 'Paste message text here...',
      inputLabelUrl: 'Scan URL',
      inputLabelText: 'Scanned Message Text',
      clear: 'Clear',
      paste: 'Paste',
      startBtn: 'Start Safe Scan',
      scanningBtn: 'Scanning...',
      errEmptyInput: 'Please enter a valid URL or message text to inspect',
      errScanFailed: 'An error occurred during scanning. Please try again.',
      errServerConnection: 'The scanning service is temporarily unreachable. Check your connection and try again.',
      errPaste: 'Unable to read from clipboard automatically',
      recentScansTitle: 'Recent Scans',
      recentCount: '{count} scans',
      rescanTooltip: 'Click to trigger instant rescan',
      rescanAria: 'Rescan {url} - Status {status}',
      guestTitle: 'Guest scan:', guestDesc: 'Scan a URL or message without an account. Nabeh does not save the result, but the input may be sent to VirusTotal or Gemini for analysis; do not scan secrets.', guestPrivacy: 'The result is temporary and is not saved to Nabeh history. External analysis services may be used when enabled.', noRecentScans: 'No saved scans yet.', savedScan: 'Saved scan', workspace: 'NABEH SECURE WORKSPACE', liveProtection: 'Live protection enabled', capabilities: 'Scan capabilities', aiAnalysis: 'AI analysis', multiSource: 'Multi-source scan', privacyFirst: 'Privacy first',
    },

    // History Page
    history: {
      title: 'Scan History',
      subtitle: 'Review and save all analyzed operations and URLs with quick search and filtering options.',
      searchPlaceholder: 'Search history by URL name...',
      filterAll: 'All',
      filterSafe: 'Safe',
      filterSuspicious: 'Suspicious',
      filterDangerous: 'Dangerous',
      emptyState: 'No scans match the selected filter',
      confidence: 'Confidence {pct}%',
      rescanBtn: 'Rescan →',
    },

    // Statistics Page
    stats: {
      title: 'My Statistics & Analytics',
      subtitle: 'Comprehensive and qualitative analysis of all threats and scans processed by the system.',
      totalLabel: 'Total Executed Scans',
      distributionTitle: 'Scan Result Breakdown',
      safeLabel: 'Safe Links',
      suspiciousLabel: 'Suspicious Links',
      dangerousLabel: 'Dangerous / Fraud Links',
      fraudTypesTitle: 'Detected Threat Types (Fraud Types)',
      phishingType: 'Credential Phishing',
      shortenerType: 'Shortener Abuse',
      malwareType: 'Malware & Phishing Links',
    },

    // Result Screen
    result: {
      safeLabelAr: 'Safe & Threat-Free',
      safeLabelEn: 'SAFE URL',
      safeTitle: 'URL is Safe & Verified',
      safeDesc: 'No malware or phishing attempts detected. You can proceed and browse safely.',

      suspiciousLabelAr: 'Suspicious - Caution Advised',
      suspiciousLabelEn: 'SUSPICIOUS',
      suspiciousTitle: 'Warning: Suspicious URL',
      suspiciousDesc: 'Potential risk indicators detected. Exercise caution and avoid entering credentials or sensitive data.',

      dangerousLabelAr: 'Danger - Cyber Threat',
      dangerousLabelEn: 'DANGEROUS',
      dangerousTitle: 'Danger! Malicious / Phishing URL',
      dangerousDesc: 'High risk warning! This link contains security threats or phishing attempts. Do not open!',

      unknownLabelAr: 'Unclassified Status',
      unknownLabelEn: 'UNKNOWN',
      unknownTitle: 'Classification Undetermined',
      unknownDesc: 'Engines could not conclusively classify this link. Always remain cautious with unknown links.',

      sourceLabel: 'Source: {source}',
      hybridSource: 'Hybrid AI Engine',
      inspectedUrlLabel: 'Inspected URL:',
      confidenceLabel: 'Confidence Score',
      aiAnalysisTitle: 'AI Analysis & Insights',
      aiModelTag: 'Google Gemini AI',
      recommendationTitle: 'Nabeh Security Recommendation:',
      vtEnginesTitle: 'Global Engine Scans (VirusTotal v3)',
      vtDangerous: 'Malicious',
      vtSuspicious: 'Suspicious',
      vtSafe: 'Harmless',
      vtTotal: 'Total Engines',
      mlModelTitle: 'Machine Learning Model Analysis',
      mlLocalPrediction: 'Local Prediction: ',
      mlSafeBadge: 'Safe',
      mlDangerousBadge: 'Phishing',
      mlSuspiciousBadge: 'Suspicious',
      mlRiskProb: '{prob}% Risk',
      scanNewBtn: 'Scan New URL',
      copyReportBtn: 'Copy Detailed Report', pageLabel: 'Main scan results',
      copiedReportBtn: 'Report Copied!',
      defaultRec: 'Always stay vigilant when opening links',
    },

    // Error Pages (#47)
    error: {
      notFoundTitle: 'Page Not Found',
      notFoundDesc: 'The link may be incorrect or the page is no longer available.',
      internalTitle: 'Unable to Complete Request',
      internalDesc: 'An unexpected error occurred. We could not complete this step.',
      refCodeLabel: 'Error Reference Code:',
      goHomeBtn: 'Return to Home',
      goBackBtn: 'Go Back',
      retryBtn: 'Try Again',
      helpBtn: 'Help Center',
      reportIssueBtn: 'Report Issue',
      copyRefBtn: 'Copy Reference ID',
      copiedRefBtn: 'Copied!',
    },

    // Maintenance Page (#48)
    maintenance: {
      title: 'Nabeh Temporarily Under Maintenance',
      desc: 'We are performing scheduled maintenance and updates to ensure the highest standards of security. We will be back shortly.',
      statusBadge: 'Scheduled Maintenance Mode Active',
      checkAgainBtn: 'Check Status Again',
      checkingStatus: 'Checking service status...',
      helpBtn: 'User Guide & FAQ',
    },

    // Process Confirmation (#50)
    confirmation: {
      processCompleteTitle: 'Operation Completed Successfully',
      processCompleteDesc: 'The request has been processed and confirmed by the server.',
      scanAnalysisComplete: 'Technical Link Analysis Completed',
      scanNotice: 'Notice: Analysis completion indicates scan success only and does not imply the URL is safe. Please review the threat classification.',
      continueBtn: 'Continue',
      viewResultBtn: 'View Detailed Report',
      backToHomeBtn: 'Back to Home',
      copyRefId: 'Copy Reference ID',
    },

    // Loading & Splash (#49)
    loading: {
      title: 'Performing Deep Scan',
      urlLabel: 'URL:',
      hint: 'Scanned via AI and Global Security Engines',
      cancelBtn: 'Cancel Scan',
      messages: [
        'Analyzing structural properties and URL syntax...',
        'Checking global threat databases...',
        'Verifying via Machine Learning and AI models...',
        'Analyzing phishing and spoofing indicators...',
        'Generating comprehensive explanatory report...',
      ]
    },
    splash: {
      tagline: 'Scan • Detect • Stay Safe',
      footer: 'Nabeh SafeLink Digital Security Infrastructure',
      status: 'Preparing your protection...',
      statusPreparing: 'Initializing secure workspace & connection encryption...',
      statusChecking: 'Verifying digital session token & network security...',
      statusReady: 'Security verification complete, welcome to Nabeh SafeLink',
      statusOffline: 'Network connection unavailable. Please check your internet connection...'
    },

    // FAQ Page (#32)
    faq: {
      title: 'Frequently Asked Questions (FAQ)',
      subtitle: 'Concise and reliable answers about URL & message inspection, results, and Nabeh privacy.',
      searchPlaceholder: 'Search FAQ...',
      clearSearch: 'Clear Search',
      categoryAll: 'All',
      categoryGeneral: 'General',
      categoryUrlScan: 'URL Scan',
      categoryMsgScan: 'SMS Scan',
      categoryResults: 'Results & Confidence',
      categoryPrivacy: 'Account & Privacy',
      noResultsTitle: 'No answers found matching your search',
      noResultsSub: 'Try searching with different keywords or contact our support team directly.',
      contactCtaTitle: 'Didn\'t find an answer to your question?',
      contactCtaSub: 'Our technical support team is available to assist you with any security inquiries.',
      contactBtn: 'Contact Us Now',
      viewGuideBtn: 'Read Detailed User Guide →',
    },

    // Contact Us Page (#33)
    contact: {
      title: 'Contact Us',
      subtitle: 'Submit your inquiry or security report and our team will process it promptly.',
      supportCardTitle: 'Direct Support Channel',
      supportEmailLabel: 'Official Support Email:',
      supportHoursLabel: 'Working Hours: Sun - Thu (8:00 AM - 4:00 PM)',
      typeLabel: 'Request Type *',
      typeScanIssue: 'Issue with scan or result',
      typeInaccurateResult: 'Report inaccurate result',
      typeAccountGeneral: 'General / Usage Inquiry',
      typeSuggestion: 'Feature request or suggestion',
      typeOther: 'Other',
      emailLabel: 'Reply Email *',
      emailPlaceholder: 'name@example.com',
      subjectLabel: 'Subject *',
      subjectPlaceholder: 'Brief summary of your request...',
      scanIdLabel: 'Scan ID (Optional)',
      scanIdPlaceholder: 'Example: #scan-10293',
      scanIdHint: 'Helps us review faster when related to a previous scan',
      detailsLabel: 'Request Details *',
      detailsPlaceholder: 'Explain your inquiry or issue in detail...',
      privacyNotice: 'Important Security Notice: Never send passwords, verification codes, or banking details.',
      sendBtn: 'Send Request',
      sendingBtn: 'Sending...',
      cancelBtn: 'Back to Home',
      successTitle: 'Your request was sent successfully!',
      successMsg: 'Thank you for reaching out. Your request reference ID is {ticketId}. We will get back to you soon.',
      newRequestBtn: 'Submit Another Request',
      backToFaqBtn: 'Back to FAQ',
    },

    // About Project Page (#34)
    about: {
      title: 'About Nabeh SafeLink',
      subtitle: 'A smart cyber platform designed to classify links and messages accurately before you click.',
      overviewTitle: 'What is Nabeh SafeLink?',
      overviewDesc: 'Nabeh SafeLink is an advanced security system serving as a primary line of defense to inspect suspicious links and text content. It combines local Machine Learning models, Google Gemini Generative AI, and VirusTotal v3 global threat intelligence.',
      howItWorksTitle: 'How Nabeh Works',
      step1Title: '1. Direct Structural Analysis',
      step1Desc: 'Inspects syntactic URL properties, shortener domains, and spoofing risk indicators.',
      step2Title: '2. Hybrid Engine (ML + VirusTotal)',
      step2Desc: 'Instant verification via locally-trained ML model and global security vendor queries.',
      step3Title: '3. Generative AI Explanation',
      step3Desc: 'Generates human-readable explanatory insights clarifying risk reasons and actionable advice.',
      boundariesTitle: 'Scope, Transparency & Disclaimers',
      boundary1: 'Nabeh provides decision-support risk indicators; it does not replace primary endpoint antivirus software.',
      boundary2: 'Links are never opened automatically in your browser nor executed during analysis.',
      boundary3: 'Results are based on available intelligence at the moment of inspection.',
      featuresTitle: 'Current MVP Features',
      feature1: 'URL and SMS/Text message inspection',
      feature2: 'Threat classification (Safe / Suspicious / Dangerous) & Confidence Score',
      feature3: 'Local scan history, analytics breakdown, and visual charts',
      feature4: 'Full Arabic/English bilingual support with Light & Dark themes',
      metaTitle: 'Version & System Information',
      versionLabel: 'App Version: v1.0.0 (MVP Stable Release)',
      engineLabel: 'Engine: Nabeh Hybrid Security Engine v1',
      startScanCta: 'Start URL Scan Now',
      userGuideCta: 'Full User Guide',
      faqCta: 'Frequently Asked Questions',
    },

    // User Guide Page (#35)
    guide: {
      title: 'User Guide',
      subtitle: 'Step-by-step instructions for using Nabeh tools and understanding security evaluations.',
      tocTitle: 'Table of Contents',
      section1Title: '1. Getting Started',
      section1Desc: 'Nabeh is freely accessible without requiring software installation. Start inspecting suspicious links or messages directly from the home screen.',
      section2Title: '2. Scanning a URL',
      section2Desc: 'Copy the suspicious link from email or chat, open "URL Scan", paste it into the field, and click "Start Safe Scan". Results appear within seconds.',
      section3Title: '3. Scanning SMS / Text Messages',
      section3Desc: 'Switch to "SMS / Text Scan", paste the message content, and Nabeh will analyze it for scam wording, fake financial claims, and hidden phishing links.',
      section4Title: '4. Understanding Results & Confidence',
      section4Desc: 'Scans are classified as Safe, Suspicious, or Dangerous. The Confidence Score (%) indicates how strongly the detected indicators match known threat patterns.',
      section5Title: '5. Scan History & Analytics',
      section5Desc: 'Review all past scans on the "History" page with search and filters. The "Statistics" page provides a breakdown of threat types.',
      section6Title: '6. Safe Cyber Hygiene Practices',
      section6Desc: 'If a result is "Suspicious" or "Dangerous", do not open the link. Never enter credentials or financial data on unverified sites.',
      prevSection: 'Previous Section',
      nextSection: 'Next Section',
      quickScanBtn: 'Try Scanning a URL',
      needMoreHelpTitle: 'Need further assistance?',
      needMoreHelpSub: 'Explore our FAQ or reach out to technical support.',
    },
    auth: {
      language: 'العربية', changeLanguage: 'Change language', toggleTheme: 'Toggle theme', logout: 'Sign out', loginTitle: 'Welcome Back', loginSubtitle: 'Sign in to your account', emailOrUsername: 'Email or username', emailAddress: 'Email address', password: 'Password', newPassword: 'New password', confirmPassword: 'Confirm password', confirmNewPassword: 'Confirm new password', rememberMe: 'Remember me', forgotPassword: 'Forgot password?', login: 'Login', register: 'Register', noAccount: "Don't have an account?", alreadyAccount: 'Already have an account?', continueGuest: 'Continue as guest', createAccount: 'Create Account', registerSubtitle: 'Join us for a safer internet', fullName: 'Full name', registerAction: 'Register', verifyEmail: 'Verify your email', verifyRecovery: 'Verify recovery code', codeSent: 'We sent a 6-digit code to', verifyCode: 'Verify code', requestCodeIn: 'Request a new code in {seconds}s', requestNewCode: 'Request a new code', resendError: 'Unable to resend the code. Please try again later.', resendRateLimited: 'Too many resend requests. Please try again later.', emailDeliveryError: 'We could not send the verification code right now. Please try again later.', backToRecovery: 'Back to password recovery', backToRegister: 'Back to registration', resetTitle: 'Create a new password', resetSubtitle: 'Use a strong password with at least 12 characters to protect your account', updatePassword: 'Update password', requestRecovery: 'Request a new recovery code', resetInvalid: 'This recovery session is invalid or expired. Request a new reset link.', passwordUpdated: 'Password updated', passwordUpdatedDesc: 'Your password has been changed successfully. Redirecting you to sign in…', forgotTitle: 'Reset your password', forgotSubtitle: "Enter your email and we'll send you a secure reset link", sendReset: 'Send reset link', checkInbox: 'Check your inbox', enterRecovery: 'Enter recovery code', backToSignIn: 'Back to sign in', socialDivider: 'or continue with', showPassword: 'Show password', hidePassword: 'Hide password', requiredFields: 'Please complete all required fields', passwordMismatch: 'The passwords do not match', passwordLength: 'Your password must be at least 12 characters long', invalidCode: 'The verification code is invalid or has expired', missingEmail: 'The verification email is missing', resetError: 'Unable to update your password. The recovery session may have expired.', registerError: 'Failed to create account. Please check your data or try again.', registerSuccessDefault: 'If the email address is valid, account verification instructions will be sent', registeredEmailFallback: 'your registered email', socialGoogle: 'Continue with Google', socialApple: 'Continue with Apple', passwordCriteriaTitle: 'Security password requirements:', criteriaLength: 'At least 12 characters', criteriaUppercase: 'At least one uppercase letter (A-Z)', criteriaLowercase: 'At least one lowercase letter (a-z)', criteriaNumber: 'At least one number (0-9)', criteriaSymbol: 'At least one special character',
    },
    onboarding: {
      step1Title: 'Welcome to Nabeh SafeLink',
      step1Subtitle: 'Your smart enterprise system for detecting phishing and fraud attempts across links and messages.',
      step2Title: 'Instant Scan & Advanced Intelligence',
      step2Subtitle: 'Combining 90+ global scanning engines with a local ML model trained on 42 structural link features.',
      step3Title: 'Smart AI Explanations & Guidance',
      step3Subtitle: 'Accurate AI-driven insights with actionable security recommendations to protect your data.',
      skip: 'Skip to Scanner',
      next: 'Next',
      start: 'Get Started',
    },
    sessionCheck: {
      title: 'Securing Session',
      desc: 'Verifying session identity and applying security policies',
      status: 'Encrypted Connection · Multi-layer Verification',
    },
    dashboard: {
      loading: 'Loading secure dashboard…',
      loadError: 'Failed to load dashboard data. Check server and database connection.',
      changePasswordSuccess: 'Password changed successfully.',
      changePasswordError: 'Failed to change password.',
      liveAlert: 'Live Security Alert: High risk scan detected in your account.',
      liveUpdate: 'Live Update: New scan completed.',
      labels: {
        safe: 'Safe',
        suspicious: 'Suspicious',
        dangerous: 'Dangerous',
        unknown: 'Unknown',
      },
      tabs: {
        overview: 'Overview',
        history: 'Scan History',
        profile: 'Profile',
        security: 'Security & Account',
        notifications: 'Notifications',
        privacy: 'Privacy & Consents',
      },
      overview: {
        title: 'Security Activity Overview',
        totalScans: 'Total Scans',
        safeScans: 'Safe Links',
        suspiciousScans: 'Suspicious Links',
        dangerousScans: 'Dangerous Threats',
        liveStream: 'Live Activity Stream',
        connected: 'Connected to Live Stream',
        reconnecting: 'Reconnecting...',
        disconnected: 'Disconnected',
        recentActivity: 'Recent Alerts & Activity',
        noActivity: 'No recent activity recorded.',
      },
      profileSection: {
        title: 'Profile & Basic Info',
        displayName: 'Display Name',
        email: 'Email Address',
        language: 'Preferred Language',
        timezone: 'Timezone',
        saveBtn: 'Save Changes',
        savingBtn: 'Saving...',
      },
      securitySection: {
        title: 'Security & Password Settings',
        currentPassword: 'Current Password',
        newPassword: 'New Password',
        confirmPassword: 'Confirm New Password',
        changePasswordBtn: 'Update Password',
        activityLog: 'Login Activity Log',
      },
      notificationsSection: {
        title: 'Notification & Alert Preferences',
        emailAlerts: 'Email Alerts for Threats',
        pushAlerts: 'In-Browser Push Alerts',
        securityAlerts: 'Login & Security Activity Alerts',
        savePreferences: 'Save Preferences',
      },
      privacySection: {
        title: 'Privacy & Consent Management',
        consentsTitle: 'Accepted Consents & Terms Log',
      },
    },
    scanDetails: {
      title: 'Scan Details',
      kicker: 'Verified Scan Report',
      backToHistory: '← Back to History',
      loadError: 'Failed to load scan details.',
      loading: 'Loading scan details…',
      inputType: 'Input Type',
      textType: 'Text Message',
      urlType: 'URL',
      confidence: 'Confidence Score',
      notAvailable: 'N/A',
      completedAt: 'Completed At',
      status: 'Status',
      statusCompleted: 'Completed',
      analysisChain: 'Analysis Pipeline',
      fullStages: 'Full Scan Stages',
      aiSection: 'Artificial Intelligence',
      explanationRecommendation: 'Explanation & Recommendation',
      noExplanation: 'No saved explanation for this scan.',
      securityRecommendation: 'Security Recommendation',
      defaultRec: 'Handle the result with caution and verify the source.',
      actionsTitle: 'Report Actions',
      exportBtn: 'Export Report',
      compareBtn: 'Compare with Other Scans',
      stageCompleted: 'Completed',
      localAnalysis: 'Local Analysis',
      finalVerdict: 'Final Verdict',
      legacyNote: 'Scan saved before stage snapshots were enabled. Run SQL migration to store full stage details for new scans.',
      labels: {
        SAFE: 'Safe',
        SUSPICIOUS: 'Suspicious',
        DANGEROUS: 'Dangerous',
        UNKNOWN: 'Unknown',
      },
      stages: {
        stage1_ml: 'Stage 1: ML Model',
        stage1_text_nlp: 'Stage 1: Text NLP Analysis',
        stage2_virustotal: 'Stage 2: VirusTotal Engine',
        stage2_link_audit: 'Stage 2: Link Audit',
        stage3_gemini: 'Stage 3: Gemini AI',
        stage3_gemini_sms: 'Stage 3: SMS Analysis',
      },
    },
    comparison: {
      kicker: 'Timeline Analysis',
      title: 'Compare Scans',
      subtitle: 'Compare classification, confidence score, and risk changes across your account scans.',
      selectTitle: 'Select Scans',
      selectMuted: 'You can select 2 to 4 scans',
      runBtn: 'Run Comparison',
      loadError: 'Failed to load scan history.',
      minError: 'Select at least 2 scans to compare.',
      failError: 'Comparison failed.',
      loading: 'Loading history…',
      resultsKicker: 'Results',
      trendTitle: 'Trend Over Time',
      rowHeaderScan: 'Scan',
      rowHeaderClass: 'Classification',
      rowHeaderConfidence: 'Confidence',
      rowHeaderDate: 'Date',
      insightTitle: 'Comparison Insight',
      methodologyTitle: 'Comparison Methodology',
      methodologyDesc: 'Comparison is based on the final classification, confidence score, and timestamp of each scan. Original links remain masked for privacy.',
      trendUp: 'Confidence Increased',
      trendDown: 'Confidence Decreased',
      trendStable: 'Confidence Stable',
      insightDangerous: '{count} dangerous result(s) detected among selected scans. Treat the latest result as primary and do not open the link before verifying.',
      insightSafe: 'No dangerous results detected among selected scans. Continue verifying sources as ratings may change with new intelligence.',
    },
    exportReport: {
      kicker: 'Downloadable Reports',
      title: 'Export Scan Report',
      subtitle: 'Download a structured report or print it as a PDF.',
      noScanError: 'No scan selected to export.',
      loadError: 'Failed to load report.',
      preparing: 'Preparing report…',
      brandTitle: 'Nabeh SafeLink',
      brandSub: 'Security Analysis Report',
      classification: 'Classification',
      confidence: 'Confidence',
      notAvailable: 'N/A',
      scanTime: 'Scan Time',
      recommendationTitle: 'Recommendation',
      defaultRec: 'Handle the result with caution.',
      selectFormat: 'Select Format',
      jsonDesc: 'For API & System Integration',
      csvDesc: 'For Spreadsheets & Excel Analysis',
      pdfDesc: 'Open Print dialog then choose Save as PDF',
      localNotice: 'JSON & CSV files are generated locally on your device. Reports are not uploaded externally.',
    },
    notificationsPage: {
      title: 'Notifications & Alert Center',
      subtitle: 'Review all security alerts and recorded activities for your account.',
      loadError: 'Failed to load notifications.',
      markAllSuccess: 'All notifications marked as read.',
      markAllError: 'Failed to update notification status.',
      markAllBtn: 'Mark All as Read',
      emptyState: 'No notifications at this time.',
      loading: 'Loading notifications…',
    },
    alertSettingsPage: {
      title: 'Alert & Security Settings',
      subtitle: 'Customize channels and preferences for receiving security alerts.',
      loadError: 'Failed to load alert settings.',
      saveSuccess: 'Alert settings saved successfully.',
      saveError: 'Failed to save alert settings.',
      emailAlerts: 'Email alerts when high-risk threats are detected',
      pushAlerts: 'In-browser real-time push alerts',
      securityAlerts: 'Login activity & security session alerts',
      saveBtn: 'Save Settings',
      savingBtn: 'Saving...',
    },
    welcome: {
      tagline: 'Smart Cyber Protection & Threat Detection Platform',
      heroTitle: 'Instant Scanning & Proactive Defense Against Cyber Threats',
      heroDesc: 'Analyze suspicious links and text messages with high precision using local Machine Learning models, Google Gemini Generative AI, and global threat intelligence.',
      startScan: 'Start URL Scan Now',
      scanSms: 'Scan SMS Message',
      featuresTitle: 'Comprehensive Security & Hybrid Analysis Engines',
      feat1Title: '1. URL & SMS Text Scanning',
      feat1Desc: 'Detect credential phishing, financial scams, and hidden tracking links.',
      feat2Title: '2. Local Machine Learning Model',
      feat2Desc: 'Trained on 42 structural link features for lightning-fast real-time scoring.',
      feat3Title: '3. Generative AI Explanations',
      feat3Desc: 'Clear human-readable insights explaining threat reasons with actionable advice.',
      howItWorks: 'How Does Nabeh Protect Your Data?',
      step1: 'Copy the suspicious link or text from email or message',
      step2: 'Paste into the scanner to initiate multi-layer analysis',
      step3: 'Receive instant report, threat rating, and safety guidance',
      guestScanTitle: 'Try Guest Scanning in 1 Minute',
      guestScanDesc: 'Scan a URL or text immediately without creating an account. Results are not stored in Nabeh history.',
    },

    // Footer Component
    footer: {
      tagline: 'Smart Cyber Threat Detection & Prevention System',
      rights: 'All rights reserved © {year} Nabeh SafeLink.',
      supportSection: 'Help & Support',
      quickLinksSection: 'Quick Links',
      securityTitle: 'Trusted Protection',
      securityNotice: 'Notice: Nabeh is a decision-support guidance tool to assess threat indicators before taking action.',
    }
  }
};

export function LanguageProvider({ children }) {
  const { config } = useRuntimeConfig();
  const auth = useAuth();
  const user = auth?.user;
  const [lang, setLang] = useState(() => {
    if (!config.allow_language_override) return config.default_language;
    if (user?.preferred_language === 'ar' || user?.preferred_language === 'en') return user.preferred_language;
    try {
      const saved = localStorage.getItem('nabeh_lang');
      if (saved === 'ar' || saved === 'en') return saved;
      return config.default_language;
    } catch {
      return config.default_language;
    }
  });

  useEffect(() => {
    if (!config.allow_language_override) {
      setLang(config.default_language);
    } else if (user?.preferred_language === 'ar' || user?.preferred_language === 'en') {
      setLang(user.preferred_language);
    } else {
      try {
        const saved = localStorage.getItem('nabeh_lang');
        setLang(saved === 'ar' || saved === 'en' ? saved : config.default_language);
      } catch {
        setLang(config.default_language);
      }
    }
  }, [config.allow_language_override, config.default_language, user?.user_id, user?.preferred_language]);

  useEffect(() => {
    try {
      if (config.allow_language_override) localStorage.setItem('nabeh_lang', lang);
    } catch (e) {
      console.error('Could not save language preference', e);
    }

    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);

    if (lang === 'ar') {
      document.body.style.fontFamily = "'Cairo', 'IBM Plex Sans Arabic', -apple-system, sans-serif";
    } else {
      document.body.style.fontFamily = "'Poppins', 'Inter', -apple-system, sans-serif";
    }
  }, [lang, config.allow_language_override]);

  const toggleLanguage = () => {
    if (!config.allow_language_override) return;
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const setLanguage = (newLang) => {
    if (config.allow_language_override && (newLang === 'ar' || newLang === 'en')) {
      setLang(newLang);
      if (auth?.isGuest === false && user && user.preferred_language !== newLang) {
        api.patch('/dashboard/profile', { preferred_language: newLang }).catch(() => {});
      }
    }
  };

  const t = (keyPath, params = {}) => {
    const keys = keyPath.split('.');
    let current = translations[lang];

    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        // Fallback to Arabic if missing
        let fallback = translations['ar'];
        for (const fKey of keys) {
          if (fallback && fallback[fKey] !== undefined) {
            fallback = fallback[fKey];
          } else {
            return keyPath;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current === 'string') {
      let result = current;
      Object.keys(params).forEach((paramKey) => {
        result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
      });
      return result;
    }

    return current;
  };

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', toggleLanguage, setLanguage, canChangeLanguage: config.allow_language_override, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
