import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export function subscribeToUserChats(uid, callback, errorCallback) {
  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("members", "array-contains", uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const chats = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      callback(chats);
    },
    (error) => {
      if (errorCallback) {
        errorCallback(error);
      } else {
        console.error("Ошибка подписки на чаты:", error);
      }
    }
  );
}

export async function getUserProfile(uid) {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function getChatDisplayTitle(chat, currentUserId) {
  if (chat.type === "group") {
    return chat.title || "Общий чат";
  }

  const otherUserId = (chat.members || []).find((id) => id !== currentUserId);

  if (!otherUserId) {
    return "Личный чат";
  }

  const otherUser = await getUserProfile(otherUserId);

  if (!otherUser) {
    return "Личный чат";
  }

  return otherUser.name || otherUser.email || "Личный чат";
}

export function subscribeToChatReads(userId, callback, errorCallback) {
  const readsRef = collection(db, "chatReads");
  const q = query(readsRef, where("userId", "==", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const map = {};

      snapshot.docs.forEach((item) => {
        const data = item.data();
        map[data.chatId] = Number(data.lastReadAt || 0);
      });

      callback(map);
    },
    (error) => {
      if (errorCallback) {
        errorCallback(error);
      } else {
        console.error("Ошибка подписки на chatReads:", error);
      }
    }
  );
}

export async function markChatAsRead(chatId, userId, lastReadAt) {
  if (!chatId || !userId || !lastReadAt) return;

  const readRef = doc(db, "chatReads", `${chatId}_${userId}`);

  await setDoc(
    readRef,
    {
      chatId,
      userId,
      lastReadAt: Number(lastReadAt),
    },
    { merge: true }
  );
}