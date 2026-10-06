# تجهيز المنصة لاستضافة cPanel

تطبيق النادي ليس موقعًا ثابتًا أو WordPress. يمكنه العمل على cPanel **فقط إذا فعّل مزود الاستضافة ميزات Node.js المطلوبة ووفّر PostgreSQL أو اتصالًا خارجيًا بها**. اسم cPanel وحده لا يضمن هذه الميزات.

## التغييرات المضافة للمشروع

- مخرج Next.js مستقل أخف نسبيًا، مع أمر `npm run build:cpanel` ينسخ ملفات `public` و`.next/static` إلى حزمة التشغيل.
- ملف `app.js` كنقطة تشغيل لـ cPanel/Passenger، وأمر `npm run start:cpanel` للتشغيل المحلي التجريبي.
- مسار تخزين محلي قابل للتحديد عبر `STORAGE_LOCAL_ROOT` بحيث تبقى الملفات خارج مجلد نشر الشيفرة.
- تشغيل المهام المجدولة عبر `POST /api/cron/process-jobs` بدل إبقاء daemon دائم، مع تحديد حجم الدفعة عبر `CRON_MAX_JOBS`.
- تعطيل تكامل Ollama المحلي افتراضيًا في `.env.example`؛ لا تشغّل نموذجًا محليًا على خطة cPanel مشتركة.

## شروط يجب أن يؤكدها المزود كتابةً قبل الشراء

1. **Node.js:** لوحة cPanel تعرض Node.js Application Manager/Passenger، وتسمح بـ Node.js 22.12 أو أحدث. المشروع يعلن `node >=22.12.0`.
2. **PostgreSQL:** قاعدة PostgreSQL 14+ واتصال TLS. ذكر عدد قواعد البيانات في لوحة cPanel لا يثبت أنها PostgreSQL؛ MySQL/MariaDB وحدها لا تكفي لهذا المشروع.
3. **موارد التشغيل:** حد RAM وCPU يكفيان لتشغيل Next.js. تأكد أيضًا من أن الخطة تسمح ببناء التطبيق، أو استخدم حزمة البناء المنتجة مسبقًا. حد مساحة 10GB مثلًا قد يضيق مع ملفات البناء والاعتماديات والوسائط.
4. **Cron:** السماح بجدولة طلب HTTPS إلى `/api/cron/process-jobs` كل دقيقة أو كل خمس دقائق، وحد مهلة الطلب يسمح بإنهاء دفعة المهام.
5. **الملفات:** مساحة دائمة قابلة للكتابة خارج `public_html`، ونسخ احتياطية تشمل الملفات المرفوعة لا قاعدة البيانات فقط.
6. **الشبكة والرفع:** HTTPS، عنوان عام ونطاق، منافذ الخروج اللازمة إلى PostgreSQL إن كانت خارجية، وحد رفع مناسب للصور والفيديو والوثائق.

إذا لم يوفر المزود PostgreSQL على الخطة، يمكن نظريًا استخدام PostgreSQL خارجي بشرط السماح باتصال TLS صادر. هذا يعني خدمة وفاتورة إضافيتين. لا تغيّر قاعدة المشروع إلى MySQL كاختصار: المخطط والخدمات وبعض العمليات ومعالجة المهام مكتوبة لـ PostgreSQL، والتحويل يحتاج مشروع ترحيل منفصلًا واختبارات بيانات وتكامل.

## خطوات النشر في cPanel

1. اربط مستودع GitHub الخاص من أداة **Git Version Control** أو حمّل نسخة الإصدار. اجعل مجلد التطبيق خارج `public_html`.
2. أنشئ تطبيق Node.js من **Application Manager**، اختر Node.js 22.12+، وحدد مجلد المشروع وملف التشغيل `app.js`.
3. أضف متغيرات البيئة في إعداد التطبيق: `NODE_ENV=production`, `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `CRON_SECRET`, `CRON_MAX_JOBS=3`, `STORAGE_DRIVER=local`, و`STORAGE_LOCAL_ROOT=/home/CPANEL_USER/esh-storage`. استخدم اسم حساب cPanel والمسار المطلق الفعلي. لا تضع المجلد تحت `public_html` أو مجلد الإصدار.
4. أنشئ مجلدي `private` و`public` تحت `STORAGE_LOCAL_ROOT` واجعل صلاحياتهما مقصورة على حساب التطبيق.
5. من Terminal الخاص بحساب cPanel نفّذ:

   ```sh
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npm run build:cpanel
   npm prune --omit=dev
   ```

   نفّذ الترحيلات على قاعدة staging أولًا، وخذ نسخة احتياطية قبل ترحيلات الإنتاج.
6. شغّل التطبيق من لوحة cPanel، ثم تحقق من `/api/health`, `/ar`, `/fr` و`/ar/login`. بعد كل نشر جديد أعد البناء ثم أعد تشغيل التطبيق.
7. أضف Cron آمنًا إلى واجهة cPanel. أنشئ ملف إعداد curl خارج `public_html` بصلاحية قراءة للمالك فقط، ويحتوي عنوان المنصة و`Authorization: Bearer <CRON_SECRET>`. شغّله كل دقيقة أو حسب الحد الذي يؤكده المزود:

   ```sh
   /usr/bin/curl --config /home/CPANEL_USER/.esh-cron.curl --silent --show-error --fail >/dev/null
   ```

   واضبط محتوى الملف لإرسال `POST` إلى `https://YOUR_DOMAIN/api/cron/process-jobs`. لا تضع السر داخل عنوان URL أو مستودع Git.
8. فعّل نسخًا احتياطية لقاعدة PostgreSQL ولمجلد `STORAGE_LOCAL_ROOT`، ونفّذ تجربة استعادة فعلية. نسخة قاعدة البيانات لا تحتوي تلقائيًا على المرفقات.

## قرار الملاءمة

يتيح Next.js التشغيل الذاتي على Node.js؛ كما يدعم cPanel تشغيل تطبيقات Node عبر Passenger عندما يفعّل المزود هذه الخاصية. هذا يجعل cPanel **خيارًا مشروطًا**، وليس ضمانًا بأن باقة اتصالات الجزائر ستشغل المشروع بسلاسة. صفحة الاستضافة المشتركة تعرض cPanel ومساحة وقواعد بيانات ونطاقًا، لكنها لا تحدد إصدار Node أو نوع قاعدة البيانات أو حدود الموارد. احصل على تأكيد هذه الشروط قبل الدفع، ثم اختبر على staging وحمل استخدام مماثل قبل نقل بيانات النادي.

روابط مرجعية:

- [استضافة الويب من اتصالات الجزائر](https://www.algerietelecom.dz/en/entreprises/web-hosting-prod231)
- [متطلبات Node.js في cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/)
- [Cron في cPanel](https://docs.cpanel.net/cpanel/advanced/cron-jobs/)
- [النشر الذاتي لتطبيق Next.js](https://nextjs.org/docs/app/getting-started/deploying)
