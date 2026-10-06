# تجهيز المنصة لاستضافة cPanel

المنصة تطبيق Next.js ديناميكي وليست موقعًا ثابتًا أو WordPress. المشروع يدعم تشغيل Node.js عبر cPanel/Passenger مع بقاء واجهة الإدارة وServer Actions وواجهة الموقع. هذا مسار نشر بديل؛ نبقي Cloudflare الحالي حتى تُختبر نسخة cPanel على استضافة فعلية ويُعتمد الانتقال.

## ما جهزناه

- مخرج Next.js مستقل عبر `npm run build:cpanel` مع ملفات التشغيل والأصول المطلوبة.
- نقطة تشغيل cPanel/Passenger في `app.js`.
- أمر `npm run package:cpanel` لإنشاء حزمة تشغيل صغيرة في `release/cpanel`، دون الشيفرة المصدرية أو ملفات الأسرار أو ملفات الرفع المحلية.
- GitHub Actions يبني الحزمة على Linux ويرفعها كملف artifact بعد نجاح البناء، لتجنب إجبار باقة cPanel المشتركة على تنفيذ بناء ثقيل.
- اتصال Node بـ PostgreSQL يستخدم pool محدودًا؛ `DATABASE_POOL_MAX` يحدد سقف الاتصالات لكل عملية. إجمالي الاتصالات = قيمة المتغير × عدد عمليات Passenger.
- المهام المجدولة تعمل بطلب Cron آمن إلى `/api/cron/process-jobs` بدل daemon دائم.
- يمكن بناء نسخة الموقع العام فقط عبر `PUBLIC_SITE_ONLY=true`. هذا الوضع يحجب
  صفحات لوحة الإدارة وتسجيل الدخول ويمنع مسارات API الخاصة عند طبقة middleware؛
  اتركه `false` على جهاز الإدارة المحلي.

## قبل شراء الاستضافة

اطلب تأكيدًا مكتوبًا من المزود بشأن هذه الشروط:

1. cPanel Application Manager/Passenger مع Node.js ‏22.12 أو أحدث.
2. السماح بتطبيق Next.js دائم عبر Passenger ومتغيرات بيئة وإعادة تشغيل بعد النشر.
3. PostgreSQL 14+، أو السماح باتصال TLS صادر إلى PostgreSQL خارجي عبر المنفذ 5432. MySQL/MariaDB وحدهما لا يكفيان لهذا المشروع.
4. حد RAM وCPU وعدد عمليات التطبيق ووقت الطلب، وحدود الرفع. الخطة المشتركة لا تضمن تحمل ضغط عالٍ؛ ذلك يتوقف على الموارد الفعلية.
5. HTTPS، Cron دوري، واتصال صادر إلى خدمة تخزين S3 إن استُخدمت.

لا تغيّر قاعدة البيانات إلى MySQL كاختصار؛ المخطط وبعض العمليات ومعالجة المهام مبنية لـ PostgreSQL، والتحويل مشروع ترحيل منفصل.

## التهيئة الموصى بها

لخفض الحمل على مساحة الاستضافة، أبقِ PostgreSQL وNeon Object Storage خارج cPanel واستخدم حسابات/حاويات منفصلة للملفات الخاصة والعامة. لا تخزّن العقود والمراسلات الخاصة في الحاوية العامة. إذا لم تسمح الخطة باتصال S3 خارجي، يمكن استخدام تخزين محلي على خادم واحد فقط، بمسار دائم خارج `public_html`، مع نسخ احتياطي مستقل للملفات.

اضبط هذه المتغيرات من لوحة التطبيق، ولا ترفع ملف `.env` إلى GitHub:

