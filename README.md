# Telegram bot 

Telegram Book & VPN Bot
A Telegram bot that provides book recommendations using the Google Books API and distributes VPN codes upon subscribing to required Telegram channels. Admins can manage the list of required channels and set an active VPN code dynamically without editing configuration files. The bot includes anti-spam measures to prevent abuse. Built with Node.js and free, open-source dependencies for a cost-effective solution.
Table of Contents

Features
Prerequisites
Installation
Configuration
Running the Bot
Usage
Testing
Troubleshooting
Dependencies
Contributing
License

Features

Book Recommendations: Search for books using the public Google Books API with the /book <query> command (e.g., /book javascript).
VPN Code Distribution: Grants the active VPN code via the /vpn command, requiring non-admin users to subscribe to specified Telegram channels.
Dynamic Channel Management: Admins can update required channels using /admin <password> <channels> (e.g., /admin merdan1201 ["@channel1","@channel2"]), stored in channels.json for persistence.
VPN Code Management: Admins can set the active VPN code using /vpn <password> <code> (e.g., /vpn merdan1201 VPN-XYZ12345), stored in vpn_codes.json. The latest code is assigned to users, replacing their previous code.
Anti-Spam Protection:
Limits /vpn to 3 requests per 30 seconds and other commands (/book, /start, /help) to 10 requests per 60 seconds.
Temporarily blocks users for 5 minutes if limits are exceeded.
Warns users when nearing limits.
Admins bypass anti-spam restrictions.

Admin Bypass: Admins bypass channel subscription and anti-spam requirements for VPN codes.
Interactive Interface: /start command provides buttons for Books and VPN options.
Help Command: /help lists all commands.
Logging: Comprehensive logging with winston for debugging and monitoring.
Mobile-Friendly: Optimized responses for Telegram mobile clients (iOS/Android).
Free & Lightweight: Uses free dependencies and file-based persistence (channels.json, vpn_codes.json) to avoid paid databases.

Prerequisites

Node.js: Version 18 or higher (tested with v22.11.0). Install from nodejs.org.
Telegram Bot Token: Obtain from @BotFather on Telegram.
Telegram Channels: The bot must be an admin in all required channels (e.g., @Turkmen_Shadowsocks, @ubuntu24lts, @vitalityOfMerdanUSA).
Writable Directory: Ensure the project directory is writable for channels.json and vpn_codes.json.

Installation

Clone or Create Project Directory:
mkdir telegram-bot
cd telegram-bot
npm init -y

Install Dependencies:
npm install telegraf axios dotenv winston

Project Structure:Ensure the following files are in the project directory:
telegram-bot/
├── index.js
├── vpnSponsor.js
├── .env
├── package.json
├── channels.json (auto-created on first /admin command)
└── vpn_codes.json (auto-created on first /vpn <password> <code> command)

Add Source Files:

Copy index.js and vpnSponsor.js from the provided code (see Usage for details).
Create .env with the following content:TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ADMIN_PASSWORD=merdan1201

Configuration

Obtain Bot Token:

Open Telegram, message @BotFather, and use /newbot to create a bot.
Copy the provided token and add it to .env as TELEGRAM_BOT_TOKEN.

Set Admin Password:

Default password is merdan1201 (in .env). Change it to a secure password if needed.

Add Bot to Channels:

For each required channel (e.g., @Turkmen_Shadowsocks):
Go to channel settings > Administrators > Add Administrator.
Search for your bot and grant admin permissions (minimal permissions needed: view members).

Verify Directory Permissions:

Ensure the project directory (e.g., C:\Users\Qosmio\Desktop\me js\) is writable for channels.json and vpn_codes.json.
If permission issues occur, move the project to a directory like C:\Users\Qosmio\Documents\telegram-bot\.

Running the Bot

Start the Bot:
node index.js

For development with auto-restart on file changes:npm install -g nodemon
nodemon index.js

Stop the Bot:

Press Ctrl+C in the terminal.

Deploying (Optional):

Host on free platforms like Render or Replit.
Set environment variables (TELEGRAM_BOT_TOKEN, ADMIN_PASSWORD) in the platform’s dashboard.
Ensure the hosting environment supports file writes for channels.json and vpn_codes.json.

Usage
Interact with the bot via Telegram using the following commands:
Commands

/start:

Displays a welcome message with inline buttons for Books and VPN.
Example response:👋 Welcome to the Book Advice Bot!
I can recommend books and provide VPN codes after channel subscriptions.

Choose an option below:
[📚 Books] [🌐 VPN]

/book :

