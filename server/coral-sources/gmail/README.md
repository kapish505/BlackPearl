# Gmail Coral Source

This is a custom Coral source spec for Gmail. It exposes the following tables:
- `messages`: Maps to `/users/me/messages`. Use this table to fetch your Gmail messages.
- `threads`: Maps to `/users/me/threads`. Use this table to fetch your Gmail threads.

This source uses the `http` backend to connect to `https://gmail.googleapis.com/gmail/v1/`.
