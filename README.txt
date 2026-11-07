RipBot - ملفات جديدة

التشغيل:
1) ارفع الملفات إلى GitHub.
2) في Render اختر Node Environment واضبط Start Command على: npm start
3) أضف Environment Variables التالية:
   DISCORD_TOKEN = توكن البوت
   STAFF_ROLE_ID = 1549461212348153856 (يمكن تغييره)
   TIKTOK_EMAIL = إيميل الحساب (اختياري لأمر !تيك)
   TIKTOK_PASSWORD = كلمة المرور (اختياري لأمر !تيك)
4) فعّل Message Content Intent و Server Members Intent من Discord Developer Portal.

الأوامر:
!help
!رتب
!addrole @role السعر
!removerole @role
!شروط
!تيك
!فيلنق نص الرسالة
!زاجل نص الرسالة

الصلاحيات:
- !رتب و !addrole و !removerole و !شروط: رتبة Staff Team المحددة في STAFF_ROLE_ID أو Administrator.
- !تيك و !فيلنق و !زاجل: Administrator فقط.

ملاحظات:
- قائمة الرتب وأسعارها تحفظ في data/roles.json وتبقى بعد إعادة تشغيل البوت إذا كان تخزين الاستضافة مستمرًا.
- أمر !تيك يرسل بيانات الحساب في الخاص ولا ينشرها في الروم. لا تضع بيانات حساسة في قناة عامة.
- أمرا !فيلنق و !زاجل يعرضان واجهة خدمة بأزرار Send و Toggle Off و Reply. زر Send يفتح نموذج إرسال، وReply يطلب رقم الرسالة ونص الرد. Toggle Off يبدّل إظهار اسم المرسل أو إخفاءه. هذه الواجهة الأساسية قابلة لتعديل النص والتصميم لاحقًا.
