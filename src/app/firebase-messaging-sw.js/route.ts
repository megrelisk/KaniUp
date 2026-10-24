// Service worker for browser push (Firebase Cloud Messaging). Served from the app
// root so it can control every page; the Firebase config is injected from env.
export function GET() {
  const config = JSON.stringify({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const script = `
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");
firebase.initializeApp(${config});
firebase.messaging();
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.FCM_MSG?.notification?.click_action || event.notification?.data?.link || "/";
  event.waitUntil(clients.openWindow(link));
});
`;
  return new Response(script, { headers: { "Content-Type": "application/javascript", "Service-Worker-Allowed": "/" } });
}
