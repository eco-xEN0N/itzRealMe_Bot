import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import winston from "winston";
import fs from "fs/promises";
import { getVpnCode, checkSubscriptions } from "./vpnSponsor.js";

// Configure logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

// Load environment variables
dotenv.config();
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CHANNELS_FILE = "channels.json";
const VPN_CODES_FILE = "vpn_codes.json";

// Initialize REQUIRED_CHANNELS
let REQUIRED_CHANNELS = [];
async function loadChannels() {
  try {
    const data = await fs.readFile(CHANNELS_FILE, "utf8");
    REQUIRED_CHANNELS = JSON.parse(data);
    logger.info(
      `Loaded channels from ${CHANNELS_FILE}: ${JSON.stringify(
        REQUIRED_CHANNELS
      )}`
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.error(
        `Failed to load channels from ${CHANNELS_FILE}: ${error.message}`
      );
    } else {
      logger.info(`No ${CHANNELS_FILE} found; starting with empty channels`);
    }
    REQUIRED_CHANNELS = [];
    await saveChannels(); // Create empty channels.json
  }
}
async function saveChannels() {
  try {
    await fs.writeFile(
      CHANNELS_FILE,
      JSON.stringify(REQUIRED_CHANNELS, null, 2)
    );
    logger.info(
      `Saved channels to ${CHANNELS_FILE}: ${JSON.stringify(REQUIRED_CHANNELS)}`
    );
  } catch (error) {
    logger.error(
      `Failed to save channels to ${CHANNELS_FILE}: ${error.message}`
    );
  }
}

// Load channels on startup
loadChannels();

// Validate environment variables
if (!TELEGRAM_TOKEN) {
  logger.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  logger.error("Missing ADMIN_PASSWORD in .env");
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(TELEGRAM_TOKEN);
const admins = new Set(); // Store admin user IDs (in-memory)

// Anti-spam configuration
const antiSpamConfig = {
  vpn: { limit: 3, windowMs: 30_000 }, // 3 /vpn requests per 30 seconds
  general: { limit: 10, windowMs: 60_000 }, // 10 other commands per 60 seconds
  blockDurationMs: 5 * 60_000, // Block for 5 minutes
};
const userRequests = new Map(); // Track requests: { userId: { vpn: [], general: [], blockedUntil: null } }
setInterval(() => {
  // Clean up expired request timestamps
  for (const [userId, data] of userRequests) {
    const now = Date.now();
    data.vpn = data.vpn.filter((ts) => now - ts < antiSpamConfig.vpn.windowMs);
    data.general = data.general.filter(
      (ts) => now - ts < antiSpamConfig.general.windowMs
    );
    if (data.blockedUntil && now > data.blockedUntil) {
      data.blockedUntil = null;
      logger.info(`Unblocked user ${userId} after block duration`);
    }
    if (!data.vpn.length && !data.general.length && !data.blockedUntil) {
      userRequests.delete(userId);
    }
  }
}, 10_000); // Clean every 10 seconds

/**
 * Anti-spam middleware
 * @param {import('telegraf').Context} ctx - Telegraf context
 * @param {Function} next - Next middleware
 */
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) {
    logger.warn("No user ID in context");
    return next();
  }

  // Admins bypass anti-spam
  if (admins.has(userId)) {
    logger.info(`User ${userId} (admin) bypassed anti-spam`);
    return next();
  }

  // Initialize user data
  if (!userRequests.has(userId)) {
    userRequests.set(userId, { vpn: [], general: [], blockedUntil: null });
  }
  const userData = userRequests.get(userId);

  // Check if user is blocked
  const now = Date.now();
  if (userData.blockedUntil && now < userData.blockedUntil) {
    const remainingMs = userData.blockedUntil - now;
    const remainingMin = Math.ceil(remainingMs / 60_000);
    logger.warn(
      `User ${userId} blocked until ${new Date(
        userData.blockedUntil
      ).toISOString()}`
    );
    return ctx.reply(
      escapeMarkdownV2(
        `🚫 You’re temporarily blocked for spamming. Try again in ${remainingMin} minute${
          remainingMin > 1 ? "s" : ""
        }.`
      ),
      { parse_mode: "MarkdownV2" }
    );
  }

  // Determine command type
  const messageText = ctx.message?.text || "";
  const isVpnCommand =
    messageText.startsWith("/vpn") && !messageText.includes(ADMIN_PASSWORD);
  const commandType = isVpnCommand ? "vpn" : "general";
  const config = antiSpamConfig[commandType];

  // Record request
  userData[commandType].push(now);

  // Filter requests within window
  userData[commandType] = userData[commandType].filter(
    (ts) => now - ts < config.windowMs
  );

  // Check limit
  if (userData[commandType].length > config.limit) {
    userData.blockedUntil = now + antiSpamConfig.blockDurationMs;
    logger.warn(
      `User ${userId} exceeded ${commandType} limit (${config.limit} in ${
        config.windowMs
      }ms). Blocked until ${new Date(userData.blockedUntil).toISOString()}`
    );
    return ctx.reply(
      escapeMarkdownV2(
        `🚫 Slow down! You’ve sent too many ${
          isVpnCommand ? "/vpn" : "commands"
        }. You’re blocked for 5 minutes.`
      ),
      { parse_mode: "MarkdownV2" }
    );
  }

  // Warn if close to limit
  if (userData[commandType].length === config.limit) {
    logger.info(
      `User ${userId} nearing ${commandType} limit (${config.limit} in ${config.windowMs}ms)`
    );
    ctx.reply(
      escapeMarkdownV2(
        `⚠️ You’re sending ${
          isVpnCommand ? "/vpn" : "commands"
        } too fast. Slow down to avoid a 5-minute block.`
      ),
      { parse_mode: "MarkdownV2" }
    );
  }

  return next();
});

