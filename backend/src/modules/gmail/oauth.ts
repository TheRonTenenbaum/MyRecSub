import { google } from "googleapis";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the Google OAuth2 authorization URL
 */
export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens and create/update account
 */
export async function handleCallback(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user email
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email;

  if (!email) {
    throw new Error("Could not retrieve email from Google");
  }

  logger.info({ email }, "Gmail OAuth callback - saving account");

  // Upsert the account
  const account = await prisma.gmailAccount.upsert({
    where: { email },
    create: {
      email,
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || "",
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      isActive: true,
    },
    update: {
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      isActive: true,
    },
  });

  return account;
}

/**
 * Get an authenticated Gmail client for an account
 */
export async function getGmailClient(accountId: string) {
  const account = await prisma.gmailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Gmail account not found: ${accountId}`);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    logger.debug({ email: account.email }, "Refreshed Gmail tokens");
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: {
        accessToken: tokens.access_token || account.accessToken,
        refreshToken: tokens.refresh_token || account.refreshToken,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
