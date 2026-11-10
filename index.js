require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, AttachmentBuilder, ChannelType
} = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN. Add it to your hosting environment variables or .env file.');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const PRIVATE_ROLES_PATH = path.join(DATA_DIR, 'privateRoles.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const PRIVATE_ROLE_ANNOUNCE_CHANNEL = '1569172551735840848';
const PRIVATE_ROLE_LOG_CHANNEL = '1569171996330303508';
const MUSIC_VOICE_CHANNEL_ID = '1564997033025081445';
let privateRoles = {};
function loadPrivateRoles() {
  try { privateRoles = JSON.parse(fs.readFileSync(PRIVATE_ROLES_PATH, 'utf8')); }
  catch { privateRoles = {}; }
}
function savePrivateRoles() {
  fs.writeFileSync(PRIVATE_ROLES_PATH, JSON.stringify(privateRoles, null, 2));
}
loadPrivateRoles();
const defaultConfig = {
  allowedRoles: [],
  accountInfo: 'ضع معلومات الحساب هنا داخل config.json',
  feelingChannelId: '',
  zajelChannelId: '',
  rolePrices: {},
  autoReplies: {},
  autoReactions: {},
  fontImageUrl: 'https://cdn.discordapp.com/attachments/1566133988211429376/1569489205816598650/IMG_2958.png?ex=6af3a43a&is=6af252ba&hm=2b4cb7f7ee8d00cfaa7ca860fc7c5ff6e0dd2e30e9136d3862b1662ffc071efa&',
  musicVoiceChannelId: '1564997033025081445',
  musicDefaultVolume: 100
};
function readConfig() {
  try { return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }; }
  catch { return { ...defaultConfig }; }
}
let config = readConfig();
function saveConfig() { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
  partials: [Partials.Channel]
});
const player = new Player(client);
player.events.on('playerStart', (queue, track) => {
  const channel = queue.metadata?.channel;
  if (channel) channel.send(`🎶 **يشغّل الآن:** ${track.title}`).catch(() => null);
});
player.events.on('error', (queue, error) => console.error('Music player error:', error));
player.events.on('playerError', (queue, error) => console.error('Music track error:', error));
const ADMIN_ONLY = new Set(['help', 'setup', 'teek', 'addrd', 'delrd', 'editrd', 'listrd', 'addreact', 'delreact', 'listreact', 'fontImage', 'removeBg']);
// These commands are intentionally available to every server member.
const PUBLIC_COMMANDS = new Set(['feeling', 'zajel']);
const aliases = new Map([
  ['help', 'help'], ['مساعدة', 'help'],
  ['setup', 'setup'], ['اعداد', 'setup'], ['إعداد', 'setup'],
  ['تيك', 'teek'],
  ['فيلنق', 'feeling'], ['feeling', 'feeling'],
  ['زاجل', 'zajel'], ['zajel', 'zajel'],
  ['شروط', 'conditions'],
  ['رتب', 'roles'],
  ['addrole', 'addrole'], ['removerole', 'removerole'],
  ['addrd', 'addrd'], ['اضفرد', 'addrd'], ['أضفرد', 'addrd'],
  ['delrd', 'delrd'], ['حذفرد', 'delrd'],
  ['editrd', 'editrd'], ['تعديلرد', 'editrd'],
  ['listrd', 'listrd'], ['الردود', 'listrd'],
  ['addreact', 'addreact'], ['اضفرياكشن', 'addreact'], ['addreaction', 'addreact'],
  ['delreact', 'delreact'], ['حذفرياكشن', 'delreact'], ['removereaction', 'delreact'],
  ['listreact', 'listreact'], ['الرياكشنات', 'listreact'],
  ['خط', 'fontImage'], ['الصورة', 'fontImage'],
  ['قص', 'removeBg'], ['ازالةالخلفية', 'removeBg'],
  ['role', 'privateRoleWizard'], ['رول', 'privateRoleWizard'],
  ['myrole', 'myrole'], ['رولي', 'myrole'], ['رتبتي', 'myrole'],
  ['تجديد', 'renewPrivateRole'], ['renew', 'renewPrivateRole'],
  ['رتبتي', 'myrole'],
  ['ش', 'musicPlay'], ['شغل', 'musicPlay'], ['play', 'musicPlay'],
  ['وقف', 'musicStop'], ['stop', 'musicStop'],
  ['س', 'musicSkip'], ['سكب', 'musicSkip'], ['skip', 'musicSkip'],
  ['ص', 'musicVolume'], ['v', 'musicVolume']
]);
function isAdmin(member) {
  return Boolean(member?.permissions?.has(PermissionsBitField.Flags.Administrator));
}
function canUseGeneral(member) {
  return isAdmin(member) || config.allowedRoles.some(id => member.roles.cache.has(id));
}
function reply(message, content, extra = {}) {
  return message.reply({ content, allowedMentions: { repliedUser: false }, ...extra }).catch(() => null);
}
function parseCommand(content) {
  const raw = content.trim();
  const prefixed = raw.startsWith('!');
  const body = prefixed ? raw.slice(1).trim() : raw;
  const splitAt = body.search(/\s/);
  const word = (splitAt === -1 ? body : body.slice(0, splitAt)).toLowerCase();
  const key = aliases.get(word) || null;
  // Unprefixed commands are intentionally limited to the music controls.
  if (!prefixed && !['musicPlay', 'musicStop', 'musicSkip', 'musicVolume'].includes(key)) return null;
  const args = splitAt === -1 ? [] : body.slice(splitAt).trim().split(/\s+/).filter(Boolean);
  return { key, word, args, rest: splitAt === -1 ? '' : body.slice(splitAt).trim() };
}
function makeEmbed(title, description) {
  return new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(description).setTimestamp();
}
function roleMention(id) { return `<@&${id}>`; }


