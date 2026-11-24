ملفات نشر بوت Yovn Streak على استضافة Python
============================================

1) ارفع محتويات هذا المجلد إلى جذر المستودع مباشرة، بحيث يكون bot.py و requirements.txt في الجذر، وليس داخل مجلد فرعي.
2) اختر Python 3.12 إن كانت الاستضافة تطلب تحديد إصدار اللغة.
3) أمر التثبيت (Build / Install): python -m pip install -r requirements.txt
4) أمر التشغيل (Start / Run): python bot.py
5) في Environment Variables أضف متغيرًا:
   Key: DISCORD_TOKEN
   Value: توكن البوت
   لا تضع التوكن داخل الملفات أو المستودع.

الملف nixpacks.toml يطلب من Nixpacks استخدام Python بدل محاولة بناء مشروع Node.js.
إذا كانت لوحة الاستضافة تحتوي على خيار Root Directory / App Directory، اجعله المجلد الذي توجد بداخله هذه الملفات مباشرة.
لا يوجد package.json لأن هذا البوت مكتوب Python وليس Node.js.
