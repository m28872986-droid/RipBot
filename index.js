const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require("discord.js");

const BOT_CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const TOKEN = BOT_CONFIG.token;
const PREFIX = "-";
const TZ = "Asia/Riyadh";
const DEFAULT_GUILD = "1564995425331847341";
const DEFAULT_CHANNEL = "1564997590532096030";
const DATA = path.join(__dirname, "streaks.json");
const SETTINGS = path.join(__dirname, "settings.json");

if (!TOKEN || TOKEN === "PUT_BOT_TOKEN_HERE") { console.error("ضع توكن البوت في config.json ثم أعد التشغيل."); process.exit(1); }

const client = new Client({ intents: [
  GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent
] });

function readJson(file, fallback) {
  try { const v = JSON.parse(fs.readFileSync(file, "utf8")); return v && typeof v === "object" ? v : fallback; }
  catch { return fallback; }
}
function save(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
let streaks = readJson(DATA, {});
let settings = readJson(SETTINGS, { [DEFAULT_GUILD]: { channelId: DEFAULT_CHANNEL, reminderTime: "23:59" } });
if (!settings[DEFAULT_GUILD]) { settings[DEFAULT_GUILD] = { channelId: DEFAULT_CHANNEL, reminderTime: "23:59" }; save(SETTINGS, settings); }
const config = id => settings[id] || { channelId: DEFAULT_CHANNEL, reminderTime: "23:59" };
const setConfig = (id, patch) => { settings[id] = { ...config(id), ...patch }; save(SETTINGS, settings); };
const key = (g, u) => `${g}:${u}`;
const get = (g, u) => streaks[key(g, u)] || null;
const put = (g, u, value) => { streaks[key(g, u)] = value; save(DATA, streaks); };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const yesterday = () => {
  const d = new Date(`${today()}T12:00:00+03:00`); d.setDate(d.getDate()-1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
};
const makeEmbed = (title, description, color=0x5865F2) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
const isAdmin = m => m?.permissions?.has(PermissionsBitField.Flags.Administrator);
async function getChannel(guild) { return guild.channels.fetch(config(guild.id).channelId).catch(() => null); }
function hasImage(message) {
  return message.stickers.size > 0 || message.attachments.some(a =>
    (a.contentType || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(a.name || "")
  );
}
async function processStreak(message) {
  if (message.author.bot || !message.guild || message.channelId !== config(message.guild.id).channelId || !hasImage(message)) return;
  const day = today(), old = get(message.guild.id, message.author.id);
  if (old?.lastActive === day) {
    await message.react("⚠️").catch(() => {});
    return message.channel.send({ embeds:[makeEmbed("الستريك مُحدّث بالفعل", `${message.author}\n\nستريكك الحالي: **🔥 ${old.streak} 🔥**`, 0xFEE75C)] });
  }
  const count = old && old.lastActive === yesterday() ? old.streak + 1 : 1;
  put(message.guild.id, message.author.id, { streak:count, lastActive:day });
  await message.react("✅").catch(() => {});
  await message.channel.send({ embeds:[makeEmbed("تم تحديث الستريك!", `${message.author}\n\n# 🔥 ${count} 🔥`, 0x57F287)] });
}
async function sendReminders(guild, day=today()) {
  const channel = await getChannel(guild);
  const pending = Object.entries(streaks).filter(([k,v]) => k.startsWith(`${guild.id}:`) && v.streak>0 && v.lastActive!==day)
    .map(([k,v]) => ({ userId:k.split(":")[1], streak:v.streak }));
  if (!pending.length) {
    if (channel?.isTextBased()) await channel.send({ embeds:[makeEmbed("تذكير الستريك", "🎉 جميع الأعضاء حدثوا ستريكاتهم اليوم!", 0x57F287)] }).catch(()=>{});
    return;
  }
  const link = `https://discord.com/channels/${guild.id}/${config(guild.id).channelId}`;
  for (const p of pending) {
    const member = await guild.members.fetch(p.userId).catch(()=>null);
    if (member) await member.send({ embeds:[makeEmbed("🔥 لا تنسى ستريكك!", `# باقي وقت قليل!\n\nلا تنسى تحدث ستريكك قبل نهاية اليوم.\n\n**ستريكك الحالي: 🔥 ${p.streak} 🔥**\n\n[اضغط هنا لتحديث الستريك](${link})`, 0x57F287)] }).catch(()=>{});
  }
  if (channel?.isTextBased()) await channel.send({ embeds:[makeEmbed("تذكير الستريك", `**إجمالي الأعضاء:** ${pending.length}\n\n${pending.map((p,i)=>`${i+1}. <@${p.userId}> — 🔥 **${p.streak}**`).join("\n")}`, 0x57F287)] }).catch(()=>{});
}
async function expire(guild, day=yesterday()) {
  const channel = await getChannel(guild);
  const expired = Object.entries(streaks).filter(([k,v]) => k.startsWith(`${guild.id}:`) && v.streak>0 && v.lastActive!==day)
    .map(([k,v]) => ({ userId:k.split(":")[1], streak:v.streak, lastActive:v.lastActive }));
  for (const p of expired) {
    put(guild.id, p.userId, { streak:0, lastActive:p.lastActive || null });
    const member = await guild.members.fetch(p.userId).catch(()=>null);
    if (member) {
      const link = `https://discord.com/channels/${guild.id}/${config(guild.id).channelId}`;
      await member.send({ embeds:[makeEmbed("❌ انتهى الستريك", `# ❌ انتهى الستريك\n\nانتهت مدة تحديث الستريك الخاص بك.\n\n**الستريك السابق: ${p.streak} يوم**\n\n[ابدأ ستريك جديد من هنا](${link})`, 0xED4245)] }).catch(()=>{});
    }
  }
  if (channel?.isTextBased() && expired.length) await channel.send({ embeds:[makeEmbed("❌ انتهاء الستريك", `**إجمالي الأعضاء:** ${expired.length}\n\n${expired.map((p,i)=>`${i+1}. <@${p.userId}> — كان **${p.streak}** 🔥`).join("\n")}`, 0xED4245)] }).catch(()=>{});
}
async function command(message) {
  const [cmd, ...args] = message.content.slice(1).trim().split(/\s+/);
  const guildId = message.guild.id;
  const admin = isAdmin(message.member);
  const guard = async () => { if (!admin) await message.reply({ embeds:[makeEmbed("صلاحيات غير كافية", "هذا الأمر يتطلب صلاحية **Administrator**.", 0xED4245)] }); return admin; };
  if (cmd === "top") {
    const rows = Object.entries(streaks).filter(([k,v])=>k.startsWith(`${guildId}:`)&&v.streak>0).sort((a,b)=>b[1].streak-a[1].streak).slice(0,20);
    const medals=["🥇","🥈","🥉"], lines=rows.map(([k,v],i)=>`${medals[i]||`\`${i+1}.\``} <@${k.split(":")[1]}> — **${v.streak}** 🔥`);
    return message.channel.send({ embeds:[makeEmbed("🏆 ترتيب الستريكات", lines.join("\n") || "ما فيه ستريكات مسجلة حاليًا.")] });
  }
  if (cmd === "help") return message.channel.send({ embeds:[makeEmbed("Yovn Streak — الأوامر", "**للأعضاء**\n`-top` عرض ترتيب الستريكات.\n\n**للإدارة (Administrator فقط)**\n`-reset @user` تصفير ستريك عضو\n`-resetall` تصفير الجميع\n`-add @user 10` إضافة أيام\n`-set @user 20` تحديد الأيام\n`-remind` إرسال التذكير\n`-stats` الإحصائيات\n`-channel #room` تحديد الروم\n`-time 23:59` وقت التذكير")] });
  if (!["reset","resetall","add","set","remind","stats","channel","time"].includes(cmd) || !await guard()) return;
  if (cmd === "reset") {
    const m=message.mentions.members.first(); if(!m) return message.reply("استخدم: `-reset @user`");
    put(guildId,m.id,{streak:0,lastActive:null}); return message.channel.send({embeds:[makeEmbed("تم تصفير الستريك",`تم تصفير ستريك ${m}.`,0xFAA61A)]});
  }
  if (cmd === "resetall") {
    for(const k of Object.keys(streaks)) if(k.startsWith(`${guildId}:`)) delete streaks[k];
    save(DATA,streaks); return message.channel.send({embeds:[makeEmbed("تم تصفير جميع الستريكات","تم تصفير ستريكات جميع الأعضاء.",0xED4245)]});
  }
  if (cmd==="add"||cmd==="set") {
    const m=message.mentions.members.first(), amount=Number(args.find(x=>/^\d+$/.test(x)));
    if(!m||!Number.isSafeInteger(amount)||amount<(cmd==="add"?1:0)) return message.reply(`استخدم: \`-${cmd} @user ${cmd==="add"?"10":"20"}\``);
    const old=get(guildId,m.id), value=cmd==="add"?(old?.streak||0)+amount:amount;
    put(guildId,m.id,{streak:value,lastActive:old?.lastActive||today()});
    return message.channel.send({embeds:[makeEmbed(cmd==="add"?"تمت إضافة أيام":"تم تعديل الستريك",`ستريك ${m} أصبح **${value}** 🔥`,0x57F287)]});
  }
  if (cmd==="channel") {
    const ch=message.mentions.channels.first(); if(!ch||!ch.isTextBased()) return message.reply("استخدم: `-channel #room`");
    setConfig(guildId,{channelId:ch.id}); return message.channel.send({embeds:[makeEmbed("تم تحديد روم الستريك",`الروم المعتمد: ${ch}`,0x57F287)]});
  }
  if (cmd==="time") {
    const t=args[0]||""; if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)) return message.reply("اكتب الوقت بصيغة `HH:MM` مثل `23:59`.");
    setConfig(guildId,{reminderTime:t}); return message.channel.send({embeds:[makeEmbed("تم تغيير وقت التذكير",`وقت التذكير الجديد: **${t}** بتوقيت السعودية.`,0x57F287)]});
  }
  if (cmd==="stats") {
    const rows=Object.entries(streaks).filter(([k,v])=>k.startsWith(`${guildId}:`)&&v.streak>0);
    return message.channel.send({embeds:[makeEmbed("إحصائيات الستريك",`الأعضاء أصحاب الستريكات: **${rows.length}**\nمجموع أيام الستريك: **${rows.reduce((s,[,v])=>s+v.streak,0)}** 🔥`)]});
  }
  if (cmd==="remind") { await sendReminders(message.guild); return message.reply("تم إرسال التذكير."); }
}
client.once("ready",()=>{
  console.log(`Logged in as ${client.user.tag}`);
  cron.schedule("* * * * *",async()=>{
    const time=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
    for(const guild of client.guilds.cache.values()){
      if(time===config(guild.id).reminderTime) await sendReminders(guild);
      if(time==="00:01") await expire(guild);
    }
  },{timezone:TZ});
  console.log("Yovn Streak scheduler started (Asia/Riyadh).");
});
client.on("messageCreate",async message=>{
  if(!message.guild||message.author.bot) return;
  if(message.content.startsWith(PREFIX)) try { await command(message); } catch(e) { console.error("Command error:",e); await message.reply("حدث خطأ أثناء تنفيذ الأمر.").catch(()=>{}); }
  try { await processStreak(message); } catch(e) { console.error("Streak error:",e); }
});
client.login(TOKEN);