function parseDuration(value, unit) {
  const n = Number(String(value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const u = String(unit || '').toLowerCase();
  if (!Number.isInteger(n) || n < 1) return null;
  const units = {
    hour: 3600000, hours: 3600000, ساعة: 3600000, ساعات: 3600000,
    day: 86400000, days: 86400000, يوم: 86400000, ايام: 86400000, أيام: 86400000,
    week: 604800000, weeks: 604800000, اسبوع: 604800000, أسبوع: 604800000, اسابيع: 604800000, أسابيع: 604800000,
    month: 2592000000, months: 2592000000, شهر: 2592000000, شهور: 2592000000, أشهر: 2592000000,
    year: 31536000000, years: 31536000000, سنة: 31536000000, سنوات: 31536000000
  };
  const factor = units[u];
  if (!factor) return null;
  const limits = {
    hour:24,hours:24,ساعة:24,ساعات:24,
    day:100,days:100,يوم:100,ايام:100,أيام:100,
    week:100,weeks:100,اسبوع:100,أسبوع:100,اسابيع:100,أسابيع:100,
    month:500,months:500,شهر:500,شهور:500,أشهر:500,
    year:100,years:100,سنة:100,سنوات:100
  };
  return n <= (limits[u] || 0) ? n * factor : null;
}
function durationLabel(ms) {
  const days = Math.round(ms / 86400000);
  if (days >= 365) return `${Math.round(days / 365)} سنة`;
  if (days >= 30) return `${Math.round(days / 30)} شهر`;
  if (days >= 7) return `${Math.round(days / 7)} أسبوع`;
  if (days >= 1) return `${days} يوم`;
  return `${Math.round(ms / 3600000)} ساعة`;
}
function canManagePrivateRoles(member) {
  return isAdmin(member) || member.roles.cache.some(r => ['staff team', 'staff'].includes(r.name.toLowerCase())) || canUseGeneral(member);
}
function privateRoleRecord(roleId) { return privateRoles[roleId] || null; }
async function applyPrivateRoleIcon(role, value) {
  if (!value || value === '-') return { ok: true, skipped: true };
  const urlMatch = String(value).match(/^https:\/\//i);
  if (urlMatch) {
    const response = await fetch(value, { signal: AbortSignal.timeout(12000) }).catch(() => null);
    if (!response?.ok) return { ok: false, reason: 'تعذر تحميل رابط الصورة.' };
    const type = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!type.startsWith('image/') || buffer.length > 256 * 1024) return { ok: false, reason: 'صورة الرتبة يجب أن تكون صورة وألا تتجاوز 256KB.' };
    try { await role.edit({ icon: buffer }, 'تحديث أيقونة الرتبة الخاصة'); return { ok: true }; }
    catch (error) { return { ok: false, reason: 'السيرفر قد لا يدعم أيقونات الرتب أو أن صلاحيات البوت غير كافية.' }; }
  }
  try { await role.edit({ unicodeEmoji: value }, 'تحديث إيموجي الرتبة الخاصة'); return { ok: true }; }
  catch { return { ok: false, reason: 'تعذر تطبيق الإيموجي؛ استخدم رابط PNG أو اتركه فارغًا.' }; }
}
async function sendPrivateRoleAnnouncement(guild, role, record, renewed = false) {
  const channel = await guild.channels.fetch(PRIVATE_ROLE_ANNOUNCE_CHANNEL).catch(() => null);
  if (!channel?.isTextBased()) return false;
  const ownerMentions = (record.owners || []).map(id => `<@${id}>`).join('، ') || 'غير محدد';
  const embed = new EmbedBuilder().setColor(record.color || role.hexColor || 0x8000ff)
    .setTitle('💎 Private Role')
    .setDescription(`${role}\n**Role ID:** \`${role.id}\`\n**Owner:** ${ownerMentions}\n**Point:** ${record.forSale ? record.price : 'غير معروضة للبيع'}\n**Duration:** ${record.durationText}\n**Expires:** <t:${Math.floor(record.expiresAt / 1000)}:F>`)
    .setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: { parse: ['roles', 'users'] } }).catch(() => null);
  return true;
}
async function sendPrivateRoleCreationLog(guild, role, record, creatorId) {
  const channel = await guild.channels.fetch(PRIVATE_ROLE_LOG_CHANNEL).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('🆕 إنشاء رتبة خاصة')
    .setDescription(`**الرتبة:** ${role} (\`${role.id}\`)\n**المنشئ:** <@${creatorId}>\n**المالك:** ${(record.owners || []).map(id => `<@${id}>`).join('، ')}\n**المدة:** ${record.durationText}\n**السعر:** ${record.forSale ? record.price : 'غير معروضة للبيع'}\n**الانتهاء:** <t:${Math.floor(record.expiresAt / 1000)}:F>`)
    .setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: { parse: ['users', 'roles'] } }).catch(() => null);
}
async function expirePrivateRoles() {
  const now = Date.now();
  for (const [roleId, record] of Object.entries(privateRoles)) {
    if (!record.active || record.expiresAt > now) continue;
    const guild = client.guilds.cache.get(record.guildId);
    if (!guild) continue;
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) { record.active = false; continue; }
    const holders = [];
    for (const [memberId] of role.members) holders.push(memberId);
    record.holders = [...new Set([...(record.holders || []), ...holders])];
    for (const memberId of holders) {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member) await member.roles.remove(roleId, 'انتهاء مدة الرتبة الخاصة').catch(() => null);
    }
    record.active = false;
  }
  savePrivateRoles();
}
async function askWizardAnswer(channel, userId, prompt, timeout = 120000) {
  await channel.send(prompt);
  const collected = await channel.awaitMessages({
    filter: m => m.author.id === userId && !m.author.bot,
    max: 1, time: timeout, errors: ['time']
  }).catch(() => null);
  return collected?.first()?.content?.trim() ?? null;
}
async function createPrivateRoleWizard(message) {
  if (!canManagePrivateRoles(message.member)) return reply(message, '❌ هذا الأمر للإدارة فقط.');
  const channel = message.channel, uid = message.author.id;
  const name = await askWizardAnswer(channel, uid, 'اكتب اسم الرتبة:');
  if (!name) return reply(message, 'انتهى وقت إنشاء الرتبة.');
  const image = await askWizardAnswer(channel, uid, 'أرسل إيموجي الرتبة أو رابط صورة (اكتب - للتخطي):');
  if (image === null) return reply(message, 'انتهى وقت إنشاء الرتبة.');
  const duration = await askWizardAnswer(channel, uid, 'حدد المدة مثال: `6 اسبوع` أو `24 ساعة`:');
  if (!duration) return reply(message, 'انتهى وقت إنشاء الرتبة.');
  const dm = duration.match(/^(\d+)\s+(\S+)$/);
  const durationMs = dm ? parseDuration(dm[1], dm[2]) : null;
  if (!durationMs) return reply(message, '❌ المدة غير صحيحة أو تجاوزت الحد المسموح.');
  const sale = await askWizardAnswer(channel, uid, 'هل الرتبة للبيع؟ اكتب نعم أو لا:');
  if (!sale || !/^(نعم|اي|أيوه|yes|لا|no)$/i.test(sale)) return reply(message, '❌ جاوب بنعم أو لا.');
  const forSale = /^(نعم|اي|أيوه|yes)$/i.test(sale);
  let price = null;
  if (forSale) {
    const priceText = await askWizardAnswer(channel, uid, 'اكتب السعر بالأرقام:');
    price = Number(priceText);
    if (!Number.isFinite(price) || price < 0) return reply(message, '❌ السعر غير صحيح.');
  }
  const color = await askWizardAnswer(channel, uid, 'أرسل لون HEX مثل `#8000FF`:');
  if (!color || !/^#[0-9A-F]{6}$/i.test(color)) return reply(message, '❌ اللون غير صحيح. استخدم صيغة #8000FF.');
  let ownerText = await askWizardAnswer(channel, uid, 'منشن مالك الرتبة (أو اكتب `انا`):');
  if (!ownerText) return reply(message, 'انتهى وقت إنشاء الرتبة.');
  const owner = ownerText.toLowerCase() === 'انا' ? uid : (ownerText.match(/\d{17,20}/)?.[0] || uid);
  const guild = message.guild;
  const role = await guild.roles.create({
    name: name.slice(0, 100), color, reason: `Private role created by ${uid}`
  }).catch(() => null);
  if (!role) return reply(message, '❌ فشل إنشاء الرتبة. تأكد أن رتبة البوت أعلى من الرتب التي ينشئها.');
  const iconResult = image === '-' ? { ok: true, skipped: true } : await applyPrivateRoleIcon(role, image);
  const expiresAt = Date.now() + durationMs;
  const record = {
    guildId: guild.id, owners: [owner], deputy: null, holders: [owner],
    durationMs, durationText: duration.trim(), expiresAt, forSale, price,
    color, image: image === '-' ? null : image, active: true, createdBy: uid
  };
  privateRoles[role.id] = record;
  savePrivateRoles();
  const ownerMember = await guild.members.fetch(owner).catch(() => null);
  if (ownerMember) {
    await ownerMember.roles.add(role.id).catch(() => null);
    if (!record.holders.includes(owner)) record.holders.push(owner);
  }
  await sendPrivateRoleAnnouncement(guild, role, record);
  await sendPrivateRoleCreationLog(guild, role, record, uid);
  return reply(message, `☑️ تم إنشاء الرتبة ${role} بنجاح.${iconResult.ok ? '' : `\n⚠️ ${iconResult.reason}`}`);
}
async function showMyPrivateRole(message) {
  const member = message.member;
  const owned = Object.entries(privateRoles).filter(([id, r]) => r.guildId === message.guild.id && ((r.owners || []).includes(member.id) || r.deputy === member.id));
  if (!owned.length) return reply(message, 'ما عندك رتبة خاصة مسجلة.');
  const [roleId, record] = owned[0];
  const role = await message.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return reply(message, 'الرتبة غير موجودة في السيرفر.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pr:${roleId}:members:${member.id}`).setLabel('إضافة/إزالة أعضاء').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pr:${roleId}:name:${member.id}`).setLabel('تغيير الاسم').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pr:${roleId}:color:${member.id}`).setLabel('تغيير اللون').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pr:${roleId}:transfer:${member.id}`).setLabel('نقل الملكية').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`pr:${roleId}:image:${member.id}`).setLabel('تغيير الأيقونة').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pr:${roleId}:deputy:${member.id}`).setLabel('تعيين/إزالة نائب').setStyle(ButtonStyle.Secondary)
  );
  const embed = makeEmbed('لوحة الرتبة الخاصة', `${role}\n**المدة:** ${record.durationText}\n**تنتهي:** <t:${Math.floor(record.expiresAt/1000)}:R>\n**الحالة:** ${record.active ? 'مفعلة' : 'منتهية'}`);
  return message.reply({ embeds: [embed], components: [row, row2] }).catch(() => null);
}
async function renewPrivateRole(message) {
  const role = message.mentions.roles.first();
  const args = message.content.trim().split(/\s+/);
  const durationAt = args.findIndex(x => x.startsWith('<@&'));
  const amount = args[durationAt + 1], unit = args[durationAt + 2];
  if (!role || !amount || !unit) return reply(message, 'الاستخدام: `!تجديد @الرتبة 6 اسبوع`');
  if (!canManagePrivateRoles(message.member)) return reply(message, '❌ هذا الأمر للإدارة فقط.');
  const record = privateRoleRecord(role.id);
  if (!record || record.guildId !== message.guild.id) return reply(message, 'هذه ليست رتبة خاصة مسجلة.');
  const ms = parseDuration(amount, unit);
  if (!ms) return reply(message, '❌ المدة غير صحيحة أو تجاوزت الحد.');
  const guild = message.guild;
  const holders = new Set([...(record.holders || []), ...[...role.members.keys()]]);
  record.holders = [...holders];
  for (const id of holders) {
    const member = await guild.members.fetch(id).catch(() => null);
    if (member) await member.roles.add(role.id).catch(() => null);
  }
  record.durationMs = ms;
  record.durationText = `${amount} ${unit}`;
  record.expiresAt = Date.now() + ms;
  record.active = true;
  savePrivateRoles();
  await sendPrivateRoleAnnouncement(guild, role, record, true);
  return reply(message, `☑️ تم تجديد ${role} وإرجاعها إلى ${holders.size} عضو.`);
}

const questions = [
  '1 - الاسم:',
  '2 - العمر:',
  '3 - خبرتك السابقة بالإدارة؟',
  '4 - كم لك بالسيرفر؟',
  '5 - كم ساعة تقدر تتفاعل باليوم؟',
  '6 - لو شفت عضو يخالف القوانين وش بتسوي معه؟',
  '7 - لو صار خلاف بين عضوين وكل واحد يرمي الغلط على الثاني كيف بتتصرف؟',
  '8 - لو اثنين من الإدارة اختلفوا على قرار وكل واحد مصر على رأيه وش بتسوي؟',
  '9 - لو صاحبك خالف القوانين وطلب منك تتستر عليه وش بيكون تصرفك؟',
  '10 - لو أحد أعلى منك رتبة طلب منك تسوي شيء مخالف للقوانين كيف بتتصرف؟',
  '11 - لو استلمت تكت وما عرفت تحل المشكلة وش بتسوي؟',
  '12 - لو أحد أعضاء الإدارة أساء استخدام صلاحياته كيف تتعامل معه؟',
  '13 - لو عضو استفزك أو حاول يطلعك عن طورك كيف تتصرف؟',
  '14 - لو عضو قدم شكوى ضد إداري وأنت تعرف الإداري شخصياً كيف تتعامل مع الشكوى؟',
  '15 - لو وصلتك معلومات داخلية أو سرية تخص الإدارة، كيف تتصرف؟',
  '16 - لو كانت التكتات كثيرة والضغط كبير، كيف ترتب أولوياتك؟',
  '17 - لو نفذت أمرًا إداريًا واكتشفت أنه كان خاطئًا، وش بتسوي؟',
  '18 - لو عاقبت عضوًا ثم اكتشفت أنه ما خالف، كيف تتصرف؟',
  '19 - لو عضو جديد خالف القوانين وما يعرفها، كيف تتعامل معه؟',
  '20 - لو صار خلاف بينك وبين إداري آخر، كيف تحل الموضوع؟',
  '21 - لو عضو رفض توجيهاتك أو تحذيرك، وش الإجراء المناسب؟',
  '22 - لو أحد استغل ثقتك أو صلاحياتك، كيف تتصرف؟',
  '23 - اذكر موقفًا صعبًا ممكن تواجهه كإداري وكيف تتعامل معه.',
  '24 - لو أحد سبّك أو قذفك في الخاص، كيف تتصرف؟'
];

function servicePanel(kind) {
  const isFeeling = kind === 'feeling';
  const title = isFeeling ? '・𝗙𝗲𝗲𝗹𝗶𝗻𝗴' : '・𝗭𝗮𝗷𝗲𝗹';
  const description = isFeeling
    ? 'خدمة فيلنق لإرسال رسالة أو شعور بطريقة مرتبة.\n\n**طريقة الاستخدام:**\n• اضغط **Send** لكتابة رسالتك وإرسالها.\n• الخدمة متاحة للجميع.\n• تُرسل الرسالة بشكل مجهول، ولا يظهر اسم المرسل داخلها.\n• اضغط **Reply** لإرسال رد مجهول.\n• إيقاف اللوحة متاح للإداريين فقط.'
    : 'خدمة زاجل لإرسال رسالة تصل إلى القناة المحددة.\n\n**طريقة الاستخدام:**\n• اضغط **Send** لكتابة الرسالة وإرسالها.\n• الخدمة متاحة للجميع.\n• تُرسل الرسالة بشكل مجهول، ولا يظهر اسم المرسل داخلها.\n• اضغط **Reply** لإرسال رد مجهول.\n• إيقاف اللوحة متاح للإداريين فقط.';
  return { title, description };
}
function serviceButtons(kind, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`svc:${kind}:send`).setLabel('Send').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`svc:${kind}:off`).setLabel('Toggle Off').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`svc:${kind}:reply`).setLabel('Reply').setStyle(ButtonStyle.Primary).setDisabled(disabled)
  );
}
function makeServiceModal(kind, action) {
  const modal = new ModalBuilder()
    .setCustomId(`svcmodal:${kind}:${action}`)
    .setTitle(action === 'reply' ? 'Reply' : 'Send');
  const input = new TextInputBuilder()
    .setCustomId('body').setLabel(action === 'reply' ? 'اكتب ردك' : 'اكتب رسالتك')
    .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1800);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function makePrivateRoleModal(roleId, action) {
  const titles = { members: 'إضافة أو إزالة عضو', name: 'تغيير اسم الرتبة', color: 'تغيير لون الرتبة', transfer: 'نقل ملكية الرتبة', image: 'تغيير أيقونة الرتبة', deputy: 'تعيين أو إزالة نائب' };
  const labels = { members: 'منشن العضو أو ID', name: 'الاسم الجديد', color: 'HEX مثل #8000FF', transfer: 'منشن المالك الجديد أو ID', image: 'رابط صورة HTTPS أو إيموجي', deputy: 'منشن النائب أو اكتب إزالة' };
  const modal = new ModalBuilder().setCustomId(`prmodal:${roleId}:${action}`).setTitle(titles[action] || 'إدارة الرتبة');
  const input = new TextInputBuilder().setCustomId('value').setLabel(labels[action] || 'القيمة').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(action === 'image' ? 500 : 100);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}
