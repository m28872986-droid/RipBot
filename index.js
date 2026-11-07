require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder, ChannelType
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN. Add it to .env");
  process.exit(1);
}

const DATA = path.join(__dirname, "data");
const CONFIG_FILE = path.join(DATA, "config.json");
const TEMPBANS_FILE = path.join(DATA, "tempbans.json");
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
const configs = readJson(CONFIG_FILE, {});
let tempBans = readJson(TEMPBANS_FILE, []);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

const aliases = {
  help: ["help", "مساعدة", "اوامر", "أوامر"],
  setup: ["setup", "إعداد", "اعداد"],
  ban: ["ban", "باند", "حظر"],
  kick: ["kick", "كيك", "طرد"],
  timeout: ["timeout", "تايم", "تايم اوت"],
  warn: ["warn", "تحذير", "انذار", "إنذار"],
  clear: ["clear", "مسح", "حذف"],
  mute: ["mute", "ميوت"],
  unmute: ["unmute", "فك_ميوت", "فك-ميوت", "فك ميوت"],
  lock: ["lock", "قفل"],
  unlock: ["unlock", "فتح"],
  protection: ["protection", "حماية"],
  logs: ["logs", "لوق", "السجلات"]
};

function getConfig(guildId) {
  if (!configs[guildId]) configs[guildId] = { adminRoles: [], logChannelId: null, protection: true, warnings: {} };
  return configs[guildId];
}
function saveConfig() { writeJson(CONFIG_FILE, configs); }
function saveTempBans() { writeJson(TEMPBANS_FILE, tempBans); }
function durationMs(input) {
  const m = /^(\d+)(s|m|h|d)$/i.exec(input || "");
  if (!m) return null;
  const n = Number(m[1]);
  return n * ({s:1000,m:60000,h:3600000,d:86400000}[m[2].toLowerCase()]);
}
function formatDuration(ms) {
  if (ms % 86400000 === 0) return `${ms / 86400000} يوم`;
  if (ms % 3600000 === 0) return `${ms / 3600000} ساعة`;
  if (ms % 60000 === 0) return `${ms / 60000} دقيقة`;
  return `${Math.round(ms / 1000)} ثانية`;
}
function hasAdminRole(member, cfg) {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return cfg.adminRoles.some(id => member.roles.cache.has(id));
}
function canAct(member, target) {
  if (member.id === member.guild.ownerId) return true;
  if (target.id === member.id || target.id === member.guild.ownerId) return false;
  return member.roles.highest.comparePositionTo(target.roles.highest) > 0;
}
async function sendLog(guild, text) {
  const cfg = getConfig(guild.id);
  if (!cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch && ch.isTextBased()) ch.send({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(text).setTimestamp()] }).catch(() => {});
}
function reply(message, text) {
  return message.reply({ content: text, allowedMentions: { repliedUser: false } }).catch(() => {});
}
function extractTarget(message, args) {
  const member = message.mentions.members.first();
  if (!member) return { member: null, rest: args };
  const mentionIndex = args.findIndex(x => x.includes(member.id));
  return { member, rest: args.filter((_, i) => i !== mentionIndex) };
}
function commandFrom(content) {
  const trimmed = content.trim();
  const withoutPrefix = trimmed.startsWith("!") ? trimmed.slice(1).trim() : trimmed;
  const lower = withoutPrefix.toLowerCase();
  // Prefer longest aliases (e.g. "فك ميوت") so multi-word commands parse correctly.
  const all = Object.entries(aliases).flatMap(([key, names]) => names.map(name => ({key, name})))
    .sort((a,b) => b.name.length - a.name.length);
  for (const item of all) {
    if (lower === item.name.toLowerCase() || lower.startsWith(item.name.toLowerCase() + " ")) {
      return { key: item.key, args: withoutPrefix.slice(item.name.length).trim().split(/\s+/).filter(Boolean) };
    }
  }
  return null;
}
function scheduleUnban(guild, userId, expiresAt) {
  const delay = Math.max(0, expiresAt - Date.now());
  setTimeout(async () => {
    try {
      await guild.members.unban(userId, "انتهاء مدة الحظر المؤقت");
      await sendLog(guild, `✅ تم فك الحظر تلقائيًا عن <@${userId}> لانتهاء المدة.`);
    } catch {}
    tempBans = tempBans.filter(x => !(x.guildId === guild.id && x.userId === userId));
    saveTempBans();
  }, Math.min(delay, 2147483647));
}
function scheduleAllTempBans() {
  for (const item of tempBans) {
    const guild = client.guilds.cache.get(item.guildId);
    if (guild) scheduleUnban(guild, item.userId, item.expiresAt);
  }
}

