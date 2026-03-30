// src/services/notificationsService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages per-user and global notifications in Firestore.
//
// Firestore paths:
//   notifications/{uid}/items/{notifId}     ← user-specific (reviews, likes…)
//   notifications/global/items/{notifId}    ← broadcast to every tourist
//
// Both are merged and sorted by createdAt desc in subscribeNotifications().
//
// Notification triggers (called from other services):
//   notifyNewDestination()   → called when admin publishes a new destination
//   notifyVisitRecorded()    → called after a QR scan records a visit
//   notifyReviewLiked()      → called when someone likes a user's review
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, doc,
  addDoc, updateDoc, writeBatch,
  query, orderBy, onSnapshot, getDocs,
  serverTimestamp, Unsubscribe, Timestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotifType = 'like' | 'rating' | 'location' | 'info' | 'system' | 'visit';

export interface AppNotification {
  id:        string;
  type:      NotifType;
  title:     string;
  message:   string;
  unread:    boolean;
  /** ISO string — derived from Firestore Timestamp on read */
  createdAt: string;
  /** Optional deep-link destination id */
  destId?:   string;
}

// ── Firestore ref helpers ─────────────────────────────────────────────────────

const userItemsCol  = (uid: string) =>
  collection(firestore, 'notifications', uid, 'items');

const globalItemsCol = () =>
  collection(firestore, 'notifications', 'global', 'items');

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(value: any): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string')  return value;
  return new Date().toISOString();
}

function rawToNotif(id: string, data: any): AppNotification {
  return {
    id,
    type:      data.type      ?? 'info',
    title:     data.title     ?? '',
    message:   data.message   ?? '',
    unread:    data.unread    !== false,   // default unread = true
    createdAt: toIso(data.createdAt),
    destId:    data.destId    ?? undefined,
  };
}

/** Human-friendly relative time, e.g. "3 hours ago", "2 days ago" */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days  < 7)  return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Real-time listener ─────────────────────────────────────────────────────────

/**
 * subscribeNotifications
 * Merges the user's personal notifications with global broadcasts.
 * Calls onChange with a sorted (newest first) array every time either
 * collection changes.  Returns an unsubscribe function for useEffect cleanup.
 */
export function subscribeNotifications(
  uid:      string,
  onChange: (notifs: AppNotification[]) => void,
): Unsubscribe {
  let userNotifs:   AppNotification[] = [];
  let globalNotifs: AppNotification[] = [];

  const merge = () => {
    // Combine, deduplicate by id, sort newest first
    const all = [...userNotifs, ...globalNotifs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onChange(all);
  };

  const userUnsub = onSnapshot(
    query(userItemsCol(uid), orderBy('createdAt', 'desc')),
    snap => {
      userNotifs = snap.docs.map(d => rawToNotif(d.id, d.data()));
      merge();
    },
    err => console.error('[notificationsService] user stream error:', err),
  );

  const globalUnsub = onSnapshot(
    query(globalItemsCol(), orderBy('createdAt', 'desc')),
    snap => {
      globalNotifs = snap.docs.map(d => rawToNotif(d.id, d.data()));
      merge();
    },
    err => console.error('[notificationsService] global stream error:', err),
  );

  return () => { userUnsub(); globalUnsub(); };
}

// ── Mark as read ──────────────────────────────────────────────────────────────

/** Mark a single notification as read — updates Firestore and reflects in UI */
export async function markNotifRead(uid: string, notifId: string): Promise<void> {
  try {
    // Try user collection first; if it fails silently, it's a global notif
    await updateDoc(doc(userItemsCol(uid), notifId), { unread: false });
  } catch {
    try {
      await updateDoc(doc(globalItemsCol(), notifId), { unread: false });
    } catch (err) {
      console.error('[notificationsService] markNotifRead failed:', err);
    }
  }
}

/** Mark ALL user-specific notifications as read in a single batch */
export async function markAllNotifsRead(uid: string): Promise<void> {
  try {
    const [userSnap, globalSnap] = await Promise.all([
      getDocs(query(userItemsCol(uid))),
      getDocs(query(globalItemsCol())),
    ]);

    const batch = writeBatch(firestore);
    userSnap.docs
      .filter(d => d.data().unread !== false)
      .forEach(d => batch.update(d.ref, { unread: false }));
    globalSnap.docs
      .filter(d => d.data().unread !== false)
      .forEach(d => batch.update(d.ref, { unread: false }));

    await batch.commit();
  } catch (err) {
    console.error('[notificationsService] markAllNotifsRead failed:', err);
  }
}

// ── Write helpers (called from other services/screens) ────────────────────────

/**
 * notifyUser
 * Adds a notification to a specific user's collection.
 * Called for personal events like review likes.
 */
export async function notifyUser(
  uid:  string,
  data: Omit<AppNotification, 'id' | 'createdAt' | 'unread'>,
): Promise<void> {
  try {
    await addDoc(userItemsCol(uid), {
      ...data,
      unread:    true,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[notificationsService] notifyUser failed:', err);
  }
}

/**
 * notifyGlobal
 * Adds a broadcast notification visible to every tourist.
 * Called when admin publishes a new destination, etc.
 */
export async function notifyGlobal(
  data: Omit<AppNotification, 'id' | 'createdAt' | 'unread'>,
): Promise<void> {
  try {
    await addDoc(globalItemsCol(), {
      ...data,
      unread:    true,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[notificationsService] notifyGlobal failed:', err);
  }
}

// ── Convenience trigger functions ─────────────────────────────────────────────

/** Broadcast: new destination published by admin */
export const notifyNewDestination = (destName: string, destId: string) =>
  notifyGlobal({
    type:    'location',
    title:   'New Destination Added!',
    message: `"${destName}" is now available to explore in Pasig City.`,
    destId,
  });

/** Personal: tourist's review received a like */
export const notifyReviewLiked = (uid: string, destName: string) =>
  notifyUser(uid, {
    type:    'like',
    title:   'Someone liked your review!',
    message: `Your review of ${destName} got a new like. ❤️`,
  });

/** Personal: QR scan visit recorded successfully */
export const notifyVisitRecorded = (uid: string, destName: string, destId: string) =>
  notifyUser(uid, {
    type:    'visit',
    title:   'Visit Recorded!',
    message: `Your visit to ${destName} has been counted. Thanks for exploring! 🗺️`,
    destId,
  });
