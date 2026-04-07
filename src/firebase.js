import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBs1LrI48riP6aMzE_zdG-YqBp4GI5MF4U",
  authDomain: "mini-chat-6ed84.firebaseapp.com",
  projectId: "mini-chat-6ed84",
  storageBucket: "mini-chat-6ed84.firebasestorage.app",
  messagingSenderId: "1089628478226",
  appId: "1:1089628478226:web:05339337c0f64d610ff1cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };

