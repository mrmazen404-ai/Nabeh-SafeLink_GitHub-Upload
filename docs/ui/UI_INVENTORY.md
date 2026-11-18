# Nabeh SafeLink UI — Phase 1 Inventory

هذا الجرد يصف الواجهة الموجودة فعلياً في `frontend/src` قبل أي إعادة تصميم. لا يعني وجود المسار أن كل backend integration متاح في بيئة التشغيل؛ الجرد هنا للواجهة والتنقل والمكونات.

## 1. خريطة التطبيق

```text
App.jsx
├── BrowserRouter
├── PublicRoute
│   ├── NavigationLayout
│   │   ├── Header
│   │   ├── الصفحة العامة الحالية
│   │   └── Footer / BottomNav حسب العرض
│   └── الصفحات العامة
├── GuestRoute
│   └── صفحات المصادقة
└── ProtectedRoute
    └── NavigationLayout
        └── الصفحات المحمية للمستخدم
```

## 2. المسارات العامة

| المسار | المكوّن | الوظيفة الحالية |
|---|---|---|
| `/welcome` | `WelcomePage` | شاشة Welcome والهوية البصرية الرئيسية |
| `/scan` | `Scanner` | فحص URL أو رسالة نصية |
| `/faq` | `Faq` | الأسئلة الشائعة |
| `/support` | `Faq` | مسار دعم بديل يعرض FAQ حالياً |
| `/guide` | `UserGuide` | دليل الاستخدام |
| `/contact` | `Contact` | التواصل |
| `/about` | `About` | عن النظام |
| `/terms` | `LegalDocument(type=terms)` | الشروط |
| `/privacy` | `LegalDocument(type=privacy)` | الخصوصية |
| `/disclaimer` | `LegalDocument(type=disclaimer)` | إخلاء المسؤولية |
| `/onboarding` | `Onboarding` | التهيئة الأولية |
| `/splash` | `Splash` | شاشة البداية |
| `/` | `Splash` | نقطة الدخول الأولى |

## 3. مسارات المصادقة للضيف

| المسار | المكوّن | المدخلات/الانتقال |
|---|---|---|
| `/login` | `Login` | دخول، نسيان كلمة المرور، تسجيل جديد، دخول كضيف |
| `/register` | `Register` | إنشاء حساب ثم الانتقال إلى OTP |
| `/forgot-password` | `ForgotPassword` | طلب استعادة ثم OTP recovery |
| `/verify-otp` | `VerifyOtpRoute` → `VerifyOtp` | يقرأ Router state ثم query ثم `sessionStorage` |
| `/reset-password` | `ResetPassword` | رمز الاستعادة من hash/query/sessionStorage |

## 4. المسارات المحمية

| المسار | المكوّن | الوظيفة الحالية |
|---|---|---|
| `/dashboard` | `Dashboard` | لوحة المستخدم والإحصاءات المختصرة والفحوصات |
| `/home` | `Dashboard` | alias للوحة المستخدم |
| `/notifications` | `Notifications` | الإشعارات |
| `/settings/alerts` | `AlertSettings` | إعدادات التنبيهات |
| `/settings/privacy` | `DataPrivacy` | الخصوصية والبيانات |
| `/settings/account-data` | `DataPrivacy` | alias لإدارة بيانات الحساب |
| `/history` | `History` | سجل الفحوصات وإعادة الفحص |
| `/stats` | `Statistics` | الإحصائيات |
| `/scan-details/:scanId` | `ScanDetails` | تفاصيل فحص محدد |
| `/compare` | `Comparison` | مقارنة نتائج |
| `/export-report` | `ExportReport` | تصدير تقرير |
| `/settings` | `SettingsRedirect` | إعادة توجيه إلى الإعدادات |

## 5. صفحات النتائج والفحص

| المكوّن | دوره | ملفات النمط المرتبطة |
|---|---|---|
| `Scanner` | إدخال URL/SMS، النوع، الفحص الأخير، الخطأ، زر التنفيذ | `styles/scanner.css` |
| `LoadingScreen` | حالة التحليل، spinner، progress، الرسالة، URL، الإلغاء | `styles/loading.css` |
| `UrlResultScreen` | نتيجة URL وتفاصيلها وإجراءاتها | `styles/result.css` |
| `SmsResultScreen` | نتيجة SMS وخطة التصرف والروابط | `styles/result.css` |
| `ResultScreen` | غلاف/مكوّن نتيجة مشترك | `styles/result.css` |
| `ScanDetails` | نتيجة محفوظة، مراحل التحليل، التصدير والمقارنة | `pages/dashboard.css` و`styles/result.css` |

