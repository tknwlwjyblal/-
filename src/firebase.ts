import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { SystemLogEntry } from './types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID (Critical for AI Studio)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    if (!__ANDROID_GOOGLE_AUTH_CONFIGURED__) {
      throw new Error('android-auth-not-configured');
    }
    const result = await FirebaseAuthentication.signInWithGoogle();
    if (!result.credential?.idToken) {
      throw new Error('Google did not return an ID token.');
    }
    const credential = GoogleAuthProvider.credential(result.credential.idToken);
    return signInWithCredential(auth, credential);
  }
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  return await signInWithPopup(auth, googleProvider);
}

export async function logoutUser() {
  await signOut(auth);
  if (Capacitor.isNativePlatform() && __ANDROID_GOOGLE_AUTH_CONFIGURED__) {
    await FirebaseAuthentication.signOut();
  }
}

// Error handling helper as specified by Firebase Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export async function logSystemEvent(
  level: 'info' | 'warning' | 'error',
  title: string,
  details: string,
  path?: string
) {
  if (!auth.currentUser) return;
  const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const entry: SystemLogEntry = {
    id: logId,
    level,
    title: title.slice(0, 190),
    details: details.slice(0, 1900),
    path: path ? path.slice(0, 190) : 'system',
    userEmail: (auth.currentUser.email || 'unknown').slice(0, 95),
    timestamp: new Date().toLocaleString('ar-YE'),
    createdAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'system_logs', logId), entry);
  } catch {
    // Prevent recursive logging errors
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  logSystemEvent('error', `خطأ قاعدة بيانات (${operationType})`, errMsg, path || 'firestore');
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot as mandated by the skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
    }
  }
}

testConnection();

