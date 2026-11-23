import os
import re
import sqlite3
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

import discord
from discord.ext import commands, tasks
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN", "").strip()
PREFIX = "-"
TZ = ZoneInfo("Asia/Riyadh")
DEFAULT_GUILD_ID = 1564995425331847341
DEFAULT_CHANNEL_ID = 1564997590532096030
DB_PATH = os.getenv("DATABASE_PATH", "yovn_streaks.sqlite3")

intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix=PREFIX, intents=intents, help_command=None)
db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row

def init_db():
    with db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS streaks (
                guild_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                streak INTEGER NOT NULL DEFAULT 0,
                last_active TEXT,
                PRIMARY KEY (guild_id, user_id)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                guild_id INTEGER PRIMARY KEY,
                channel_id INTEGER NOT NULL,
                reminder_time TEXT NOT NULL DEFAULT '23:59'
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS sent_jobs (
                job_key TEXT PRIMARY KEY
            )
        """)
        db.execute(
            "INSERT OR IGNORE INTO settings(guild_id, channel_id, reminder_time) VALUES (?, ?, '23:59')",
            (DEFAULT_GUILD_ID, DEFAULT_CHANNEL_ID)
        )

def get_settings(guild_id):
    row = db.execute("SELECT * FROM settings WHERE guild_id=?", (guild_id,)).fetchone()
    if row:
        return row["channel_id"], row["reminder_time"]
    return DEFAULT_CHANNEL_ID, "23:59"

def set_channel(guild_id, channel_id):
    _, reminder_time = get_settings(guild_id)
    with db:
        db.execute("""
            INSERT INTO settings(guild_id, channel_id, reminder_time) VALUES (?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id
        """, (guild_id, channel_id, reminder_time))

def set_reminder_time(guild_id, value):
    channel_id, _ = get_settings(guild_id)
    with db:
        db.execute("""
            INSERT INTO settings(guild_id, channel_id, reminder_time) VALUES (?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET reminder_time=excluded.reminder_time
        """, (guild_id, channel_id, value))

def get_streak(guild_id, user_id):
    return db.execute(
        "SELECT * FROM streaks WHERE guild_id=? AND user_id=?",
        (guild_id, user_id)
    ).fetchone()

def save_streak(guild_id, user_id, streak, last_active):
    with db:
        db.execute("""
            INSERT INTO streaks(guild_id, user_id, streak, last_active)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id, user_id)
            DO UPDATE SET streak=excluded.streak, last_active=excluded.last_active
        """, (guild_id, user_id, streak, last_active))

def all_streaks(guild_id):
    return db.execute(
        "SELECT * FROM streaks WHERE guild_id=? AND streak>0 ORDER BY streak DESC",
        (guild_id,)
    ).fetchall()

def mark_job(job_key):
    with db:
        cur = db.execute("INSERT OR IGNORE INTO sent_jobs(job_key) VALUES (?)", (job_key,))
    return cur.rowcount == 1

def is_image_attachment(attachment):
    if attachment.content_type and attachment.content_type.lower().startswith("image/"):
        return True
    return attachment.filename.lower().endswith(
        (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif")
    )

def has_image_or_sticker(message):
    return bool(message.stickers) or any(is_image_attachment(a) for a in message.attachments)

def make_embed(title, description, color):
    return discord.Embed(title=title, description=description, color=color)

def room_link(guild_id, channel_id):
    return f"https://discord.com/channels/{guild_id}/{channel_id}"

def is_admin():
    async def predicate(ctx):
        if not ctx.guild or not ctx.author.guild_permissions.administrator:
            raise commands.MissingPermissions(["administrator"])
        return True
    return commands.check(predicate)

async def get_streak_channel(guild):
    channel_id, _ = get_settings(guild.id)
    channel = guild.get_channel(channel_id)
    if channel is None:
        try:
            channel = await guild.fetch_channel(channel_id)
        except (discord.NotFound, discord.Forbidden, discord.HTTPException):
            return None
    return channel

async def send_dm(member, embed):
    try:
        await member.send(embed=embed)
        return True
    except (discord.Forbidden, discord.HTTPException):
        return False

@bot.event
async def on_ready():
    init_db()
    if not daily_scheduler.is_running():
        daily_scheduler.start()
    print(f"Logged in as {bot.user} | Prefix: {PREFIX}")

@bot.event
async def on_message(message):
    if message.author.bot or not message.guild:
        return

    await bot.process_commands(message)

    channel_id, _ = get_settings(message.guild.id)
    if message.channel.id != channel_id:
        return
    if not has_image_or_sticker(message):
        return

    today = datetime.now(TZ).date()
    today_s = today.isoformat()
    row = get_streak(message.guild.id, message.author.id)

    if row and row["last_active"] == today_s:
        embed = make_embed(
            "الستريك مُحدّث بالفعل",
            f"{message.author.mention}\n\nستريكك الحالي: **🔥 {row['streak']} 🔥**",
            discord.Color.gold()
        )
        await message.add_reaction("⚠️")
        await message.channel.send(embed=embed)
        return

    old_streak = row["streak"] if row else 0
    last_active = date.fromisoformat(row["last_active"]) if row and row["last_active"] else None
    if last_active == today - timedelta(days=1):
        new_streak = old_streak + 1
    else:
        new_streak = 1

    save_streak(message.guild.id, message.author.id, new_streak, today_s)
    embed = make_embed(
        "تم تحديث الستريك!",
        f"{message.author.mention}\n\n# 🔥 {new_streak} 🔥",
        discord.Color.green()
    )
    await message.add_reaction("✅")
    await message.channel.send(embed=embed)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        await ctx.send(embed=make_embed(
            "صلاحيات غير كافية",
            "هذا الأمر يتطلب صلاحية **Administrator**.",
            discord.Color.red()
        ))
    elif isinstance(error, commands.CommandNotFound):
        return
    elif isinstance(error, commands.BadArgument):
        await ctx.send("الاستخدام غير صحيح. استخدم `-help` لعرض الأوامر.")
    elif isinstance(error, commands.MissingRequiredArgument):
        await ctx.send("ناقصك مدخل للأمر. استخدم `-help` لعرض طريقة الاستخدام.")
    else:
        print(f"Command error: {repr(error)}")
        await ctx.send("حدث خطأ أثناء تنفيذ الأمر.")

@bot.command(name="top")
async def top(ctx):
    rows = all_streaks(ctx.guild.id)
    if not rows:
        await ctx.send(embed=make_embed("🏆 ترتيب الستريكات", "ما فيه ستريكات مسجلة حاليًا.", discord.Color.blurple()))
        return
    medals = ["🥇", "🥈", "🥉"]
    lines = []
    for i, row in enumerate(rows[:20]):
        prefix = medals[i] if i < 3 else f"`{i+1}.`"
        lines.append(f"{prefix} <@{row['user_id']}> — **{row['streak']}** 🔥")
    await ctx.send(embed=make_embed("🏆 ترتيب الستريكات", "\n".join(lines), discord.Color.blurple()))

@bot.command(name="reset")
@is_admin()
async def reset(ctx, member: discord.Member):
    save_streak(ctx.guild.id, member.id, 0, None)
    await ctx.send(embed=make_embed("تم تصفير الستريك", f"تم تصفير ستريك {member.mention}.", discord.Color.orange()))

@bot.command(name="resetall")
@is_admin()
async def resetall(ctx):
    with db:
        db.execute("DELETE FROM streaks WHERE guild_id=?", (ctx.guild.id,))
    await ctx.send(embed=make_embed("تم تصفير جميع الستريكات", "تم تصفير ستريكات جميع الأعضاء.", discord.Color.red()))

@bot.command(name="add")
@is_admin()
async def add(ctx, member: discord.Member, amount: int):
    if amount < 1:
        await ctx.send("اكتب رقمًا أكبر من صفر.")
        return
    row = get_streak(ctx.guild.id, member.id)
    current = row["streak"] if row else 0
    last_active = row["last_active"] if row else datetime.now(TZ).date().isoformat()
    save_streak(ctx.guild.id, member.id, current + amount, last_active)
    await ctx.send(embed=make_embed("تمت إضافة أيام", f"ستريك {member.mention} أصبح **{current + amount}** 🔥", discord.Color.green()))

@bot.command(name="set")
@is_admin()
async def set_streak(ctx, member: discord.Member, amount: int):
    if amount < 0:
        await ctx.send("لا يمكن تحديد رقم أقل من صفر.")
        return
    row = get_streak(ctx.guild.id, member.id)
    last_active = row["last_active"] if row else datetime.now(TZ).date().isoformat()
    save_streak(ctx.guild.id, member.id, amount, last_active)
    await ctx.send(embed=make_embed("تم تعديل الستريك", f"ستريك {member.mention} أصبح **{amount}** 🔥", discord.Color.green()))

@bot.command(name="channel")
@is_admin()
async def channel(ctx, target: discord.TextChannel):
    set_channel(ctx.guild.id, target.id)
    await ctx.send(embed=make_embed("تم تحديد روم الستريك", f"الروم المعتمد: {target.mention}", discord.Color.green()))

@bot.command(name="time")
@is_admin()
async def time_command(ctx, value: str):
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
        await ctx.send("اكتب الوقت بصيغة `HH:MM` مثل `23:59`.")
        return
    set_reminder_time(ctx.guild.id, value)
    await ctx.send(embed=make_embed("تم تغيير وقت التذكير", f"وقت التذكير الجديد: **{value}** بتوقيت السعودية.", discord.Color.green()))

@bot.command(name="stats")
@is_admin()
async def stats(ctx):
    rows = all_streaks(ctx.guild.id)
    total = len(rows)
    total_days = sum(r["streak"] for r in rows)
    await ctx.send(embed=make_embed("إحصائيات الستريك", f"الأعضاء أصحاب الستريكات: **{total}**\nمجموع أيام الستريك: **{total_days}** 🔥", discord.Color.blurple()))

async def send_reminders(guild, today):
    channel = await get_streak_channel(guild)
    pending = []
    for row in all_streaks(guild.id):
        if row["last_active"] != today.isoformat():
            member = guild.get_member(row["user_id"])
            if member is None:
                continue
            pending.append((member, row["streak"]))

    if not pending:
        if channel:
            await channel.send(embed=make_embed(
                "تذكير الستريك",
                "🎉 جميع الأعضاء حدثوا ستريكاتهم اليوم!",
                discord.Color.green()
            ))
        return

    link = room_link(guild.id, get_settings(guild.id)[0])
    for member, streak in pending:
        dm = make_embed(
            "🔥 لا تنسى ستريكك!",
            f"# باقي وقت قليل!\n\nلا تنسى تحدث ستريكك قبل نهاية اليوم.\n\n**ستريكك الحالي: 🔥 {streak} 🔥**\n\n[اضغط هنا لتحديث الستريك]({link})",
            discord.Color.green()
        )
        await send_dm(member, dm)

    if channel:
        lines = [f"{i}. {member.mention} — 🔥 **{streak}**" for i, (member, streak) in enumerate(pending, 1)]
        await channel.send(embed=make_embed(
            "تذكير الستريك",
            f"**إجمالي الأعضاء:** {len(pending)}\n\n" + "\n".join(lines),
            discord.Color.green()
        ))

async def expire_streaks(guild, yesterday):
    channel = await get_streak_channel(guild)
    expired = []
    for row in all_streaks(guild.id):
        if row["last_active"] != yesterday.isoformat():
            member = guild.get_member(row["user_id"])
            expired.append((member, row["user_id"], row["streak"]))
            save_streak(guild.id, row["user_id"], 0, row["last_active"])

    link = room_link(guild.id, get_settings(guild.id)[0])
    for member, user_id, old_streak in expired:
        if member:
            dm = make_embed(
                "❌ انتهى الستريك",
                f"# ❌ انتهى الستريك\n\nانتهت مدة تحديث الستريك الخاص بك.\n\n**الستريك السابق: {old_streak} يوم**\n\n[ابدأ ستريك جديد من هنا]({link})",
                discord.Color.red()
            )
            await send_dm(member, dm)

    if channel and expired:
        lines = [f"{i}. <@{user_id}> — كان **{old_streak}** 🔥" for i, (_, user_id, old_streak) in enumerate(expired, 1)]
        await channel.send(embed=make_embed(
            "❌ انتهاء الستريك",
            f"**إجمالي الأعضاء:** {len(expired)}\n\n" + "\n".join(lines),
            discord.Color.red()
        ))

@tasks.loop(seconds=20)
async def daily_scheduler():
    now = datetime.now(TZ)
    today = now.date()
    for guild in bot.guilds:
        _, reminder_time = get_settings(guild.id)
        if now.strftime("%H:%M") == reminder_time:
            job = f"reminder:{guild.id}:{today.isoformat()}"
            if mark_job(job):
                await send_reminders(guild, today)
        if now.strftime("%H:%M") == "00:01":
            yesterday = today - timedelta(days=1)
            job = f"expire:{guild.id}:{yesterday.isoformat()}"
            if mark_job(job):
                await expire_streaks(guild, yesterday)

@daily_scheduler.before_loop
async def before_scheduler():
    await bot.wait_until_ready()

@bot.command(name="help")
async def help_command(ctx):
    embed = make_embed(
        "Yovn Streak — الأوامر",
        "**للأعضاء**\n`-top` عرض ترتيب الستريكات.\n\n"
        "**للإدارة (Administrator فقط)**\n"
        "`-reset @user` تصفير ستريك عضو\n"
        "`-resetall` تصفير ستريكات الجميع\n"
        "`-add @user 10` إضافة أيام\n"
        "`-set @user 20` تحديد عدد الأيام\n"
        "`-remind` إرسال التذكير يدويًا\n"
        "`-stats` إحصائيات الستريك\n"
        "`-channel #room` تحديد روم الستريك\n"
        "`-time 23:59` تحديد وقت التذكير",
        discord.Color.blurple()
    )
    await ctx.send(embed=embed)

@bot.command(name="remind")
@is_admin()
async def remind(ctx):
    await send_reminders(ctx.guild, datetime.now(TZ).date())
    await ctx.send("تم إرسال التذكير.")

if __name__ == "__main__":
    init_db()
    if not TOKEN:
        raise SystemExit("ضع DISCORD_TOKEN في ملف .env قبل تشغيل البوت.")
    bot.run(TOKEN)
