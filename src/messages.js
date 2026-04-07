import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export function subscribeToMessages(chatId, callback, errorCallback) {
  const messagesRef = collection(db, "messages");
  const q = query(messagesRef, where("chatId", "==", chatId));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs
        .map((item) => {
          const data = item.data();

          return {
            id: item.id,
            ...data,
            createdAtMs: Number(data?.localCreatedAt || 0),
          };
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs);

      callback(messages);
    },
    (error) => {
      if (errorCallback) {
        errorCallback(error);
      } else {
        console.error("Ошибка подписки на сообщения:", error);
      }
    }
  );
}

export async function sendMessage({
  chatId,
  senderId,
  senderName,
  text,
  clientMessageId,
}) {
  const trimmedText = text.trim();

  if (!trimmedText) return;

  const now = Date.now();
  const messagesRef = collection(db, "messages");

  await addDoc(messagesRef, {
    chatId,
    senderId,
    senderName,
    text: trimmedText,
    clientMessageId,
    localCreatedAt: now,
  });

  const chatRef = doc(db, "chats", chatId);

  await updateDoc(chatRef, {
    lastMessageAt: now,
    lastMessageSenderId: senderId,
    lastMessageText: trimmedText,
  });
}