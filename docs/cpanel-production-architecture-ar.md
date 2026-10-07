# معمارية الإنتاج لاستضافة cPanel/MariaDB

## الاختيار المقترح

العرض **Golden** هو الحد الأدنى العملي لهذه المنصة: 300GB، نقل غير محدود،
cPanel، وقواعد MySQL/MariaDB. العرض Starter يصلح لموقع عام بسيط، لكنه غير مناسب
للوحة إدارة النادي والوثائق والنسخ الاحتياطية معاً ما لم يؤكد المزود موارد CPU/RAM
كافية لعملية Node.js.

## مكونات التشغيل

- Node.js 22 CommonJS عبر cPanel Passenger لتشغيل Next.js standalone.
- MariaDB عبر Prisma client مولد من `prisma/schema.mysql.prisma`.
- `DATABASE_PROVIDER=mysql` في بيئة cPanel فقط؛ نسخة Cloudflare تبقى على PostgreSQL.
- تخزين الملفات الخاصة في مسار خارج `public_html`، والملفات العامة في مسار وسائط
  مضبوط، مع النسخ الاحتياطية اليومية لدى المزود.
- Cron كل دقيقة أو خمس دقائق لمعالجة المهام، بدلاً من عامل Node دائم.
- التحديثات الفورية عبر polling خفيف ومحدود؛ WebSocket دائم غير مضمون على الاستضافة
  المشتركة ولا يُستخدم كأساس للنظام.

## بناء الحزمة

```bash
npm ci
npm run build:cpanel:mysql
```

الناتج هو `release/cpanel`. يُرفع محتواه إلى تطبيق Node.js في cPanel، ويُضبط
ملف البيئة من لوحة cPanel، ثم يُشغّل `app.js`.

## متغيرات cPanel الأساسية

```dotenv
NODE_ENV=production
DEPLOY_TARGET=cpanel
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://user:password@127.0.0.1:3306/club_database
AUTH_URL=https://domain.example
AUTH_SECRET=<random-secret>
STORAGE_DRIVER=local
STORAGE_LOCAL_ROOT=/home/CPANEL_USER/esh-private-storage
PUBLIC_SITE_ONLY=false
```

لا توضع كلمات المرور أو ملفات `.env` في GitHub. يجب إنشاء قاعدة MariaDB فارغة،
تطبيق مخطط الهجرة، ثم استيراد التصدير المتحقق منه قبل فتح الموقع للجمهور.

## حدود واقعية

الاستضافة المشتركة لا تضمن 24/24 إذا أوقف المزود عملية Node أو خنق الموارد. لذلك
يجب تفعيل Passenger والنسخ الاحتياطي ومراقبة الصحة، واختيار Golden أو أعلى، وعدم
تشغيل الذكاء المحلي أو تحويل الملفات الثقيلة داخل طلب الويب.