function parseUserId(value) { return String(value).match(/\d{17,20}/)?.[0] || null; }
async function removeBackground(message) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return reply(message, '❌ ميزة قص الخلفية تحتاج إضافة REMOVE_BG_API_KEY في متغيرات الاستضافة.');
  const attachment = message.attachments.first();
  const source = attachment?.url || message.content.match(/https:\/\/\S+/i)?.[0];
  if (!source) return reply(message, 'أرفق صورة مع الأمر `!قص` أو أرسل رابط صورة بعدها.');
  if (!/^https:\/\//i.test(source)) return reply(message, '❌ استخدم رابط HTTPS للصورة.');
  const sourceResponse = await fetch(source, { signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!sourceResponse?.ok) return reply(message, '❌ ما قدرت أفتح الصورة.');
  const contentType = sourceResponse.headers.get('content-type') || '';
  const imageBuffer = Buffer.from(await sourceResponse.arrayBuffer());
  if (!contentType.startsWith('image/') || imageBuffer.length > 10 * 1024 * 1024) return reply(message, '❌ أرسل صورة صالحة لا يتجاوز حجمها 10MB.');
  const form = new FormData();
  form.append('image_file', new Blob([imageBuffer], { type: contentType }), 'source-image');
  form.append('size', 'auto');
  const response = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': apiKey }, body: form, signal: AbortSignal.timeout(60000) }).catch(() => null);
  if (!response?.ok) return reply(message, `❌ فشل قص الخلفية${response ? ` (HTTP ${response.status})` : ''}. تحقق من مفتاح Remove.bg.`);
  const output = Buffer.from(await response.arrayBuffer());
  return message.channel.send({ content: `تمت إزالة الخلفية لـ ${message.author}.`, files: [new AttachmentBuilder(output, { name: 'yovn-cutout.png' })] }).catch(() => null);
}

client.once('ready', async () => {
  try {
    await player.extractors.loadMulti(DefaultExtractors);
    console.log('Music extractors loaded.');
  } catch (error) {
    console.error('Could not load music extractors:', error);
  }
  console.log(`YovnBot online: ${client.user.tag}`);
  await expirePrivateRoles().catch(error => console.error('Role expiry check failed:', error));
  setInterval(() => expirePrivateRoles().catch(error => console.error('Role expiry check failed:', error)), 60 * 1000);
  await cleanVoiceChannelChats().catch(error => console.error('Voice chat cleanup failed:', error));
  setInterval(() => cleanVoiceChannelChats().catch(error => console.error('Voice chat cleanup failed:', error)), 5 * 60 * 1000);
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  const lowerContent = message.content.toLocaleLowerCase();
  const reactionMatch = Object.entries(config.autoReactions || {}).find(([trigger]) => {
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, 'iu').test(lowerContent);
  });
  if (reactionMatch) await message.react(reactionMatch[1]).catch(() => null);
  const parsed = parseCommand(message.content);
  if (!parsed) {
    const text = message.content.toLocaleLowerCase();
    const match = Object.entries(config.autoReplies).find(([trigger]) => {
      const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, 'iu').test(text);
    });
    if (match) return message.channel.send({ content: match[1], allowedMentions: { parse: [] } }).catch(() => null);
    return;
  }
  if (!parsed.key) return;
  const { key, args, rest } = parsed;

  // Music controls: no prefix, and bot joins the configured voice channel.
  if (['musicPlay', 'musicStop', 'musicSkip', 'musicVolume'].includes(key)) {
    const voiceId = config.musicVoiceChannelId || defaultConfig.musicVoiceChannelId;
    const voiceChannel = await message.guild.channels.fetch(voiceId).catch(() => null);
    if (!voiceChannel || !voiceChannel.isVoiceBased()) {
      return reply(message, '❌ روم الموسيقى غير موجود أو ليس رومًا صوتيًا. تحقق من musicVoiceChannelId في data/config.json.');
    }
    const memberVoiceId = message.member?.voice?.channelId;
    if (memberVoiceId && memberVoiceId !== voiceId) {
      return reply(message, `❌ ادخل روم <#${voiceId}> أولًا لاستخدام أوامر الموسيقى.`);
    }
    const queue = player.nodes.get(message.guild.id);

    if (key === 'musicPlay') {
      const query = rest.trim();
      if (!query) return reply(message, '❌ اكتب اسم الأغنية أو رابطها بعد الأمر. مثال: `شغل imagine dragons believer`');
      try {
        const result = await player.play(voiceChannel, query, {
          nodeOptions: {
            metadata: { channel: message.channel },
            volume: Math.min(150, Math.max(1, Number(config.musicDefaultVolume) || 100)),
            leaveOnEmpty: false,
            leaveOnEmptyCooldown: 0,
            leaveOnEnd: false,
            leaveOnStop: false
          },
          requestedBy: message.author
        });
        return reply(message, `☑️ تمت إضافة **${result.track.title}** إلى قائمة التشغيل.`);
      } catch (error) {
        console.error('Music play failed:', error);
        return reply(message, '❌ ما قدرت أشغّل هذا الرابط أو أبحث عن الأغنية. جرّب رابطًا أو اسمًا آخر.');
      }
    }

    if (!queue || !queue.isPlaying()) return reply(message, '❌ ما فيه أغنية شغالة حاليًا.');
    if (key === 'musicStop') {
      queue.delete();
      return reply(message, '☑️ تم إيقاف الموسيقى وفصل البوت.');
    }
    if (key === 'musicSkip') {
      const skipped = queue.node.skip();
      return reply(message, skipped ? '☑️ تم تخطي الأغنية.' : '❌ ما فيه أغنية بعدها للتخطي.');
    }
    if (key === 'musicVolume') {
      const rawVolume = args[0];
      const volume = Number(rawVolume);
      if (!Number.isInteger(volume) || volume < 1 || volume > 150) {
        return reply(message, '❌ حدد مستوى صوت من 1 إلى 150. مثال: `ص 100` أو `v 150`.');
      }
      queue.node.setVolume(volume);
      return reply(message, `☑️ تم ضبط مستوى الصوت على **${volume}%**.`);
    }
  }

  if (ADMIN_ONLY.has(key) && !isAdmin(message.member)) {
    return reply(message, '❌ هذا الأمر متاح لمن لديه صلاحية Administrator فقط.');
  }
  if (!ADMIN_ONLY.has(key) && !PUBLIC_COMMANDS.has(key) && !canUseGeneral(message.member)) {
    return reply(message, '❌ رتبتك غير مضافة في إعدادات البوت. اطلب من إداري ضبط !setup.');
  }

  if (key === 'help') {
    const embed = makeEmbed('📚 أوامر البوت',
      '**أوامر الإداري فقط**\n' +
      '`!help` — عرض قائمة الأوامر.\n' +
      '`!setup` — تحديد الرتب المسموح لها بباقي الأوامر.\n' +
      '`!تيك` — عرض معلومات حساب تيك بصندوق قابل للنسخ.\n' +
      '`!فيلنق` — نشر لوحة Feeling (متاح للجميع) والرسائل فيها مجهولة.\n' +
      '`!زاجل` — نشر لوحة Zajel (متاح للجميع) والرسائل فيها مجهولة.\n\n' +
      '**الأوامر للرتب المحددة في !setup**\n' +
      '`!شروط` — عرض أسئلة التقديم للإدارة (24 سؤالًا).\n' +
      '`!رتب` — عرض الرتب وأسعارها.\n' +
      '`!addrole @role السعر` — إضافة رتبة وسعرها.\n' +
      '`!removerole @role` — حذف رتبة من القائمة.\n\n' +
      '**إدارة الردود التلقائية (Administrator فقط)**\n' +
      '`!addrd كلمة | الرد` أو `!اضفرد كلمة | الرد` — إضافة رد.\n' +
      '`!delrd كلمة` أو `!حذفرد كلمة` — حذف رد.\n' +
      '`!editrd كلمة | الرد الجديد` أو `!تعديلرد كلمة | الرد الجديد` — تعديل رد.\n' +
      '`!listrd` أو `!الردود` — عرض الردود.\n' +
      '`!addreact كلمة | 😀` — إضافة رياكشن تلقائي.\n' +
      '`!delreact كلمة` — حذف رياكشن تلقائي.\n' +
      '`!listreact` — عرض الرياكشنات.\n' +
      '`!خط` — إرسال صورة الخط داخل الرسالة.\n' +
      '`!قص` مع صورة — إزالة خلفية الصورة (يتطلب مفتاح Remove.bg).\n' +
      'الردود التلقائية نفسها تعمل مع جميع الأعضاء.\n\n' +
      '**الموسيقى (بدون برفكس)**\n' +
      '`ش <اسم/رابط>` أو `شغل <اسم/رابط>` أو `play <اسم/رابط>` — تشغيل أغنية.\n' +
      '`وقف` أو `stop` — إيقاف الموسيقى.\n' +
      '`س` أو `سكب` أو `skip` — تخطي الأغنية.\n' +
      '`ص 1-150` أو `v 1-150` — مستوى الصوت.');
    return message.reply({ embeds: [embed] }).catch(() => null);
  }

  if (key === 'setup') {
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(`setuproles:${message.guild.id}:${message.author.id}`)
        .setPlaceholder('اختر الرتب المسموح لها باستخدام أوامر البوت')
        .setMinValues(0).setMaxValues(25)
    );
    return message.reply({ content: '⚙️ **إعداد صلاحيات YovnBot**\nاختر الرتب التي تستطيع استخدام الأوامر العادية. أوامر `!help` و`!setup` و`!تيك` للإداري فقط، وخدمتا `!فيلنق` و`!زاجل` متاحتان للجميع.', components: [row] }).catch(() => null);
  }

  if (key === 'teek') {
    const info = String(config.accountInfo || '').trim();
    if (!info || info === defaultConfig.accountInfo) {
      return reply(message, '⚠️ أضف معلومات الحساب في data/config.json داخل خانة accountInfo أولًا.');
    }
    // Discord code blocks display a copy control in supported clients.
    return message.channel.send({ content: `\`\`\`text\n${info.replace(/```/g, "'''")}\n\`\`\`` }).catch(() => null);
  }

  if (key === 'fontImage') {
    // Prefer a bundled local asset so the command keeps working after a Discord CDN signature expires.
    const localImagePath = path.join(__dirname, 'assets', 'font-image.png');
    if (fs.existsSync(localImagePath)) {
      const file = new AttachmentBuilder(localImagePath, { name: 'font-image.png' });
      const embed = new EmbedBuilder().setColor(0x5865F2).setImage('attachment://font-image.png');
      return message.channel.send({ embeds: [embed], files: [file] }).catch(() => reply(message, '❌ تعذر إرسال صورة الخط.'));
    }
    // Fallback to the configured URL. A signed Discord CDN URL may expire; add assets/font-image.png for a permanent local copy.
    const imageUrl = String(process.env.FONT_IMAGE_URL || config.fontImageUrl || '').trim();
    if (!/^https:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(imageUrl)) return reply(message, '❌ أضف صورة الخط باسم assets/font-image.png أو اضبط fontImageUrl في data/config.json.');
    try {
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return reply(message, '❌ انتهت صلاحية رابط صورة الخط أو تعذر فتحه. ارفع الصورة داخل مجلد assets باسم font-image.png.');
      const type = response.headers.get('content-type') || '';
      if (!type.startsWith('image/')) return reply(message, '❌ الرابط لا يعيد ملف صورة صالحًا.');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 8 * 1024 * 1024) return reply(message, '❌ حجم صورة الخط غير صالح أو أكبر من 8MB.');
      const file = new AttachmentBuilder(buffer, { name: 'font-image.png' });
      const embed = new EmbedBuilder().setColor(0x5865F2).setImage('attachment://font-image.png');
      return message.channel.send({ embeds: [embed], files: [file] }).catch(() => reply(message, '❌ تعذر إرسال صورة الخط.'));
    } catch (error) {
      console.error('Font image fetch failed:', error);
      return reply(message, '❌ تعذر تحميل صورة الخط. ارفع الصورة داخل مجلد assets باسم font-image.png.');
    }
  }
  if (key === 'removeBg') return removeBackground(message);

  if (key === 'addreact') {
    const divider = rest.indexOf('|');
    if (divider < 1 || !rest.slice(divider + 1).trim()) return reply(message, 'الاستخدام: `!addreact كلمة | 😀`');
    const trigger = rest.slice(0, divider).trim().toLowerCase();
    const emoji = rest.slice(divider + 1).trim();
    if (trigger.length > 80 || emoji.length > 100) return reply(message, '❌ تحقق من طول الكلمة والإيموجي.');
    config.autoReactions ||= {};
    config.autoReactions[trigger] = emoji;
    saveConfig();
    return reply(message, `✅ تمت إضافة رياكشن تلقائي للكلمة **${trigger}**.`);
  }
  if (key === 'delreact') {
    const trigger = rest.trim().toLowerCase();
    if (!trigger || !config.autoReactions?.[trigger]) return reply(message, 'ما لقيت رياكشن لهذه الكلمة.');
    delete config.autoReactions[trigger]; saveConfig();
    return reply(message, `✅ تم حذف رياكشن **${trigger}**.`);
  }
  if (key === 'listreact') {
    const entries = Object.entries(config.autoReactions || {});
    return message.channel.send({ embeds: [makeEmbed('✨ الرياكشنات التلقائية', entries.length ? entries.map(([word, emoji]) => `**${word}** ← ${emoji}`).join('\n') : 'ما فيه رياكشنات مضافة.')] }).catch(() => null);
  }

  if (key === 'feeling' || key === 'zajel') {
    const panel = servicePanel(key);
    return message.channel.send({ embeds: [makeEmbed(panel.title, panel.description)], components: [serviceButtons(key)] }).catch(() => null);
  }

  if (key === 'conditions') {
    const chunks = [];
    for (let i = 0; i < questions.length; i += 8) chunks.push(questions.slice(i, i + 8).join('\n'));
    for (let i = 0; i < chunks.length; i++) {
      await message.channel.send({ embeds: [makeEmbed(`📋 شروط التقديم للإدارة (${i + 1}/3)`, chunks[i])] }).catch(() => null);
    }
    return;
  }

  if (key === 'roles') {
    const entries = [...Object.entries(config.rolePrices), ...Object.entries(privateRoles).filter(([id, r]) => r.guildId === message.guild.id && r.active && r.forSale).map(([id, r]) => [id, r.price])];
    if (!entries.length) return reply(message, 'ما فيه رتب مضافة حاليًا. استخدم `!addrole @role السعر`.');
    return message.channel.send({ embeds: [makeEmbed('🎖️ الرتب والأسعار', entries.map(([id, price]) => `${roleMention(id)} — **${price}**`).join('\n'))] }).catch(() => null);
  }

  if (key === 'addrole') {
    const role = message.mentions.roles.first();
    const price = args.find(x => /^\d+(?:\.\d+)?$/.test(x));
    if (!role || !price) return reply(message, 'الاستخدام: `!addrole @الرول السعر`');
    config.rolePrices[role.id] = price;
    saveConfig();
    return reply(message, `✅ تمت إضافة ${role} بسعر **${price}**.`);
  }

  if (key === 'removerole') {
    const role = message.mentions.roles.first();
    if (!role) return reply(message, 'الاستخدام: `!removerole @الرول`');
    if (!Object.prototype.hasOwnProperty.call(config.rolePrices, role.id)) return reply(message, 'هذه الرتبة غير موجودة في القائمة.');
    delete config.rolePrices[role.id];
    saveConfig();
    return reply(message, `✅ تم حذف ${role} من قائمة الرتب والأسعار.`);
  }


  if (key === 'privateRoleWizard') return createPrivateRoleWizard(message);
  if (key === 'myrole') return showMyPrivateRole(message);
  if (key === 'renewPrivateRole') return renewPrivateRole(message);

  if (key === 'addrd' || key === 'editrd') {
    const divider = rest.indexOf('|');
    if (divider < 1 || !rest.slice(divider + 1).trim()) {
      return reply(message, `الاستخدام: \`!${parsed.word} الكلمة | الرد\``);
    }
    const trigger = rest.slice(0, divider).trim().toLocaleLowerCase();
    const response = rest.slice(divider + 1).trim();
    if (!trigger || trigger.length > 80) return reply(message, '❌ الكلمة مطلوبة وبحد أقصى 80 حرفًا.');
    if (response.length > 1800) return reply(message, '❌ الرد طويل جدًا؛ الحد 1800 حرف.');
    const exists = Object.prototype.hasOwnProperty.call(config.autoReplies, trigger);
    if (key === 'addrd' && exists) return reply(message, 'هذه الكلمة لها رد بالفعل. استخدم `!editrd` لتعديله.');
    if (key === 'editrd' && !exists) return reply(message, 'ما لقيت ردًا لهذه الكلمة. استخدم `!addrd` لإضافته.');
    config.autoReplies[trigger] = response;
    saveConfig();
    return reply(message, `✅ ${key === 'addrd' ? 'تمت إضافة' : 'تم تعديل'} الرد للكلمة **${trigger}**.`);
  }

  if (key === 'delrd') {
    const trigger = rest.trim().toLocaleLowerCase();
    if (!trigger) return reply(message, 'الاستخدام: `!delrd الكلمة` أو `!حذفرد الكلمة`');
    if (!Object.prototype.hasOwnProperty.call(config.autoReplies, trigger)) return reply(message, 'ما لقيت ردًا لهذه الكلمة.');
    delete config.autoReplies[trigger];
    saveConfig();
    return reply(message, `✅ تم حذف الرد للكلمة **${trigger}**.`);
  }

  if (key === 'listrd') {
    const entries = Object.entries(config.autoReplies);
    if (!entries.length) return reply(message, 'ما فيه ردود تلقائية مضافة.');
    const lines = entries.map(([trigger, response]) => `**${trigger}** ← ${response.replace(/\n/g, ' ').slice(0, 120)}`);
    for (let i = 0; i < lines.length; i += 10) {
      await message.channel.send({ embeds: [makeEmbed(`📜 الردود التلقائية (${Math.floor(i / 10) + 1}/${Math.ceil(lines.length / 10)})`, lines.slice(i, i + 10).join('\n'))] }).catch(() => null);
    }
    return;
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isRoleSelectMenu()) {
    const [kind, guildId, ownerId] = interaction.customId.split(':');
    if (kind !== 'setuproles') return;
    if (interaction.guildId !== guildId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: 'هذه القائمة ليست لك.', ephemeral: true }).catch(() => null);
    }
    if (!isAdmin(interaction.member)) return interaction.reply({ content: 'تحتاج Administrator.', ephemeral: true }).catch(() => null);
    config.allowedRoles = interaction.values;
    saveConfig();
    return interaction.update({ content: `✅ تم حفظ الرتب المسموح لها: ${interaction.values.map(roleMention).join('، ') || 'لا توجد رتب'}`, components: [] }).catch(() => null);
  }

  if (interaction.isButton()) {
    const [prefix, kind, action] = interaction.customId.split(':');
    if (prefix === 'pr') {
      const roleId = kind;
      const record = privateRoleRecord(roleId);
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!record || !role) return interaction.reply({ content: 'الرتبة غير موجودة.', ephemeral: true }).catch(() => null);
      if (!(record.owners || []).includes(interaction.user.id) && record.deputy !== interaction.user.id && !isAdmin(interaction.member)) return interaction.reply({ content: 'هذه اللوحة لمالك الرتبة أو نائبه فقط.', ephemeral: true }).catch(() => null);
      return interaction.showModal(makePrivateRoleModal(roleId, action));
    }
    if (prefix !== 'svc') return;
    if (action === 'off' && !isAdmin(interaction.member)) return interaction.reply({ content: 'إيقاف اللوحة متاح للإداريين فقط.', ephemeral: true }).catch(() => null);
    if (action === 'off') {
      const rows = interaction.message.components.map(row => ActionRowBuilder.from(row).setComponents(
        ...row.components.map(component => ButtonBuilder.from(component).setDisabled(true))
      ));
      return interaction.update({ components: rows }).catch(() => null);
    }
    return interaction.showModal(makeServiceModal(kind, action));
  }

  if (interaction.isModalSubmit()) {
    const [prefix, kind, action] = interaction.customId.split(':');
    if (prefix === 'prmodal') {
      const roleId = kind, value = interaction.fields.getTextInputValue('value').trim();
      const record = privateRoleRecord(roleId);
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!record || !role) return interaction.reply({ content: 'الرتبة غير موجودة.', ephemeral: true }).catch(() => null);
      if (!(record.owners || []).includes(interaction.user.id) && record.deputy !== interaction.user.id && !isAdmin(interaction.member)) return interaction.reply({ content: 'هذه اللوحة لمالك الرتبة أو نائبه فقط.', ephemeral: true }).catch(() => null);
      if (action === 'members') {
        const id = parseUserId(value); if (!id) return interaction.reply({ content: 'منشن عضوًا صحيحًا أو اكتب ID.', ephemeral: true });
        const member = await interaction.guild.members.fetch(id).catch(() => null); if (!member) return interaction.reply({ content: 'العضو غير موجود.', ephemeral: true });
        const hasRole = member.roles.cache.has(roleId);
        await member.roles[hasRole ? 'remove' : 'add'](roleId).catch(() => null);
        if (!hasRole) { record.holders ||= []; if (!record.holders.includes(id)) record.holders.push(id); savePrivateRoles(); }
        return interaction.reply({ content: hasRole ? `تمت إزالة الرتبة من ${member}.` : `تمت إضافة الرتبة إلى ${member}.`, ephemeral: true });
      }
      if (action === 'name') {
        if (value.length < 2 || value.length > 100) return interaction.reply({ content: 'الاسم يجب أن يكون بين حرفين و100 حرف.', ephemeral: true });
        await role.setName(value).catch(() => null); return interaction.reply({ content: 'تم تحديث اسم الرتبة.', ephemeral: true });
      }
      if (action === 'color') {
        if (!/^#[0-9a-f]{6}$/i.test(value)) return interaction.reply({ content: 'استخدم لون HEX مثل #8000FF.', ephemeral: true });
        await role.setColor(value).catch(() => null); record.color = value; savePrivateRoles(); return interaction.reply({ content: 'تم تحديث لون الرتبة.', ephemeral: true });
      }
      if (['transfer', 'deputy'].includes(action) && !(record.owners || []).includes(interaction.user.id) && !isAdmin(interaction.member)) return interaction.reply({ content: 'هذا الإجراء للمالك فقط.', ephemeral: true });
      if (action === 'transfer') {
        const id = parseUserId(value); const member = id ? await interaction.guild.members.fetch(id).catch(() => null) : null;
        if (!member) return interaction.reply({ content: 'حدد عضوًا موجودًا.', ephemeral: true });
        record.owners = [id]; record.holders ||= []; if (!record.holders.includes(id)) record.holders.push(id); await member.roles.add(roleId).catch(() => null); savePrivateRoles();
        return interaction.reply({ content: `تم نقل الملكية إلى ${member}.`, ephemeral: true });
      }
      if (action === 'image') {
        const result = await applyPrivateRoleIcon(role, value); if (result.ok) record.image = value; savePrivateRoles();
        return interaction.reply({ content: result.ok ? 'تم تحديث أيقونة الرتبة.' : `تعذر تحديث الأيقونة: ${result.reason}`, ephemeral: true });
      }
      if (action === 'deputy') {
        if (/^(إزالة|ازالة|remove)$/i.test(value)) record.deputy = null;
        else { const id = parseUserId(value); if (!id || !await interaction.guild.members.fetch(id).catch(() => null)) return interaction.reply({ content: 'حدد عضوًا موجودًا أو اكتب إزالة.', ephemeral: true }); record.deputy = id; }
        savePrivateRoles(); return interaction.reply({ content: record.deputy ? `تم تعيين نائب الرتبة: <@${record.deputy}>` : 'تمت إزالة نائب الرتبة.', ephemeral: true });
      }
      return interaction.reply({ content: 'إجراء غير معروف.', ephemeral: true });
    }
    if (prefix !== 'svcmodal') return;
    const body = interaction.fields.getTextInputValue('body').trim();
    if (!body) return interaction.reply({ content: 'اكتب نصًا قبل الإرسال.', ephemeral: true }).catch(() => null);
    const channelId = kind === 'feeling' ? config.feelingChannelId : config.zajelChannelId;
    const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : interaction.channel;
    if (!channel?.isTextBased()) return interaction.reply({ content: '❌ روم الإرسال غير مضبوط أو غير متاح.', ephemeral: true }).catch(() => null);
    const label = kind === 'feeling' ? '・𝗙𝗲𝗲𝗹𝗶𝗻𝗴' : '・𝗭𝗮𝗷𝗲𝗹';
    // Anonymous by design: never include the sender's username, ID, or avatar in the public message.
    await channel.send({ embeds: [makeEmbed(`${label} — ${action === 'reply' ? 'رد مجهول' : 'رسالة مجهولة'}`, body)] }).catch(() => null);
    return interaction.reply({ content: '✅ تم إرسال رسالتك.', ephemeral: true }).catch(() => null);
  }
});


