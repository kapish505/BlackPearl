# Discord Coral Source

This is a custom Coral source spec for Discord. It exposes the following tables:
- `guilds`: Maps to `/users/@me/guilds`. Use this table to fetch the Discord guilds (servers) you are a member of.
- `channels`: Maps to `/users/@me/channels`. Use this table to fetch your Discord channels.

This source uses the `http` backend to connect to `https://discord.com/api/v10/`.
