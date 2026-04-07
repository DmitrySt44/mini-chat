import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export async function getUserChats(uid) {
  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("members", "array-contains", uid));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
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