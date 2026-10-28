require("dotenv").config();
const { Client, GatewayIntentBits, PermissionsBitField, ActivityType } = require("discord.js");
const cron = require("node-cron");
const adhkar = require("./adhkar.json");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID || "1563095471684194364";
const PREFIX = "#";
const REACTIONS = [
  "<:heartblack:1448266921228111872>",
  "<:m19:1304110620949614593>",
  "<:s6:1304111319858810932>",
  "📿"
];

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN. Add your bot token in the hosting environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function getTargetChannel() {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.send) {
    console.error(`Could not access text channel ${CHANNEL_ID}. Check CHANNEL_ID and bot permissions.`);
    return null;
  }
  return channel;
}

async function reactToMessage(message) {
  for (const emoji of REACTIONS) {
    try {
      await message.react(emoji);
    } catch (err) {
      console.warn(`Could not add reaction ${emoji}: ${err.message}`);
    }
  }
}

async function sendAndReact(content) {
  const channel = await getTargetChannel();
  if (!channel) return;
  try {
    const message = await channel.send(content);
    await reactToMessage(message); // React explicitly to the bot's own messages.
  } catch (err) {
    console.error("Failed to send scheduled message:", err.message);
  }
}

function pick(category) {
  const list = adhkar[category];
  if (!Array.isArray(list) || list.length === 0) return "أستغفر الله العظيم وأتوب إليه.";
  return list[Math.floor(Math.random() * list.length)];
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{
      name: "yovnsy",
      type: ActivityType.Streaming,
      url: "https://www.twitch.tv/yovnsy"
    }],
    status: "online"
  });

  // All times use Saudi Arabia time.
  const tz = "Asia/Riyadh";
  const schedules = [
    ["25 5 * * *", "morning"],
    ["40 11 * * *", "home"],
    ["0 13 * * *", "general"],
    ["0 15 * * *", "distress"],
    ["25 18 * * *", "evening"],
    ["0 21 * * *", "sleep"],
    ["0 * * * *", "istighfar"],
    ["5 * * * *", "salawat"],
    ["10 */3 * * *", "duas"]
  ];

  for (const [expression, category] of schedules) {
    cron.schedule(expression, () => sendAndReact(pick(category)), { timezone: tz });
  }
  console.log("Adhkar schedules loaded (Asia/Riyadh).");
});

client.on("messageCreate", async (message) => {
  if (message.channelId !== CHANNEL_ID) return;

  // Auto-react to messages from members and other bots. The bot's own scheduled
  // and broadcast messages are reacted to by sendAndReact() because Discord
  // does not reliably deliver its own messageCreate event to this listener.
  if (message.author.id !== client.user.id) {
    await reactToMessage(message);
  }

  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const [command, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  if (command.toLowerCase() !== "bc") return;

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await message.reply("❌ هذا الأمر للإداريين فقط.");
    return;
  }

  const announcement = args.join(" ").trim();
  if (!announcement) {
    await message.reply("استخدم الأمر كذا: `#bc نص الإعلان`");
    return;
  }

  try {
    const sent = await message.channel.send(announcement);
    await reactToMessage(sent);
    await message.delete().catch(() => {});
  } catch (err) {
    console.error("Broadcast failed:", err.message);
    await message.reply("تعذر إرسال الإعلان. تأكد من صلاحيات البوت.");
  }
});

client.login(TOKEN);
