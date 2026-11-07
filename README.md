# RipBot

## تشغيل محلي
1. ثبّت Node.js 20 أو أحدث.
2. نفّذ `npm install`.
3. انسخ `.env.example` إلى `.env` وضع توكن البوت في `DISCORD_TOKEN`.
4. ضع نص حساب تيك في `data/config.json` داخل `accountInfo`.
5. شغّل `npm start`.

## Render
- أنشئ Web Service أو Worker حسب طريقة استضافتك.
- Build Command: `npm install`
- Start Command: `npm start`
- أضف متغير البيئة `DISCORD_TOKEN` من لوحة Render.
- فعّل Message Content Intent وServer Members Intent من Discord Developer Portal عند الحاجة.

## الأوامر
- Administrator فقط: `!help`, `!setup`, `!تيك`, `!فيلنق`, `!زاجل`.
- الرتب المحددة من `!setup` أو Administrator: `!شروط`, `!رتب`, `!addrole @role السعر`, `!removerole @role`.
- `!بوت` غير موجود.

تُحفظ الرتب والأسعار في `data/config.json` بعد إعادة التشغيل.
