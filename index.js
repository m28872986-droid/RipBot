require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle
} = require('discord.js');

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
  rolePrices: {}
};
function readConfig() {
  try { return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }; }
  catch { return { ...defaultConfig }; }
}
let config = readConfig();
function saveConfig() { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});
const ADMIN_ONLY = new Set(['help', 'setup', 'teek', 'feeling', 'zajel']);
const aliases = new Map([
  ['help', 'help'], ['مساعدة', 'help'],
  ['setup', 'setup'], ['اعداد', 'setup'], ['إعداد', 'setup'],
  ['تيك', 'teek'],
  ['فيلنق', 'feeling'], ['feeling', 'feeling'],
  ['زاجل', 'zajel'], ['zajel', 'zajel'],
  ['شروط', 'conditions'],
  ['رتب', 'roles'],
  ['addrole', 'addrole'], ['removerole', 'removerole']
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
  return { key: aliases.get(word) || null, word, args };
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
    ? 'خدمة فيلنق لإرسال رسالة أو شعور بطريقة مرتبة.\n\n**طريقة الاستخدام:**\n• اضغط **Send** لكتابة رسالتك وإرسالها.\n• يمكن إرسال الرسالة بدون إظهار اسمك في نص الرسالة.\n• اضغط **Reply** لإرسال رد.\n• اضغط **Toggle Off** لإيقاف أزرار هذه اللوحة.'
    : 'خدمة زاجل لإرسال رسالة تصل إلى القناة المحددة.\n\n**طريقة الاستخدام:**\n• اضغط **Send** لكتابة الرسالة وإرسالها.\n• يمكن إرسالها دون إظهار اسمك في نص الرسالة.\n• اضغط **Reply** لإرسال رد.\n• اضغط **Toggle Off** لإيقاف أزرار هذه اللوحة.';
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

client.once('ready', () => console.log(`RipBot online: ${client.user.tag}`));

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  const parsed = parseCommand(message.content);
  if (!parsed || !parsed.key) return;
  const { key, args } = parsed;

  if (ADMIN_ONLY.has(key) && !isAdmin(message.member)) {
    return reply(message, '❌ هذا الأمر متاح لمن لديه صلاحية Administrator فقط.');
  }
  if (!ADMIN_ONLY.has(key) && !canUseGeneral(message.member)) {
    return reply(message, '❌ رتبتك غير مضافة في إعدادات البوت. اطلب من إداري ضبط !setup.');
  }

  if (key === 'help') {
    const embed = makeEmbed('📚 أوامر البوت',
      '**أوامر الإداري فقط**\n' +
      '`!help` — عرض قائمة الأوامر.\n' +
      '`!setup` — تحديد الرتب المسموح لها بباقي الأوامر.\n' +
      '`!تيك` — عرض معلومات حساب تيك بصندوق قابل للنسخ.\n' +
      '`!فيلنق` — نشر لوحة خدمة Feeling.\n' +
      '`!زاجل` — نشر لوحة خدمة Zajel.\n\n' +
      '**الأوامر للرتب المحددة في !setup**\n' +
      '`!شروط` — عرض أسئلة التقديم للإدارة (24 سؤالًا).\n' +
      '`!رتب` — عرض الرتب وأسعارها.\n' +
      '`!addrole @role السعر` — إضافة رتبة وسعرها.\n' +
      '`!removerole @role` — حذف رتبة من القائمة.');
    return message.reply({ embeds: [embed] }).catch(() => null);
  }

  if (key === 'setup') {
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(`setuproles:${message.guild.id}:${message.author.id}`)
        .setPlaceholder('اختر الرتب المسموح لها باستخدام أوامر البوت')
        .setMinValues(0).setMaxValues(25)
    );
    return message.reply({ content: '⚙️ **إعداد صلاحيات RipBot**\nاختر الرتب التي تستطيع استخدام جميع الأوامر العادية. أوامر `!help` و`!setup` و`!تيك` و`!فيلنق` و`!زاجل` تبقى للإداري Administrator فقط.', components: [row] }).catch(() => null);
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
    if (prefix !== 'svc') return;
    if (!isAdmin(interaction.member)) return interaction.reply({ content: 'هذه اللوحة مخصصة لاستخدام الإدارة.', ephemeral: true }).catch(() => null);
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
    await channel.send({ embeds: [makeEmbed(`${label} — ${action === 'reply' ? 'Reply' : 'رسالة جديدة'}`, body)] }).catch(() => null);
    return interaction.reply({ content: '✅ تم إرسال رسالتك.', ephemeral: true }).catch(() => null);
  }
});

client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
client.login(TOKEN);
