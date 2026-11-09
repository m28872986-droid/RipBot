require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { MongoClient } = require('mongodb');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN. Add it to your Render environment variables or .env file.');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const defaultConfig = {
  allowedRoles: [],
  accountInfo: 'ضع معلومات الحساب هنا داخل config.json',
  feelingChannelId: '',
  zajelChannelId: '',
  rolePrices: {},
  autoReplies: {},
  cutRoles: []
};
function readConfig() {
  try { return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }; }
  catch { return { ...defaultConfig }; }
}
let config = readConfig();
function saveConfig() { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'yovnpoints';
const mongoClient = new MongoClient(MONGODB_URI || 'mongodb://127.0.0.1:27017');
let balances;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});
const ADMIN_ONLY = new Set(['help', 'setup', 'teek', 'addrd', 'delrd', 'editrd', 'listrd']);
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
  ['نقاطي', 'pointsPanel'], ['تحويل', 'pointsTransfer'], ['قص', 'cut']
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
  if (!raw.startsWith('!')) return null;
  const body = raw.slice(1).trim();
  const splitAt = body.search(/\s/);
  const word = (splitAt === -1 ? body : body.slice(0, splitAt)).toLowerCase();
  const args = splitAt === -1 ? [] : body.slice(splitAt).trim().split(/\s+/).filter(Boolean);
  return { key: aliases.get(word) || null, word, args, rest: splitAt === -1 ? '' : body.slice(splitAt).trim() };
}
function makeEmbed(title, description) {
  return new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(description).setTimestamp();
}
function roleMention(id) { return `<@&${id}>`; }

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


