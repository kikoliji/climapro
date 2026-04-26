importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBr-bc2Xvh-aKV7TOjfzumcRFlZf44E1xY",
  authDomain: "climapro-cab43.firebaseapp.com",
  projectId: "climapro-cab43",
  storageBucket: "climapro-cab43.firebasestorage.app",
  messagingSenderId: "641419581341",
  appId: "1:641419581341:web:90524626a8b2739fcb4174"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "ClimaPro", {
    body: body || "",
    icon: "/vite.svg",
  });
});
