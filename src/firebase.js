import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBr-bc2Xvh-aKV7TOjfzumcRFlZf44E1xY",
  authDomain: "climapro-cab43.firebaseapp.com",
  projectId: "climapro-cab43",
  storageBucket: "climapro-cab43.firebasestorage.app",
  messagingSenderId: "641419581341",
  appId: "1:641419581341:web:90524626a8b2739fcb4174"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const messaging = getMessaging(app);

export async function registrarTokenFCM(uid) {
  if (window.location.protocol !== "https:") return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const token = await getToken(messaging, {
      vapidKey: "BFvYCf-_94hdIYuL-8ewm7Rz6x-v0MeE1R_FtPMhPr_BvJbN8fuefBRarf1x73V8eWEl0dsVyRABaESWMl2vlkQ",
    });
    if (token) {
      await setDoc(doc(db, "usuarios", uid), { fcmToken: token }, { merge: true });
    }
  } catch (e) {
    console.error("Error registrant token FCM:", e);
  }
}
