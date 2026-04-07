const ONESIGNAL_APP_ID = "0ee2af92-ab64-451e-9e70-1bdce50487fe";
const ONESIGNAL_API_KEY = "os_v2_app_b3rk7evlmrcr5htqdpookbeh73etis5hr23unaffiwt723gan2jhultaxf6hnfeacplehbez4wpq5lftouk257e2wixt6m2yc5ozfsa";

export async function sendPushNotification({
  chatId,
  chatTitle,
  messageText,
  senderId,
  senderName,
  recipientIds,
}) {
  if (!recipientIds || recipientIds.length === 0) {
    return;
  }

  try {
    const response = await fetch("https://api.onesignal.com/notifications?c=push", {
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
          chatId,
          chatTitle,
          senderId,
        },
        ttl: 60,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("OneSignal push error:", result || response.statusText);
      return;
    }

    console.log("OneSignal push sent:", result);
  } catch (error) {
    console.error("Ошибка отправки push:", error);
  }
}