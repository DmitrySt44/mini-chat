import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

export const sendPush = onRequest(
  {
    cors: true,
    region: "us-central1",
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      logger.error("OneSignal environment variables are missing");
      response.status(500).json({
        error: "OneSignal environment variables are missing",
      });
      return;
    }

    const {
      chatId,
      chatTitle,
      messageText,
      senderId,
      senderName,
      recipientIds,
    } = request.body || {};

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      response.status(400).json({ error: "recipientIds must be a non-empty array" });
      return;
    }

    if (!messageText || !senderName) {
      response.status(400).json({ error: "messageText and senderName are required" });
      return;
    }

    try {
      const oneSignalResponse = await fetch(
        "https://api.onesignal.com/notifications?c=push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${ONESIGNAL_API_KEY}`,
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: {
              external_id: recipientIds,
            },
            target_channel: "push",
            headings: {
              en: senderName,
              ru: senderName,
            },
            contents: {
              en: messageText,
              ru: messageText,
            },
            data: {
              chatId: chatId || null,
              chatTitle: chatTitle || null,
              senderId: senderId || null,
            },
            ttl: 60,
          }),
        }
      );

      const result = await oneSignalResponse.json().catch(() => null);

      if (!oneSignalResponse.ok) {
        logger.error("OneSignal push error", result || oneSignalResponse.statusText);
        response.status(oneSignalResponse.status).json({
          error: "OneSignal push failed",
          details: result || oneSignalResponse.statusText,
        });
        return;
      }

      response.status(200).json({
        ok: true,
        result,
      });
    } catch (error) {
      logger.error("Failed to send push notification", error);
      response.status(500).json({
        error: "Failed to send push notification",
      });
    }
  }
);