## 6. المكونات المشتركة

| المكوّن | الاستخدام |
|---|---|
| `Header` | الهوية، التنقل، اللغة، الثيم، المستخدم، الخروج |
| `BottomNav` | تنقل الهاتف |
| `Footer` | روابط المعلومات والسياسات |
| `AuthPageControls` | العودة إلى Welcome وعناصر التحكم في صفحات الدخول |
| `LanguageSwitcher` | تبديل العربية/الإنجليزية |
| `HelpMenu` | المساعدة |
| `Logo` | الهوية البصرية |
| `Icons` | مكتبة الأيقونات |
| `ConfirmationCard` | تأكيدات الإجراءات |
| `ErrorPage` | 404 والأخطاء العامة |
| `MaintenancePage` | حالة الصيانة |
| `SessionCheckScreen` | فحص الجلسة |
| `Skeleton` | حالات التحميل |
| `SplashScreen` | عرض بداية مستقل |

## 7. الحالة والسلوك المشترك

| الملف | المسؤولية | ما يجب الحفاظ عليه |
|---|---|---|
| `context/AuthContext.jsx` | حساب المستخدم، الدخول، التسجيل، OTP، recovery | tokens وتدفق الدخول |
| `context/LanguageContext.jsx` | العربية/الإنجليزية والترجمات | المفاتيح والنصوص الحالية |
| `context/ThemeContext.jsx` | Light/Dark وحركة الثيم | التفضيل والحركة |
| `services/api.js` | Axios و`VITE_API_URL` | base URL وHTTPS في الإنتاج |
| `services/authToken.js` | تخزين access token في sessionStorage | مفتاح `nabeh_access_token` |
| `App.jsx` | Router وRoute Guards والتنقل | قائمة المسارات والحماية |

## 8. ملفات CSS ومناطق التصميم

| الملف | نطاقه |
|---|---|
| `index.css` | القواعد العامة |
| `styles/theme.css` | tokens، header، cards، buttons، responsive shell |
| `styles/welcome-page.css` | المرجع البصري Welcome |
| `styles/splash.css` | Splash |
| `styles/loading.css` | Loading |
| `styles/scanner.css` | Scanner |
| `styles/result.css` | النتائج |
| `pages/dashboard.css` | Dashboard وHistory وStatistics |
| `pages/advanced-pages.css` | الصفحات الداخلية المتقدمة |
| `pages/auth/*.css` | Login/Register/OTP/Recovery |
| `components/session-check.css` | Session check |

## 9. نقاط responsive الموجودة حالياً

الواجهة لا تستخدم breakpoint موحداً بالكامل. النقاط الموجودة فعلياً تشمل:

```text
1024px  theme desktop shell
992px   scanner/result grids
900px   theme/header وWelcome
768px   theme layout
760px   theme mobile header
640px   Welcome
600px   Loading
560px   Scanner/Result
500px   Result details
480px   Splash
max-height: 660px  Splash
```

هذا هو أول مصدر للمشكلة المطلوبة: توجد مناطق متعددة لها قواعد مستقلة وقد تتعارض في الترتيب والمساحات. في مرحلة التصميم سيتم توحيدها تدريجياً، لا حذفها عشوائياً.

## 10. جرد القيود المرئية المطلوب الحفاظ عليها

- الهوية البصرية المرجعية هي `WelcomePage`.
- RTL/LTR موجودان ويجب اختبارهما معاً.
- Light/Dark موجودان ويجب عدم كسرهما.
- صفحات Auth لها CSS مستقل ولا يجوز فقدان أي زر أو رسالة.
- Scanner وResults يحتويان على بيانات كثيرة؛ الحل سيكون ترتيباً قابلاً للطي/التمدد وليس حذف البيانات.
- Header وBottomNav يتغيران حسب العرض ويجب اختبار عدم التكرار أو التداخل.
- شاشة Loading تحتوي progress ورسائل متبدلة وزر إلغاء ورسالة timeout ويجب الإبقاء عليها.

## 11. ترتيب التنفيذ بعد الجرد

لن تُنفذ التغييرات كلها دفعة واحدة. الترتيب الآمن المقترح:

1. tokens وshell العام.
2. Welcome كمرجع قياس.
3. Auth وOTP على الهاتف الصغير.
4. Scanner وLoading.
5. Results.
6. Header/BottomNav.
7. Dashboard والصفحات الداخلية.
8. اختبار RTL/LTR وLight/Dark ثم build والنشر.