Searches for books using the Google Books API.
Example: /book javascript
Response:📚 _Book Recommendations_ 📚

📖 _Eloquent JavaScript_
✍️ Authors: Marijn Haverbeke
ℹ️ Description: A modern introduction to JavaScript...
🔗 [More Info](https://books.google.com/...)

/vpn:

For non-admins: Requires subscription to all channels in REQUIRED_CHANNELS.
Example (not subscribed):Please subscribe to the following channels to get a VPN code:

@Turkmen_Shadowsocks: https://t.me/Turkmen_Shadowsocks
@ubuntu24lts: https://t.me/ubuntu24lts

After subscribing, try /vpn again.

Example (subscribed or admin):🌐 _VPN Code_ 🌐

Your code: `VPN-XYZ12345`

Use it to activate your VPN!
(Granted due to channel subscriptions)

/vpn :

Admin-only command to set the active VPN code.
Example: /vpn merdan1201 VPN-XYZ12345
Response:✅ VPN code VPN-XYZ12345 set as the active code.

/admin :

Updates REQUIRED_CHANNELS and grants admin status.
Example: /admin merdan1201 ["@Turkmen_Shadowsocks","@ubuntu24lts"]
Response:✅ You are now an admin! Required channels updated from [] to [@Turkmen_Shadowsocks,@ubuntu24lts]

Saves channels to channels.json:[
"@Turkmen_Shadowsocks",
"@ubuntu24lts"
]

/help:

Lists all commands.
Example:📖 _Book Advice Bot Commands_ 📖

/start - Show welcome message and options
/book <query> - Search for book recommendations (e.g., /book javascript)
/vpn - Get a VPN code (requires channel subscriptions)
/vpn <password> <code> - Set the active VPN code (admin only, e.g., /vpn merdan1201 VPN-XYZ12345)
/admin <password> <channels> - Update required channels (e.g., /admin merdan1201 ["@channel1","@channel2"])
/help - Show this message

Anti-Spam Behavior

Rate Limits:
/vpn: 3 requests per 30 seconds.
/book, /start, /help: 10 requests per 60 seconds.
Admin commands (/admin, /vpn <password> <code>) and admin users bypass limits.

Warnings:
At limit (e.g., 3rd /vpn in 30 seconds):⚠️ You’re sending /vpn too fast. Slow down to avoid a 5-minute block.

Blocking:
Exceed limit (e.g., 4th /vpn in 30 seconds):🚫 Slow down! You’ve sent too many /vpn commands. You’re blocked for 5 minutes.

While blocked:🚫 You’re temporarily blocked for spamming. Try again in X minute(s).

Admin Workflow

Set channels:/admin merdan1201 ["@Turkmen_Shadowsocks","@ubuntu24lts"]

Set active VPN code:/vpn merdan1201 VPN-XYZ12345

Update VPN code:/vpn merdan1201 VPN-ABC67890

Non-admins must subscribe to all listed channels and respect anti-spam limits to use /vpn.

Testing

Setup:

Ensure index.js, vpnSponsor.js, and .env are configured.
Add bot as an admin to test channels (e.g., @Turkmen_Shadowsocks, @ubuntu24lts).

Test Cases:

/start:
Verify buttons (Books, VPN) appear on mobile and PC.

/book javascript:
Confirm book recommendations are returned.

/admin:
Run: /admin merdan1201 ["@Turkmen_Shadowsocks","@ubuntu24lts"].
Check channels.json and response.
Update: /admin merdan1201 ["@Turkmen_Shadowsocks","@ubuntu24lts","@vitalityOfMerdanUSA"].
Verify channels.json updates.

/vpn :
Run: /vpn merdan1201 VPN-XYZ12345.
Check vpn_codes.json:{
"available_codes": ["VPN-XYZ12345"],
"user_codes": {},
"active_code": "VPN-XYZ12345"
}

Run: /vpn merdan1201 VPN-ABC67890.
Check vpn_codes.json:{
"available_codes": ["VPN-ABC67890"],
"user_codes": {},
"active_code": "VPN-ABC67890"
}

/vpn (Non-Admin):
Use a non-admin Telegram account.
Run /vpn, confirm channel list.
Subscribe to channels, run /vpn, expect VPN-ABC67890.
Run /vpn again, confirm same VPN-ABC67890.
After admin runs /vpn merdan1201 VPN-NEW12345, run /vpn, expect VPN-NEW12345.
Test on mobile (iOS/Android) and PC.

/vpn (Admin):
Run /vpn after /admin, expect active code with (Granted due to admin status).

Anti-Spam:
Non-admin: Run /vpn 3 times in 30 seconds, expect warning on 3rd.
Run 4th /vpn, expect block message: You’re blocked for 5 minutes.
Try /vpn during block, expect remaining time message.
After 5 minutes, run /vpn, expect normal response.
Non-admin: Run /book javascript 10 times in 60 seconds, expect warning on 10th.
Run 11th /book, expect block.
Admin: Run /vpn rapidly, confirm no limits.
Check logs for User ... exceeded vpn limit or User ... nearing general limit.

No Codes Available:
Delete vpn_codes.json or set available_codes: [], active_code: null.
Run /vpn, expect No VPN codes available. Please contact an admin to add a code..

Persistence:
Restart bot, confirm /vpn returns the active code and anti-spam state resets.

Logs:

Check console for:
Loaded channels from channels.json: ...
Loaded VPN codes from vpn_codes.json: ...
User ... set VPN code ... as active code
User ... already has active VPN code: ...
Assigned VPN code ... to user ...
User ... nearing vpn limit ...
User ... exceeded vpn limit ... Blocked until ...
Unblocked user ... after block duration

Troubleshooting

Anti-Spam Blocking Legitimate Users:

Symptom: Users blocked too quickly.
Fix:
Check logs for User ... exceeded vpn limit or general limit.
Adjust antiSpamConfig in index.js (e.g., increase vpn.limit to 5).
Share logs and user feedback.

Anti-Spam Not Triggering:

Symptom: Spammers not blocked.
Fix:
Confirm user is not in admins Set.
Check logs for nearing vpn limit or exceeded vpn limit.
Rapidly send /vpn 4 times in 30 seconds, verify block.
Share logs and userRequests state (add console.log(userRequests) in middleware).

Multiple Codes Returned (Looping):

Symptom: /vpn returns multiple codes in a loop.
Fix:
Check logs for repeated Assigned VPN code ... to user ....
Delete vpn_codes.json, run /vpn merdan1201 VPN-XYZ12345, then /vpn.
Ensure single /vpn command execution (no rapid repeats).
Share logs, vpn_codes.json, and screenshot of looping output.

Wrong VPN Code Assigned:

Symptom: /vpn doesn’t return the added code.
Fix:
Check vpn_codes.json for available_codes and active_code.
Verify logs for Assigned VPN code ... to user ....
Delete vpn_codes.json, retry /vpn merdan1201 VPN-XYZ12345, then /vpn.

Empty REQUIRED_CHANNELS or vpn_codes.json:

Symptom: /vpn grants codes without subscriptions or no codes available.
Fix:
Check logs for Invalid /admin input or Invalid /vpn add input.
Ensure bot is an admin in channels.
Verify channels.json and vpn_codes.json exist and update.
Check for Failed to save ... (move to writable directory).

Mobile Text Issues:

Symptom: /vpn channel list, code, or anti-spam messages don’t display on mobile.
Fix:
Uses Markdown for channel list and MarkdownV2 for others; test on iOS/Android.
Share mobile OS, Telegram version, and screenshot.
Try plain text response by removing parse_mode.

Bot Crashes:

Symptom: Crashes on /vpn or other commands.
Fix:
Check logs for errors (e.g., MarkdownV2 parsing).
Ensure escapeMarkdownV2 is applied.
Share full logs.

Subscription Check Fails:

Symptom: /vpn doesn’t recognize subscriptions.
Fix:
Ensure bot is an admin in all channels.
Confirm channels are public.
Check logs for Failed to check subscription for ....

Permission Issues:

Symptom: Failed to save channels to channels.json or vpn_codes.json.
Fix:
Move project to a writable directory (e.g., C:\Users\Qosmio\Documents\telegram-bot\).
Run chmod -R u+w . on Linux/Mac.

Dependencies

telegraf: ^4.16.3 - Telegram bot framework.
axios: ^1.7.7 - HTTP client for Google Books API.
dotenv: ^16.4.5 - Environment variable management.
winston: ^3.14.2 - Logging library.
nodemon (optional): ^3.1.7 - Development auto-restart.

Contributing
Contributions are welcome! To contribute:

Fork the repository.
Create a feature branch (git checkout -b feature/new-feature).
Commit changes (git commit -m 'Add new feature').
Push to the branch (git push origin feature/new-feature).
Open a pull request.

Please include tests and update this README if new features are added.
License
This project is licensed under the MIT License. See the LICENSE file for details.

Built with 💻 by [Your Name or Handle]. For issues or feature requests, contact via Telegram or open an issue on the repository.