async function connectSharedPoints() {
  if (!MONGODB_URI) throw new Error('Missing MONGODB_URI. Set the same Atlas URI used by the points bot.');
  await mongoClient.connect();
  balances = mongoClient.db(MONGODB_DB).collection('balances');
  await balances.createIndex({ userId: 1 }, { unique: true });
  console.log(`Connected to shared points database: ${MONGODB_DB}.balances`);
}
async function getSharedPoints(userId) {
  const doc = await balances.findOne({ userId }, { projection: { points: 1 } });
  return Number.isSafeInteger(doc?.points) && doc.points >= 0 ? doc.points : 0;
}
async function transferSharedPoints(fromId, toId, amount) {
  const session = mongoClient.startSession();
  try {
    let ok = false;
    await session.withTransaction(async () => {
      const debit = await balances.updateOne({ userId: fromId, points: { $gte: amount } }, { $inc: { points: -amount } }, { session });
      if (!debit.modifiedCount) return;
      await balances.updateOne({ userId: toId }, { $inc: { points: amount }, $setOnInsert: { userId: toId } }, { upsert: true, session });
      ok = true;
    });
    return ok;
  } finally { await session.endSession(); }
}
function pointsPanel() {
  return { embeds: [makeEmbed('⭐ YOVN ・ POINTS', 'النقاط مشتركة مع بوت النقاط الأساسي. اختر الخدمة بالأسفل.')], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sharedpoints:me').setLabel('نقاطي').setEmoji('⭐').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sharedpoints:transfer').setLabel('تحويل النقاط').setEmoji('💸').setStyle(ButtonStyle.Success)
  )] };
}
async function removeImageBackground(message, sourceUrl) {
  if (!process.env.REMOVE_BG_API_KEY) return reply(message, 'ميزة قص الخلفية تحتاج إضافة REMOVE_BG_API_KEY في الاستضافة.');
  if (!sourceUrl) return reply(message, 'ارفق صورة مع `!قص` أو اكتب رابط الصورة بعد الأمر.');
  let response;
  try {
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: sourceUrl, size: 'auto', format: 'png' })
    });
  } catch { return reply(message, 'تعذر الاتصال بخدمة إزالة الخلفية. حاول لاحقًا.'); }
  if (!response.ok) return reply(message, `فشل قص الصورة (رمز ${response.status}). تحقق من مفتاح الخدمة ورصيدها.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return reply(message, 'الصورة الناتجة غير صالحة أو أكبر من حد ديسكورد.');
  return message.reply({ content: `تم قص الصورة ${message.author}`, files: [{ attachment: bytes, name: 'yovn-cut.png' }], allowedMentions: { users: [message.author.id] } }).catch(() => null);
}

client.once('ready', () => console.log(`RipBot online: ${client.user.tag}`));

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
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

  if (key === 'pointsPanel') {
    try { return message.channel.send(pointsPanel()); }
    catch { return reply(message, 'قاعدة النقاط غير متصلة. تأكد من إعداد MONGODB_URI.'); }
  }
  if (key === 'pointsTransfer') {
    const target = message.mentions.users.first();
    const amount = Number(args.find(x => /^\d+$/.test(x)));
    if (!target || target.bot || target.id === message.author.id || !Number.isSafeInteger(amount) || amount <= 0)
      return reply(message, 'الاستخدام: `!تحويل @عضو عدد` (ولا يمكن التحويل لنفسك أو لبوت).');
    try {
      const ok = await transferSharedPoints(message.author.id, target.id, amount);
      if (!ok) return reply(message, `نقاطك غير كافية أو لم يتم التحويل. رصيدك: **${await getSharedPoints(message.author.id)}**.`);
      return reply(message, `تم تحويل **${amount}** نقطة إلى ${target}.`);
    } catch (e) { console.error('Shared points transfer failed:', e); return reply(message, 'تعذر الاتصال بقاعدة النقاط المشتركة.'); }
  }
  if (key === 'cut') {
    if (!canUseGeneral(message.member)) return reply(message, 'هذا الأمر مخصص للرتب المحددة في إعدادات البوت.');
    const attachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
    const url = attachment?.url || args[0];
    if (url && !/^https:\/\//i.test(url)) return reply(message, 'أرسل رابط صورة يبدأ بـ https:// أو أرفق الصورة.');
    return removeImageBackground(message, url);
  }

  if (ADMIN_ONLY.has(key) && !isAdmin(message.member)) {
    return reply(message, '❌ هذا الأمر متاح لمن لديه صلاحية Administrator فقط.');
  }
  if (!['pointsPanel', 'pointsTransfer'].includes(key) && !ADMIN_ONLY.has(key) && !canUseGeneral(message.member)) {
    return reply(message, '❌ رتبتك غير مضافة في إعدادات البوت. اطلب من إداري ضبط !setup.');
  }

  if (key === 'help') {
    const embed = makeEmbed('📚 أوامر البوت',
      '**أوامر الإداري فقط**\n' +
      '`!help` — عرض قائمة الأوامر.\n' +
      '`!setup` — تحديد الرتب المسموح لها بباقي الأوامر.\n' +
      '`!تيك` — عرض معلومات حساب تيك بصندوق قابل للنسخ.\n' +
      '`!فيلنق` — نشر لوحة Feeling المتاحة للجميع والرسائل فيها مجهولة.\n' +
      '`!زاجل` — نشر لوحة Zajel المتاحة للجميع والرسائل فيها مجهولة.\n\n' +
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
      'الردود التلقائية نفسها تعمل مع جميع الأعضاء.\n\n' +
      '**النقاط (تُقرأ من قاعدة بيانات بوت النقاط المشترك):**\n' +
      '`!نقاطي` — عرض لوحة النقاط.\n' +
      '`!تحويل @عضو عدد` — تحويل نقاط.\n' +
      '`!قص` مع صورة مرفقة أو رابط — إزالة خلفية الصورة (يتطلب REMOVE_BG_API_KEY).');
    return message.reply({ embeds: [embed] }).catch(() => null);
  }

  if (key === 'setup') {
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(`setuproles:${message.guild.id}:${message.author.id}`)
        .setPlaceholder('اختر الرتب المسموح لها باستخدام أوامر البوت')
        .setMinValues(0).setMaxValues(25)
    );
    return message.reply({ content: '⚙️ **إعداد صلاحيات RipBot**\nاختر الرتب التي تستطيع استخدام الأوامر العادية. أوامر `!help` و`!setup` و`!تيك` للإداري فقط، وخدمتا `!فيلنق` و`!زاجل` متاحتان للجميع.', components: [row] }).catch(() => null);
  }

  if (key === 'teek') {
    const info = String(config.accountInfo || '').trim();
    if (!info || info === defaultConfig.accountInfo) {
      return reply(message, '⚠️ أضف معلومات الحساب في data/config.json داخل خانة accountInfo أولًا.');
    }
    // Discord code blocks display a copy control in supported clients.
    return message.channel.send({ content: `\`\`\`text\n${info.replace(/```/g, "'''")}\n\`\`\`` }).catch(() => null);
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
    const entries = Object.entries(config.rolePrices);
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
  if (interaction.isButton() && interaction.customId.startsWith('sharedpoints:')) {
    const action = interaction.customId.split(':')[1];
    if (action === 'me') {
      try { return interaction.reply({ content: `رصيدك الحالي: **${await getSharedPoints(interaction.user.id)}** نقطة.`, ephemeral: true }); }
      catch { return interaction.reply({ content: 'قاعدة النقاط غير متصلة.', ephemeral: true }); }
    }
    if (action === 'transfer') {
      const modal = new ModalBuilder().setCustomId('sharedpoints:transfermodal').setTitle('تحويل النقاط');
      const target = new TextInputBuilder().setCustomId('target').setLabel('معرّف العضو').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(24);
      const amount = new TextInputBuilder().setCustomId('amount').setLabel('عدد النقاط').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12);
      modal.addComponents(new ActionRowBuilder().addComponents(target), new ActionRowBuilder().addComponents(amount));
      return interaction.showModal(modal);
    }
  }
  if (interaction.isModalSubmit() && interaction.customId === 'sharedpoints:transfermodal') {
    const id = interaction.fields.getTextInputValue('target').replace(/[<@!>]/g, '').trim();
    const amount = Number(interaction.fields.getTextInputValue('amount'));
    if (!/^\d{17,20}$/.test(id) || id === interaction.user.id || !Number.isSafeInteger(amount) || amount <= 0)
      return interaction.reply({ content: 'تأكد من معرّف العضو وعدد النقاط.', ephemeral: true });
    try {
      const ok = await transferSharedPoints(interaction.user.id, id, amount);
      return interaction.reply({ content: ok ? `تم تحويل **${amount}** نقطة إلى <@${id}>.` : `رصيدك غير كافٍ. رصيدك الحالي: **${await getSharedPoints(interaction.user.id)}**.`, ephemeral: true });
    } catch { return interaction.reply({ content: 'تعذر الاتصال بقاعدة النقاط.', ephemeral: true }); }
  }
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

client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
connectSharedPoints().then(() => client.login(TOKEN)).catch(error => { console.error('Startup failed:', error.message); process.exit(1); });
