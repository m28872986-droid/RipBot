require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActivityType
} = require("discord.js");
const cron = require("node-cron");
const adhkar = require("./adhkar.json");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID || "1564997711965720586";
const PREFIX = "#";

// Use Unicode emoji so reactions don't depend on custom emoji access/IDs.
const REACTIONS = ["❤️", "🔥", "✨", "📿"];

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN. Add your bot token in the hosting environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
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
    await reactToMessage(message);
  } catch (err) {
    console.error("Failed to send scheduled message:", err.message);
  }
}

function pick(category) {
  const list = adhkar[category];
  if (!Array.isArray(list) || list.length === 0) {
    return "أستغفر الله العظيم وأتوب إليه.";
  }
  return list[Math.floor(Math.random() * list.length)];
}

async function broadcastToMembers(message, announcement) {
  const guild = message.guild;
  if (!guild) {
    await message.reply("❌ استخدم الأمر داخل السيرفر.");
    return;
  }

  await message.reply("⏳ جاري إرسال الإعلان بالخاص لأعضاء السيرفر...");

  let members;
  try {
    // Requires Server Members Intent to be enabled in Discord Developer Portal.
    members = await guild.members.fetch();
  } catch (err) {
    console.error("Could not fetch guild members:", err.message);
    await message.channel.send(
      "❌ ما قدرت أجيب أعضاء السيرفر. فعّل **Server Members Intent** من Discord Developer Portal وتأكد من صلاحيات البوت."
    );
    return;
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [, member] of members) {
    if (member.user.bot) {
      skipped++;
      continue;
    }

    try {
      await member.send(announcement);
      sent++;
    } catch (err) {
      failed++;
      console.warn(`Could not DM member ${member.user.tag}: ${err.message}`);
    }
  }

  await message.channel.send(
    `✅ انتهى إرسال الإعلان بالخاص.\n` +
    `📨 نجح: **${sent}**\n` +
    `❌ تعذر الإرسال: **${failed}**\n` +
    `🤖 تم تخطي البوتات: **${skipped}**`
  );
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

  console.log(`Adhkar schedules loaded (Asia/Riyadh), channel ${CHANNEL_ID}.`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild) return;

  // Handle #bc in any channel in the server.
  if (!message.author.bot && message.content.startsWith(PREFIX)) {
    const [command, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);

    if (command?.toLowerCase() === "bc") {
      if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await message.reply("❌ هذا الأمر للإداريين فقط.");
        return;
      }

      const announcement = args.join(" ").trim();
      if (!announcement) {
        await message.reply("استخدم الأمر كذا: `#bc نص الإعلان`");
        return;
      }

      await broadcastToMembers(message, announcement);
      return;
    }
  }

  // Auto-react only in the configured adhkar channel.
  if (message.channelId !== CHANNEL_ID) return;
  if (message.author.id !== client.user.id) {
    await reactToMessage(message);
  }
});

client.login(TOKEN);
