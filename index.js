const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || '!';
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '1549461212348153856';
const DATA_DIR = path.join(__dirname, 'data');
const ROLES_FILE = path.join(DATA_DIR, 'roles.json');

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ROLES_FILE)) fs.writeFileSync(ROLES_FILE, JSON.stringify({}, null, 2));

function readRoles() {
  try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8')); }
  catch { return {}; }
}
function writeRoles(data) {
  fs.writeFileSync(ROLES_FILE, JSON.stringify(data, null, 2));
}
function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}
function isStaff(member) {
  return member.roles.cache.has(STAFF_ROLE_ID);
}
const anonymousMode = new Map();
function makeEmbed(title, description, color = 0x5865F2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}
async function reply(message, content) {
  return message.reply({ content, allowedMentions: { repliedUser: false } });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

client.once('ready', () => {
  console.log(`RipBot online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

  const raw = message.content.slice(PREFIX.length).trim();
  if (!raw) return;
  const parts = raw.split(/\s+/);
  const command = parts.shift().toLowerCase();
  const args = parts;

  try {
    // Help
    if (['help', 'مساعدة', 'اوامر', 'أوامر'].includes(command)) {
      const embed = makeEmbed('أوامر RipBot', [
        '**للإدارة (Administrator):**',
        '`!تيك` إرسال بيانات تيك توك برسالة خاصة',
        '`!فيلنق` نشر رسالة فيلنق',
        '`!زاجل` نشر رسالة زاجل',
        '',
        `**لرتبة Staff Team:**`,
        '`!رتب` عرض الرتب وأسعارها',
        '`!addrole @role السعر` إضافة رتبة للقائمة',
        '`!removerole @role` حذف رتبة من القائمة',
        '`!شروط` نشر أسئلة التقديم على الإدارة',
      ].join('\n'));
      return message.reply({ embeds: [embed] });
    }

    // Staff role price list
    if (command === 'رتب') {
      if (!isStaff(message.member)) return reply(message, '❌ هذا الأمر لرتبة Staff Team فقط.');
      const saved = readRoles()[message.guild.id] || {};
      const entries = Object.entries(saved);
      const description = entries.length
        ? entries.map(([id, price]) => `• <@&${id}> — **${price}**`).join('\n')
        : 'ما تمت إضافة أي رتب إلى الآن.';
      return message.reply({ embeds: [makeEmbed('قائمة الرتب', `${description}\n\nلفتح طلب شراء، افتح تذكرة من التكت.`)] });
    }

    if (command === 'addrole') {
      if (!isStaff(message.member)) return reply(message, '❌ هذا الأمر لرتبة Staff Team فقط.');
      const role = message.mentions.roles.first();
      const price = args.find((a) => /^\d+(\.\d+)?$/.test(a));
      if (!role || !price) return reply(message, 'الاستخدام: `!addrole @role السعر`');
      const all = readRoles();
      if (!all[message.guild.id]) all[message.guild.id] = {};
      all[message.guild.id][role.id] = price;
      writeRoles(all);
      return reply(message, `✅ تمت إضافة ${role} بسعر **${price}**.`);
    }

    if (command === 'removerole') {
      if (!isStaff(message.member)) return reply(message, '❌ هذا الأمر لرتبة Staff Team فقط.');
      const role = message.mentions.roles.first();
      if (!role) return reply(message, 'الاستخدام: `!removerole @role`');
      const all = readRoles();
      if (!all[message.guild.id] || !all[message.guild.id][role.id]) return reply(message, '❌ الرتبة غير موجودة في القائمة.');
      delete all[message.guild.id][role.id];
      writeRoles(all);
      return reply(message, `✅ تم حذف ${role} من قائمة الرتب.`);
    }

    // Admin application questions
    if (command === 'شروط') {
      if (!isStaff(message.member)) return reply(message, '❌ هذا الأمر لرتبة Staff Team فقط.');
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
        '15 - لو اكتشفت إن إداري يعطي معلومات داخلية لأعضاء السيرفر وش بتسوي؟',
        '16 - لو صار ضغط كبير على التكتات وما فيه إداريين متواجدين كيف تتصرف؟',
        '17 - لو أعطاك إداري أمر وأنت تشوف إن قراره غلط كيف تتعامل معه؟',
        '18 - لو شفت إداري يعاقب عضو بدون سبب واضح وش بتسوي؟',
        '19 - لو عضو جديد ما يعرف قوانين السيرفر وارتكب مخالفة وش التصرف المناسب معه؟',
        '20 - لو صار خلاف بينك وبين إداري ثاني ووصل الموضوع للإدارة العليا كيف تتصرف؟',
        '21 - لو انرفض طلبك أو جاك تحذير من الإدارة العليا كيف بيكون ردك؟',
        '22 - وش بتسوي لو لاحظت إن أحد يستغل ثقة الإدارة فيه؟',
        '23 - لو واجهت موقف صعب وما قدرت تتصرف فيه لحالك لمين ترجع؟',
        '24 - لو أحد جاك بالخاص وسبك أو قذفك كيف بتتصرف معه بصفتك إداري؟',
      ];
      const embed = makeEmbed('شروط التقديم على الإدارة', questions.join('\n'), 0x9B59B6);
      return message.channel.send({ embeds: [embed] });
    }

    // Admin-only commands
    if (command === 'تيك') {
      if (!isAdmin(message.member)) return reply(message, '❌ هذا الأمر للإدارة فقط.');
      const email = process.env.TIKTOK_EMAIL;
      const password = process.env.TIKTOK_PASSWORD;
      if (!email || !password) return reply(message, '⚠️ أضف TIKTOK_EMAIL و TIKTOK_PASSWORD في Environment Variables داخل الاستضافة.');
      try {
        await message.author.send({ embeds: [makeEmbed('بيانات حساب تيك توك', `**الإيميل:** ||${email}||\n**كلمة المرور:** ||${password}||`, 0x2C2F33)] });
        return reply(message, '✅ أرسلت البيانات لك في الخاص.');
      } catch {
        return reply(message, '❌ ما قدرت أرسل لك خاص. افتح الرسائل الخاصة من أعضاء السيرفر وجرب مرة ثانية.');
      }
    }

    if (command === 'فيلنق' || command === 'زاجل') {
      if (!isAdmin(message.member)) return reply(message, '❌ هذا الأمر للإدارة فقط.');
      const service = command === 'زاجل' ? 'zajil' : 'filling';
      const title = service === 'zajil' ? '🕊️ Zajil' : '✉️ Filling';
      const description = service === 'zajil'
        ? `مرحبًا بك في خدمة زاجل!

اضغط **Send** لإرسال رسالة بشكل مجهول. لن يظهر اسمك للأعضاء.

استخدم **Reply** للرد على رسالة سابقة، ويمكنك إيقاف الإرسال المجهول من **Toggle Off**.`
        : `مرحبًا بك في خدمة فيلنق!

اضغط **Send** لإرسال رسالتك بشكل مجهول. لن يظهر اسمك للأعضاء.

استخدم **Reply** للرد على رسالة سابقة، ويمكنك إيقاف الإرسال المجهول من **Toggle Off**.`;
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${service}:send`).setLabel('Send').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`${service}:toggle`).setLabel('Toggle Off').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${service}:reply`).setLabel('Reply').setStyle(ButtonStyle.Success),
      );
      return message.channel.send({ embeds: [makeEmbed(title, description, 0x5865F2)], components: [buttons] });
    }
  } catch (error) {
    console.error(`Command error (${command}):`, error);
    return reply(message, '❌ صار خطأ أثناء تنفيذ الأمر. راجع سجلات الاستضافة.');
  }
});


client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;
  const [service, action] = interaction.customId.split(':');
  if (!['zajil', 'filling'].includes(service)) return;
  const serviceName = service === 'zajil' ? 'زاجل' : 'فيلنق';

  try {
    if (interaction.isButton() && action === 'toggle') {
      const next = !(anonymousMode.get(`${interaction.guildId}:${interaction.user.id}`) ?? true);
      anonymousMode.set(`${interaction.guildId}:${interaction.user.id}`, next);
      return interaction.reply({ content: next ? `✅ تم تفعيل الإرسال المجهول في ${serviceName}.` : `ℹ️ تم إيقاف الإرسال المجهول في ${serviceName}.`, ephemeral: true });
    }

    if (interaction.isButton() && action === 'send') {
      const modal = new ModalBuilder().setCustomId(`${service}:sendModal`).setTitle(`إرسال عبر ${serviceName}`);
      const input = new TextInputBuilder().setCustomId('body').setLabel('اكتب رسالتك').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.isButton() && action === 'reply') {
      const modal = new ModalBuilder().setCustomId(`${service}:replyModal`).setTitle(`الرد عبر ${serviceName}`);
      const idInput = new TextInputBuilder().setCustomId('messageId').setLabel('رقم الرسالة المراد الرد عليها').setStyle(TextInputStyle.Short).setRequired(true);
      const bodyInput = new TextInputBuilder().setCustomId('body').setLabel('اكتب ردك').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(bodyInput));
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && action === 'sendModal') {
      const body = interaction.fields.getTextInputValue('body');
      const anon = anonymousMode.get(`${interaction.guildId}:${interaction.user.id}`) ?? true;
      const embed = makeEmbed(`رسالة ${serviceName}`, body, 0x5865F2);
      if (!anon) embed.setFooter({ text: `المرسل: ${interaction.user.tag}` });
      await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      return interaction.reply({ content: '✅ تم إرسال رسالتك.', ephemeral: true });
    }

    if (interaction.isModalSubmit() && action === 'replyModal') {
      const messageId = interaction.fields.getTextInputValue('messageId').trim();
      const body = interaction.fields.getTextInputValue('body');
      if (!/^\d{17,20}$/.test(messageId)) return interaction.reply({ content: '❌ رقم الرسالة غير صحيح.', ephemeral: true });
      const target = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!target) return interaction.reply({ content: '❌ ما لقيت الرسالة في هذا الروم.', ephemeral: true });
      const anon = anonymousMode.get(`${interaction.guildId}:${interaction.user.id}`) ?? true;
      const embed = makeEmbed(`رد عبر ${serviceName}`, body, 0x5865F2);
      if (!anon) embed.setFooter({ text: `المرسل: ${interaction.user.tag}` });
      await target.reply({ embeds: [embed], allowedMentions: { repliedUser: false, parse: [] } });
      return interaction.reply({ content: '✅ تم إرسال ردك.', ephemeral: true });
    }
  } catch (error) {
    console.error('Service interaction error:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ تعذر تنفيذ الطلب.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
