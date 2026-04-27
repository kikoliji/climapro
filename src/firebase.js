import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

export const registrarTokenFCM = async () => {};