// Discord voice-channel text chats only: clear every 5 minutes, including bot messages.
let voiceCleanupRunning = false;
async function cleanVoiceChannelChats() {
  if (voiceCleanupRunning) return;
  voiceCleanupRunning = true;
  try {
    const cutoff = Date.now() - 13 * 24 * 60 * 60 * 1000;
    for (const guild of client.guilds.cache.values()) {
      const fetchedChannels = await guild.channels.fetch().catch(error => {
        console.error(`Could not fetch channels for guild ${guild.id}:`, error);
        return null;
      });
      if (!fetchedChannels) continue;
      for (const channel of fetchedChannels.values()) {
        if (![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type) || typeof channel.messages?.fetch !== 'function') continue;
        let messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        while (messages?.size) {
          const deletable = messages.filter(m => m.createdTimestamp > cutoff);
          if (deletable.size) await channel.bulkDelete(deletable, true).catch(error => console.error(`Could not clean voice chat ${channel.id}:`, error));
          const oldest = messages.last();
          // No need to fetch further pages once this page reaches messages outside the 13-day window.
          if (!oldest || oldest.createdTimestamp <= cutoff || messages.size < 100) break;
          messages = await channel.messages.fetch({ limit: 100, before: oldest.id }).catch(() => null);
        }
      }
    }
  } finally {
    voiceCleanupRunning = false;
  }
}

client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
client.login(TOKEN);