client.once("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
  scheduleAllTempBans();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isRoleSelectMenu() && !interaction.isChannelSelectMenu()) return;
  const [kind, guildId, userId] = interaction.customId.split(":");
  if (interaction.guildId !== guildId || interaction.user.id !== userId) {
    return interaction.reply({ content: "هذه القائمة ليست لك.", ephemeral: true }).catch(() => {});
  }
  const cfg = getConfig(guildId);
  if (kind === "setuproles" && interaction.isRoleSelectMenu()) {
    cfg.adminRoles = interaction.values;
    saveConfig();
    return interaction.update({ content: `✅ تم تحديد رتب الإدارة: ${interaction.values.map(id => `<@&${id}>`).join("، ") || "لا توجد"}\nاختر روم السجلات من القائمة التالية.`, components: [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId(`setuplogs:${guildId}:${userId}`)
          .setPlaceholder("اختر روم السجلات").addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
      )
    ] }).catch(() => {});
  }
  if (kind === "setuplogs" && interaction.isChannelSelectMenu()) {
    cfg.logChannelId = interaction.values[0];
    saveConfig();
    return interaction.update({ content: `✅ اكتمل الإعداد!\nرتب الإدارة: ${cfg.adminRoles.map(id => `<@&${id}>`).join("، ") || "لا توجد"}\nروم السجلات: <#${cfg.logChannelId}>`, components: [] }).catch(() => {});
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  const cfg = getConfig(message.guild.id);

  // Lightweight anti-spam protection
  if (cfg.protection) {
    const now = Date.now();
    const key = `${message.guild.id}:${message.author.id}`;
    spam.set(key, (spam.get(key) || []).filter(t => now - t < 7000));
    const arr = spam.get(key);
    arr.push(now); spam.set(key, arr);
    if (arr.length >= 6 && !hasAdminRole(message.member, cfg)) {
      await message.member.timeout(60_000, "مكافحة السبام").catch(() => {});
      await message.channel.send(`⚠️ تم إسكات ${message.author} لمدة دقيقة بسبب تكرار الرسائل.`).catch(() => {});
      await sendLog(message.guild, `🛡️ مكافحة السبام: تم إسكات ${message.author} لمدة دقيقة.`);
      return;
    }
  }

  const parsed = commandFrom(message.content);
  if (!parsed) return;
  const { key, args } = parsed;

  if (key === "help") {
    const e = new EmbedBuilder().setColor(0x5865F2).setTitle("📚 قائمة أوامر البوت").setDescription(
      "**الإعداد**\n`!setup` — تحديد رتب الإدارة وروم السجلات.\n`!help` — عرض هذه القائمة.\n\n" +
      "**الإدارة**\n`باند @عضو 1d السبب` — حظر يومًا ثم فكّه تلقائيًا.\n`كيك @عضو السبب` — طرد عضو.\n`تايم @عضو 10m السبب` — إسكات مؤقت.\n`تحذير @عضو السبب` — تسجيل تحذير.\n`مسح 20` — حذف عدد من الرسائل.\n`ميوت @عضو 10m` — إسكات مؤقت.\n`فك ميوت @عضو` — إزالة الإسكات.\n`قفل` / `فتح` — قفل أو فتح الروم الحالي.\n\n" +
      "**الحماية**\n`حماية تشغيل` / `حماية إيقاف` — تشغيل أو إيقاف مكافحة السبام.\n`لوق` — عرض روم السجلات.\n\n" +
      "**ملاحظة:** كل أمر يقبل `!` أو بدونها، وبالعربي أو الاسم الإنجليزي. مثال: `!ban` أو `ban` أو `باند`."
    ).setFooter({ text: "استخدم الأوامر داخل السيرفر" });
    return message.reply({ embeds: [e] }).catch(() => {});
  }

  if (key === "setup") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
      return reply(message, "❌ أمر الإعداد متاح لمالك السيرفر أو لمن لديه Administrator فقط.");
    }
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(`setuproles:${message.guild.id}:${message.author.id}`)
        .setPlaceholder("اختر رتب الإدارة المسموح لها").setMinValues(1).setMaxValues(10)
    );
    return message.reply({ content: "⚙️ **إعداد البوت**\nاختر رتب الإدارة التي تستطيع استخدام أوامر البوت:", components: [row] }).catch(() => {});
  }

  if (key === "logs") return reply(message, cfg.logChannelId ? `📋 روم السجلات: <#${cfg.logChannelId}>` : "لم يتم تحديد روم السجلات. استخدم !setup.");

  if (key === "protection") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return reply(message, "❌ تحتاج صلاحية Administrator.");
    const action = (args[0] || "").toLowerCase();
    if (["تشغيل", "on", "enable"].includes(action)) cfg.protection = true;
    else if (["إيقاف", "ايقاف", "off", "disable"].includes(action)) cfg.protection = false;
    else return reply(message, "استخدم: `حماية تشغيل` أو `حماية إيقاف`");
    saveConfig();
    return reply(message, `✅ تم ${cfg.protection ? "تشغيل" : "إيقاف"} مكافحة السبام.`);
  }

  if (!hasAdminRole(message.member, cfg)) return reply(message, "❌ رتبتك غير مضافة ضمن رتب الإدارة. اطلب من مالك السيرفر ضبط !setup.");
  const reason = args.join(" ") || "لم يتم تحديد سبب";
  const { member: target, rest } = extractTarget(message, args);

  if (key === "ban") {
    if (!target) return reply(message, "الاستخدام: `باند @عضو 1d السبب` أو `باند @عضو السبب`");
    if (!canAct(message.member, target)) return reply(message, "❌ لا يمكنك معاقبة هذا العضو بسبب ترتيب الرتب.");
    const durationToken = rest[0] && durationMs(rest[0]) ? rest[0] : null;
    const banReason = (durationToken ? rest.slice(1) : rest).join(" ") || "لم يتم تحديد سبب";
    await target.ban({ reason: banReason }).then(async () => {
      if (durationToken) {
        const expiresAt = Date.now() + durationMs(durationToken);
        tempBans = tempBans.filter(x => !(x.guildId === message.guild.id && x.userId === target.id));
        tempBans.push({ guildId: message.guild.id, userId: target.id, expiresAt });
        saveTempBans(); scheduleUnban(message.guild, target.id, expiresAt);
      }
      await reply(message, `✅ تم حظر ${target.user.tag}${durationToken ? ` لمدة ${formatDuration(durationMs(durationToken))}` : " بشكل دائم"}.`);
      await sendLog(message.guild, `🔨 باند: ${target.user.tag}\nالمنفذ: ${message.author}\nالسبب: ${banReason}`);
    }).catch(() => reply(message, "❌ فشل الحظر. تأكد من صلاحية البوت وترتيب الرتب."));
    return;
  }

  if (key === "kick" || key === "timeout" || key === "warn" || key === "mute" || key === "unmute") {
    if (!target) return reply(message, `الاستخدام: \`${aliases[key][1] || aliases[key][0]} @عضو\``);
    if (key !== "unmute" && !canAct(message.member, target)) return reply(message, "❌ لا يمكنك تنفيذ ذلك بسبب ترتيب الرتب.");
    if (key === "kick") {
      await target.kick(reason).then(() => reply(message, `✅ تم طرد ${target.user.tag}.`)).catch(() => reply(message, "❌ فشل الطرد."));
      await sendLog(message.guild, `👢 كيك: ${target.user.tag}\nالمنفذ: ${message.author}\nالسبب: ${reason}`);
    } else if (key === "timeout" || key === "mute") {
      const d = durationMs(rest[0]) || 600000;
      const why = rest.length > 1 ? rest.slice(1).join(" ") : reason;
      await target.timeout(Math.min(d, 28 * 86400000), why).then(() => reply(message, `✅ تم إسكات ${target.user.tag} لمدة ${formatDuration(Math.min(d, 28 * 86400000))}.`)).catch(() => reply(message, "❌ فشل الإسكات."));
      await sendLog(message.guild, `🔇 تايم: ${target.user.tag}\nالمدة: ${formatDuration(Math.min(d, 28 * 86400000))}\nالسبب: ${why}`);
    } else if (key === "unmute") {
      await target.timeout(null, "فك الميوت").then(() => reply(message, `✅ تم فك الميوت عن ${target.user.tag}.`)).catch(() => reply(message, "❌ فشل فك الميوت."));
    } else {
      cfg.warnings[target.id] = (cfg.warnings[target.id] || 0) + 1; saveConfig();
      await reply(message, `⚠️ تم تحذير ${target.user.tag}. عدد تحذيراته: ${cfg.warnings[target.id]}.`);
      await sendLog(message.guild, `⚠️ تحذير: ${target.user.tag}\nالمنفذ: ${message.author}\nالسبب: ${reason}`);
    }
    return;
  }

  if (key === "clear") {
    const count = Number(args[0]);
    if (!Number.isInteger(count) || count < 1 || count > 100) return reply(message, "الاستخدام: `مسح 1` إلى `مسح 100`.");
    const deleted = await message.channel.bulkDelete(count, true).catch(() => null);
    if (!deleted) return reply(message, "❌ تعذر المسح. قد تكون بعض الرسائل أقدم من 14 يومًا.");
    const notice = await message.channel.send(`✅ تم حذف ${deleted.size} رسالة.`).catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 4000);
    await sendLog(message.guild, `🧹 مسح: ${deleted.size} رسالة في ${message.channel}. المنفذ: ${message.author}`);
    return;
  }

  if (key === "lock" || key === "unlock") {
    const locked = key === "lock";
    const channel = message.channel;

    // Threads do not have their own permissionOverwrites; use the parent channel if needed.
    const targetChannel = channel.isThread?.() ? channel.parent : channel;
    if (!targetChannel || !targetChannel.permissionOverwrites) {
      return reply(message, "❌ هذا الأمر يعمل في الرومات النصية العادية فقط.");
    }

    const updated = await targetChannel.permissionOverwrites
      .edit(message.guild.roles.everyone, { SendMessages: !locked })
      .catch(() => null);

    if (!updated) {
      return reply(message, "❌ تعذر تعديل صلاحيات الروم. تأكد من صلاحية Manage Channels.");
    }

    await reply(message, locked ? "🔒 تم قفل الروم." : "🔓 تم فتح الروم.");
    await sendLog(message.guild, `${locked ? "🔒 قفل" : "🔓 فتح"} الروم ${targetChannel} بواسطة ${message.author}`);
    return;
  }
});

const spam = new Map();

client.on("guildAuditLogEntryCreate", async (entry, guild) => {
  const cfg = getConfig(guild.id);
  if (!cfg.protection) return;
  const risky = [
    "ChannelDelete", "RoleDelete", "MemberBanAdd", "WebhookCreate",
    "WebhookDelete", "BotAdd"
  ];
  if (!risky.includes(entry.action)) return;
  const executorId = entry.executorId;
  if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;
  const executor = await guild.members.fetch(executorId).catch(() => null);
  if (!executor) return;
  // Log suspicious destructive actions; do not automatically ban admins to avoid false positives.
  await sendLog(guild, `🚨 **تنبيه حماية**\nنوع الحدث: ${entry.action}\nالمنفذ: <@${executorId}>\nتم تسجيل الحدث للمراجعة. راجع صلاحيات الإدارة يدويًا.`);
});

client.login(TOKEN);