- `NODE_ENV=production`
- `DATABASE_URL` — رابط PostgreSQL مشفر TLS؛ اجعل حد الاتصال متوافقًا مع pool وعدد عمليات التطبيق.
- `DATABASE_POOL_MAX=2` أو `3` كبداية لاستضافة مشتركة.
- `AUTH_SECRET` — قيمة عشوائية طويلة وفريدة للإنتاج.
- `AUTH_URL` و`NEXTAUTH_URL` — عنوان الموقع النهائي نفسه، مثل `https://club.example.dz`؛ لا تستخدم `localhost`.
- `CRON_SECRET` و`CRON_MAX_JOBS=3`.
- `STORAGE_DRIVER=s3` و`STORAGE_ENDPOINT` و`STORAGE_REGION` و`STORAGE_ACCESS_KEY_ID` و`STORAGE_SECRET_ACCESS_KEY` و`STORAGE_PRIVATE_BUCKET` و`STORAGE_PUBLIC_BUCKET`.
- `STORAGE_PUBLIC_BASE_URL` اختياري، ويُضبط على CDN للوسائط العامة إذا كان متاحًا.

إذا تعذر S3 واستخدمت التخزين المحلي، اضبط `STORAGE_DRIVER=local` و`STORAGE_LOCAL_ROOT` على مسار مطلق دائم خارج `public_html`. سيرفض مدقق البيئة مسار التخزين المحلي المفقود أو الموجود داخل `public_html` في إعدادات الإنتاج.

## النشر

1. أنشئ staging بقاعدة بيانات وحاويات ملفات منفصلة عن الإنتاج.
2. من GitHub الخاص، افتح Actions ثم آخر تشغيل ناجح لفرع `main`، ونزّل artifact باسم `esh-cpanel-<commit>`. الحزمة لا تحتوي أي أسرار.
3. ارفع الحزمة وفكها في مجلد التطبيق خارج `public_html`، ثم أنشئ تطبيقًا من cPanel واختر Node.js ‏22.12+ وملف البدء `app.js`.
4. أضف متغيرات البيئة أعلاه، ثم شغّل التطبيق.
5. عند وجود migrations جديدة، طبّقها على staging أولًا، ثم خذ نسخة احتياطية وطبّقها على قاعدة الإنتاج باستخدام نسخة المصدر وأمر `npx prisma migrate deploy` قبل تحويل الموقع.
6. تحقق من `/api/health?type=liveness` و`/api/health?type=readiness` و`/ar` و`/fr` و`/ar/login`، ثم جرّب تسجيل الدخول ورفع/تنزيل ملف من حساب staging.
7. أضف Cron يرسل `POST` إلى `https://YOUR_DOMAIN/api/cron/process-jobs` مع `Authorization: Bearer <CRON_SECRET>`. خزن الإعداد خارج `public_html` بصلاحية قراءة للمالك فقط، ولا تضع السر في URL أو المستودع.
8. اختبر استعادة نسخة قاعدة البيانات والملفات. عند القطع للإنتاج، أوقف Cron على Cloudflare قبل تفعيله على cPanel حتى لا تتكرر المهام.

## حدود الضغط

الإعدادات تقلل الضغط غير الضروري وتحمي قاعدة البيانات من فتح pool كبير لكل عملية، لكنها لا تخلق موارد أكثر مما تشتريه الخطة. استضافة cPanel مشتركة لا يمكن اعتمادها لضغط عالٍ قبل قياس RAM وCPU والطلبات المتزامنة على نفس الخطة. إن تجاوزت المنصة حدود الخطة، يكون الحل خطة Node أعلى أو خادمًا مُدارًا؛ لا يوجد تعديل برمجي يضمن ضغطًا هائلًا على موارد مشتركة محدودة.

روابط مرجعية:

- [استضافة الويب من اتصالات الجزائر](https://www.algerietelecom.dz/en/entreprises/web-hosting-prod231)
- [متطلبات Node.js في cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/)
- [Cron في cPanel](https://docs.cpanel.net/cpanel/advanced/cron-jobs/)
- [النشر الذاتي لتطبيق Next.js](https://nextjs.org/docs/app/getting-started/deploying)
- [تشغيل Next.js ذاتيًا والتخزين المؤقت متعدد النسخ](https://nextjs.org/docs/app/guides/self-hosting)
