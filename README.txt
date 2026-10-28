# YOVN Discord Bot

## Included
- Scheduled adhkar in channel `1563095471684194364` using Saudi Arabia time.
- Four automatic reactions on messages in that channel.
- `#bc your announcement` command, restricted to Discord members with Administrator permission.
- Streaming-style Discord presence for `yovnsy` on Twitch.

## Setup on ACLClouds
1. Upload/extract these files into the server's root folder.
2. Add an environment variable named `DISCORD_TOKEN` with your bot token. Do not share the token with anyone.
3. Ensure `CHANNEL_ID` is set to `1563095471684194364` (or change it if needed).
4. Set the startup command to `npm start` if the panel asks.
5. Install dependencies using the panel's install/rebuild option, then start the server.

## Discord Developer Portal
- Enable **Message Content Intent** under Bot settings.
- Invite the bot with View Channel, Send Messages, Read Message History, Add Reactions, and Use External Emojis.
- Do not grant Administrator to the bot. The `#bc` command checks that the *user* has Administrator.
- Custom emojis from other servers may fail unless the bot can use external emojis and the emoji is accessible to the bot.

## Important
- The bot token is intentionally not included in this ZIP. Add it privately in the host's environment variables.
- This is a starter adhkar collection, not hundreds of entries. Review religious text before using; add verified entries to `adhkar.json` if desired.
- Discord presence that says Streaming is a status label; it does not start a real Twitch broadcast.
- Scheduled posts are sent to the same channel used for auto-reactions.
