# YOVN Streak Bot

## التجهيز
1. افتح ملف `config.json`.
2. استبدل `PUT_BOT_TOKEN_HERE` بتوكن البوت الخاص بك بين علامتي الاقتباس. لا ترسل التوكن لأحد.
3. شغّل تثبيت الحزم: `npm install`
4. فعّل Message Content Intent و Server Members Intent من Discord Developer Portal.
5. شغّل البوت: `npm start`

## الاستضافة
- Build / Install: `npm install`
- Start: `npm start`
- لا تحتاج Environment Variables أو ملف `.env`؛ التوكن موجود في `config.json`.

## الإعدادات الافتراضية
- Guild: `1564995425331847341`
- Streak channel: `1575286097121120277`
- Timezone: `Asia/Riyadh`
- Reminder: `23:59`

## الأوامر
- `-top` قائمة المتصدرين
- `-reset @user` تصفير عضو (للمسؤول)
- `-resetall` تصفير الجميع (للمسؤول)
- `-add @user 10` إضافة أيام (للمسؤول)
- `-set @user 20` تحديد الأيام (للمسؤول)
- `-remind` إرسال التذكير الآن (للمسؤول)
- `-stats` الإحصائيات (للمسؤول)
- `-channel #room` تحديد روم الستريك (للمسؤول)
- `-time 23:59` تحديد وقت التذكير (للمسؤول)
- `-help` عرض الأوامر

## النظام
يُحتسب فقط إرسال الصور والمقاطع والملصقات في روم الستريك المحدد. الرسائل النصية وحدها لا تُحتسب. أول صورة/ملصق في كل يوم بتوقيت الرياض يحدّث الستريك، والإرسال المتكرر في اليوم نفسه لا يزيده. تُحفظ البيانات في `streaks.json` والإعدادات في `settings.json`.
