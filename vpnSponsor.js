import winston from "winston";
import fs from "fs/promises";

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

const VPN_CODES_FILE = "vpn_codes.json";

/**
 * Check if user is subscribed to all required channels
 * @param {import('telegraf').Telegraf} bot - Telegram bot instance
 * @param {number} userId - User ID
 * @param {string[]} channels - Array of channel usernames
 * @returns {Promise<{ isSubscribed: boolean, notSubscribedChannels: string[] }>} - Subscription status
 */
export async function checkSubscriptions(bot, userId, channels) {
  if (!channels.length) {
    logger.info("No channels required; granting VPN code access");
    return { isSubscribed: true, notSubscribedChannels: [] };
  }

  const notSubscribedChannels = [];
  for (const channel of channels) {
    try {
      const member = await bot.telegram.getChatMember(channel, userId);
      if (!["member", "administrator", "creator"].includes(member.status)) {
        notSubscribedChannels.push(channel);
        logger.info(`User ${userId} is not subscribed to ${channel}`);
      } else {
        logger.info(`User ${userId} is subscribed to ${channel}`);
      }
    } catch (error) {
      logger.error(
        `Failed to check subscription for ${channel}: ${error.message}`
      );
      notSubscribedChannels.push(channel); // Assume not subscribed if error occurs
    }
  }

  const isSubscribed = notSubscribedChannels.length === 0;
  logger.info(
    `User ${userId} subscription check: isSubscribed=${isSubscribed}, notSubscribedChannels=${JSON.stringify(
      notSubscribedChannels
    )}`
  );
  return { isSubscribed, notSubscribedChannels };
}

/**
 * Get or assign the latest VPN code for a user
 * @param {number} userId - User ID
 * @returns {Promise<string>} - VPN code
 */
export async function getVpnCode(userId) {
  try {
    const vpnCodes = await loadVpnCodes();

    if (vpnCodes.available_codes.length === 0 || !vpnCodes.active_code) {
      logger.error(`No VPN codes available for user ${userId}`);
      throw new Error(
        "No VPN codes available. Please contact an admin to add a code."
      );
    }

    // Check if user already has the active code
    if (vpnCodes.user_codes[userId] === vpnCodes.active_code) {
      logger.info(
        `User ${userId} already has active VPN code: ${vpnCodes.active_code}`
      );
      return vpnCodes.user_codes[userId];
    }

    // Assign the active code
    const code = vpnCodes.active_code;
    vpnCodes.user_codes[userId] = code;
    await saveVpnCodes(vpnCodes);
    logger.info(`Assigned VPN code ${code} to user ${userId}`);
    return code;
  } catch (error) {
    logger.error(`Failed to get VPN code for user ${userId}: ${error.message}`);
    throw error;
  }
}

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
