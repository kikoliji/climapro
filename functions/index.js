const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

exports.notificarTreballador = onDocumentCreated("notificacions/{docId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const { trabajador, titol, missatge } = data;
  if (!trabajador) return;

  const db = getFirestore();
  const snap = await db.collection("usuarios").where("nombre", "==", trabajador).limit(1).get();
  if (snap.empty) return;

  const fcmToken = snap.docs[0].data().fcmToken;
  if (!fcmToken) return;

  await getMessaging().send({
    token: fcmToken,
    notification: {
      title: titol || "ClimaPro",
      body: missatge || "",
    },
  });
});