/**
 * Escape MarkdownV2 special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeMarkdownV2(text) {
  return text.replace(/([_*[\]()~`>#+=|{}.!\\-])/g, "\\$1");
}

/**
 * Escape Markdown special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeMarkdown(text) {
  return text.replace(/([_*`[])/g, "\\$1");
}

// Start command with VPN button
bot.command("start", (ctx) => {
  logger.info(`Processing /start for user ${ctx.from.id}`);
  const welcomeMessage = escapeMarkdownV2(
    "👋 Welcome to the VPN Bot!\n" +
      "I provide VPN codes after channel subscriptions.\n\n" +
      "Choose an option below:"
  );
  try {
    ctx.reply(welcomeMessage, {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 VPN", callback_data: "vpn" }]],
      },
    });
    logger.info("Sent /start message with VPN button");
  } catch (error) {
    logger.error(`Failed to send /start message: ${error.message}`);
    ctx.reply(
      escapeMarkdownV2("⚠️ Error displaying options. Please try again."),
      { parse_mode: "MarkdownV2" }
    );
  }
});

// Handle VPN button click
bot.action("vpn", (ctx) => {
  ctx.reply(escapeMarkdownV2("To get a VPN code, use /vpn"), {
    parse_mode: "MarkdownV2",
  });
  ctx.answerCbQuery();
});

// Help command
bot.command("help", (ctx) => {
  const helpMessage = escapeMarkdownV2(
    "🌐 *VPN Bot Commands* 🌐\n\n" +
      "/start - Show welcome message and options\n" +
      "/vpn - Get a VPN code (requires channel subscriptions)\n" +
      "/vpn <password> <code> - Set the active VPN code (admin only, e.g., /vpn YourPassword VPN-XYZ12345)\n" +
      '/admin <password> <channels> - Update required channels (e.g., /admin YourPassword ["@channel1","@channel2"])\n' +
      "/help - Show this message"
  );
  ctx.reply(helpMessage, { parse_mode: "MarkdownV2" });
});

// Admin command
bot.command("admin", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1).join(" ").trim();
  if (!args) {
    return ctx.reply(
      escapeMarkdownV2(
        'Please provide a password and channels. Example: /admin YourPassword ["@Turkmen_Shadowsocks","@ubuntu24lts"]'
      ),
      {
        parse_mode: "MarkdownV2",
      }
    );
  }

  // Extract password and channels
  let password, channels;
  try {
    const parts = args.match(/^(\S+)\s+(.+)$/);
    if (!parts) throw new Error("Invalid format");
    password = parts[1];
    channels = JSON.parse(parts[2]);
    logger.info(
      `Parsed /admin input: password=${password}, channels=${JSON.stringify(
        channels
      )}`
    );
  } catch (error) {
    logger.error(`Invalid /admin input: ${args}, Error: ${error.message}`);
    return ctx.reply(
      escapeMarkdownV2(
        '❌ Invalid format. Use: /admin <password> ["@channel1","@channel2"]'
      ),
      {
        parse_mode: "MarkdownV2",
      }
    );
  }

  // Validate password
  if (password !== ADMIN_PASSWORD) {
    logger.info(`Invalid password attempt for /admin by user ${ctx.from.id}`);
    return ctx.reply(escapeMarkdownV2("❌ Invalid password."), {
      parse_mode: "MarkdownV2",
    });
  }

  // Validate channels
  if (
    !Array.isArray(channels) ||
    !channels.every((ch) => typeof ch === "string" && ch.startsWith("@"))
  ) {
    logger.info(
      `Invalid channels format by user ${ctx.from.id}: ${JSON.stringify(
        channels
      )}`
    );
    return ctx.reply(
      escapeMarkdownV2(
        "❌ Channels must be an array of valid Telegram usernames starting with @."
      ),
      {
        parse_mode: "MarkdownV2",
      }
    );
  }

  // Verify bot is admin in channels
  for (const channel of channels) {
    try {
      const botMember = await bot.telegram.getChatMember(
        channel,
        bot.botInfo.id
      );
      if (!["administrator", "creator"].includes(botMember.status)) {
        logger.info(`Bot is not admin in ${channel}`);
        return ctx.reply(
          escapeMarkdownV2(
            `❌ Bot must be an admin in ${channel}. Please add the bot as an admin and try again.`
          ),
          {
            parse_mode: "MarkdownV2",
          }
        );
      }
    } catch (error) {
      logger.error(
        `Failed to verify bot admin status in ${channel}: ${error.message}`
      );
      return ctx.reply(
        escapeMarkdownV2(
          `❌ Error verifying bot admin status in ${channel}. Ensure the channel is public and the bot is an admin.`
        ),
        {
          parse_mode: "MarkdownV2",
        }
      );
    }
  }

  // Update channels and grant admin status
  const oldChannels = [...REQUIRED_CHANNELS];
  REQUIRED_CHANNELS = channels;
  await saveChannels();
  admins.add(ctx.from.id);
  ctx.reply(
    escapeMarkdownV2(
      `✅ You are now an admin! Required channels updated from [${oldChannels.join(
        ", "
      )}] to [${channels.join(", ")}]`
    ),
    {
      parse_mode: "MarkdownV2",
    }
  );
  logger.info(
    `Admin ${ctx.from.id} updated REQUIRED_CHANNELS from ${JSON.stringify(
      oldChannels
    )} to ${JSON.stringify(channels)}`
  );
});

// VPN code add command
bot.command("vpn", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1).join(" ").trim();
  const userId = ctx.from.id;
  logger.info(
    `Processing /vpn for user ${userId}, args=${args}, admin=${admins.has(
      userId
    )}`
  );

  // Check if command is for adding a VPN code
  if (args) {
    let password, vpnCode;
    try {
      const parts = args.match(/^(\S+)\s+(.+)$/);
      if (!parts) throw new Error("Invalid format");
      password = parts[1];
      vpnCode = parts[2].trim();
      logger.info(
        `Parsed /vpn add input: password=${password}, vpnCode=${vpnCode}`
      );
    } catch (error) {
      logger.error(`Invalid /vpn add input: ${args}, Error: ${error.message}`);
      return ctx.reply(
        escapeMarkdownV2(
          "❌ Invalid format. Use: /vpn <password> <code> (e.g., /vpn YourPassword VPN-XYZ12345) or /vpn"
        ),
        {
          parse_mode: "MarkdownV2",
        }
      );
    }

    // Validate password
    if (password !== ADMIN_PASSWORD) {
      logger.info(`Invalid password attempt for /vpn add by user ${userId}`);
      return ctx.reply(escapeMarkdownV2("❌ Invalid password."), {
        parse_mode: "MarkdownV2",
      });
    }

    // Add VPN code (replace available_codes)
    try {
      const vpnCodes = await loadVpnCodes();
      vpnCodes.available_codes = [vpnCode]; // Replace with new code
      vpnCodes.active_code = vpnCode; // Track active code explicitly
      await saveVpnCodes(vpnCodes);
      ctx.reply(
        escapeMarkdownV2(`✅ VPN code ${vpnCode} set as the active code.`),
        { parse_mode: "MarkdownV2" }
      );
      logger.info(`User ${userId} set VPN code ${vpnCode} as active code`);
    } catch (error) {
      logger.error(`Failed to add VPN code ${vpnCode}: ${error.message}`);
      ctx.reply(
        escapeMarkdownV2("⚠️ Error setting VPN code. Please try again."),
        { parse_mode: "MarkdownV2" }
      );
    }
    return;
  }

  // Existing /vpn logic for getting a code
  logger.info(
    `Processing /vpn get for user ${userId}, channels=${JSON.stringify(
      REQUIRED_CHANNELS
    )}`
  );
  if (admins.has(userId)) {
    try {
      const code = await getVpnCode(userId);
      return ctx.reply(
        escapeMarkdownV2(
          `🌐 *VPN Code* 🌐\n\nYour code: \`${code}\`\n\nUse it to activate your VPN!\n(Granted due to admin status)`
        ),
        { parse_mode: "MarkdownV2" }
      );
    } catch (error) {
      logger.error(`Failed to send /vpn admin response: ${error.message}`);
      return ctx.reply(escapeMarkdownV2(`⚠️ ${error.message}`), {
        parse_mode: "MarkdownV2",
      });
    }
  }

  try {
    const { isSubscribed, notSubscribedChannels } = await checkSubscriptions(
      bot,
      userId,
      REQUIRED_CHANNELS
    );
    if (isSubscribed) {
      try {
        const code = await getVpnCode(userId);
        ctx.reply(
          escapeMarkdownV2(
            `🌐 *VPN Code* 🌐\n\nYour code: \`${code}\`\n\nUse it to activate your VPN!\n(Granted due to channel subscriptions)`
          ),
          { parse_mode: "MarkdownV2" }
        );
      } catch (error) {
        logger.error(
          `Failed to send /vpn subscription response: ${error.message}`
        );
        ctx.reply(escapeMarkdownV2(`⚠️ ${error.message}`), {
          parse_mode: "MarkdownV2",
        });
      }
    } else {
      const channelLinks = notSubscribedChannels
        .map(
          (channel) =>
            `${escapeMarkdown(channel)}: https://t.me/${channel.slice(1)}`
        )
        .join("\n");
      const response = `Please subscribe to the following channels to get a VPN code:\n\n${channelLinks}\n\nAfter subscribing, try /vpn again.`;
      logger.info(`Sending /vpn response to user ${userId}: ${response}`);
      ctx.reply(response, { parse_mode: "Markdown" });
    }
  } catch (error) {
    logger.error(`Error checking subscriptions: ${error.message}`);
    ctx.reply(
      escapeMarkdownV2(
        "⚠️ Error checking subscriptions. Please try again later."
      ),
      { parse_mode: "MarkdownV2" }
    );
  }
});

// VPN codes file handling
async function loadVpnCodes() {
  try {
    const data = await fs.readFile(VPN_CODES_FILE, "utf8");
    const vpnCodes = JSON.parse(data);
    logger.info(
      `Loaded VPN codes from ${VPN_CODES_FILE}: ${JSON.stringify(vpnCodes)}`
    );
    return vpnCodes;
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.error(
        `Failed to load VPN codes from ${VPN_CODES_FILE}: ${error.message}`
      );
    } else {
      logger.info(`No ${VPN_CODES_FILE} found; starting with empty codes`);
    }
    const vpnCodes = { available_codes: [], user_codes: {}, active_code: null };
    await saveVpnCodes(vpnCodes);
    return vpnCodes;
  }
}

async function saveVpnCodes(vpnCodes) {
  try {
    await fs.writeFile(VPN_CODES_FILE, JSON.stringify(vpnCodes, null, 2));
    logger.info(
      `Saved VPN codes to ${VPN_CODES_FILE}: ${JSON.stringify(vpnCodes)}`
    );
  } catch (error) {
    logger.error(
      `Failed to save VPN codes to ${VPN_CODES_FILE}: ${error.message}`
    );
    throw error;
  }
}

// Error handling
bot.catch((err, ctx) => {
  logger.error(
    `Error for update ${JSON.stringify(ctx.update)}: ${err.message}`
  );
  ctx.reply(escapeMarkdownV2("⚠️ An error occurred. Please try again later."), {
    parse_mode: "MarkdownV2",
  });
});

// Start bot
async function main() {
  logger.info("Starting bot...");
  await bot.launch();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((err) => {
  logger.error(`Failed to start bot: ${err.message}`);
  process.exit(1);
});
