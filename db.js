// Firestore: מספרי טלפון, כתובות מייל, ורשימת השירים לכל מתקשר
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({ databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)' });

export async function getCaller(phone) {
  const s = await db.collection('callers').doc(phone).get();
  return s.exists ? s.data() : {};
}

export async function saveEmail(phone, email) {
  await db.collection('callers').doc(phone).set({ email }, { merge: true });
}

export async function createSong(data) {
  const ref = await db.collection('songs').add({ ...data, createdAt: new Date() });
  return ref.id;
}

export async function updateSong(id, patch) {
  await db.collection('songs').doc(id).set(patch, { merge: true });
}

export async function songsOf(phone, limit = 5) {
  const s = await db.collection('songs').where('phone', '==', phone).get();
  return s.docs
    .map((d) => d.data())
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, limit);
}
