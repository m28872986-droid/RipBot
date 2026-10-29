# YOVN Discord Bot

## Features
- Scheduled adhkar in channel `1564997711965720586` using Saudi Arabia time.
- Four Unicode reactions on messages in the adhkar channel: ❤️ 🔥 ✨ 📿
- `#bc your announcement` sends the announcement by DM to non-bot members in the server. Only members with Administrator permission can use it.
- Streaming-style Discord presence for `yovnsy` on Twitch.

## Setup on ACLClouds
1. Upload/extract these files into the server's root folder.
2. Add an environment variable named `DISCORD_TOKEN` with your bot token. Do not share the token with anyone.
3. Ensure `CHANNEL_ID` is set to `1564997711965720586` (or change it if needed).
4. Set the startup command to `npm start` if the panel asks.
5. Install dependencies using the panel's install/rebuild option, then start the server.

## Discord Developer Portal
- Enable **Message Content Intent** under Bot settings.
- Enable **Server Members Intent** under Bot settings; this is needed to fetch all members for `#bc`.
- Invite the bot with View Channel, Send Messages, Read Message History, Add Reactions, and permission to send messages in the channels where admins use `#bc`.
- Do not grant Administrator to the bot. The `#bc` command checks that the *user* has Administrator.
- Some members may have DMs disabled or may block messages from server members. The bot reports successful, failed, and skipped DM counts.

## Important
- The bot token is intentionally not included. Add it privately in the host's environment variables.
- This is a starter adhkar collection; review religious text before using.
- Discord presence that says Streaming is a status label; it does not start a real Twitch broadcast.
- Scheduled posts are sent to the configured adhkar channel.

## Voice points
- Members earn 1 point per 10 minutes connected to any voice channel, including when muted or deafened.
- `!نقاطي` shows the member's points only.
- `!تحويل @member amount` transfers points to another member, e.g. `!تحويل @Ahmed 5`.
- Points are saved in `points.json`; ensure the host keeps this file between restarts.
- Enable the **Guild Voice States** intent if your hosting panel or Discord library setup requires it (discord.js v14 voiceStateUpdate is included by default with Guilds intent).
