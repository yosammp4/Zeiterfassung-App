/**
 * Firebase Konfiguration – einmalig ausfüllen für Geräte-Synchronisation
 *
 * EINRICHTUNG (ca. 5 Minuten):
 * 1. Öffne https://console.firebase.google.com
 * 2. Klicke "Projekt erstellen" → Namen eingeben → weiter
 * 3. Google Analytics: kann deaktiviert werden → "Projekt erstellen"
 * 4. Links im Menü: "Erstellen" → "Firestore Database" → "Datenbank erstellen"
 *    → "Im Testmodus starten" → Standort wählen (z.B. europe-west3) → "Aktivieren"
 * 5. Links oben: Zahnrad ⚙ → "Projekteinstellungen"
 * 6. Scrolle zu "Deine Apps" → Klicke "</>" (Web-App) → App-Namen eingeben → "App registrieren"
 * 7. Kopiere den firebaseConfig-Block und ersetze die Werte unten
 *
 * SICHERHEITSREGELN (optional, empfohlen):
 * In Firestore → Regeln → folgendes einfügen und veröffentlichen:
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /ze/{syncCode} {
 *         allow read, write: if true;
 *       }
 *     }
 *   }
 */

window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC4tc5mvGJTrvg8WdQEdzLlfT-0xKih09A",
  authDomain:        "zeiterfassungsapp-461b7.firebaseapp.com",
  projectId:         "zeiterfassungsapp-461b7",
  storageBucket:     "zeiterfassungsapp-461b7.firebasestorage.app",
  messagingSenderId: "297050815579",
  appId:             "1:297050815579:web:bc992ca90fa214a023937e"
};
