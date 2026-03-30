// src/services/destinationService.ts
// ─────────────────────────────────────────────────────────────────────────────
// All Firestore reads for the "destinations" collection.
//
// Exports consumed by the app:
//   home.tsx            → fetchRecommendedDestinations, fetchPopularDestinations
//   DestinationDetail   → fetchDestinationById
//
// Firestore collection path: /destinations/{docId}
//
// Field-name conventions:
//   The admin panel may store "name" or "title", "image" or "imageUrl", etc.
//   normaliseDestination() accepts either form so the UI always has clean data.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, doc, getDoc, getDocs,
  query, where, orderBy, limit,
  QuerySnapshot, DocumentData,
} from 'firebase/firestore';
import { firestore } from '../firebase';
import { Destination } from '../types';

// ── Internal helpers ──────────────────────────────────────────────────────────

const COLLECTION = 'destinations';
const col        = () => collection(firestore, COLLECTION);

/** Map a raw Firestore document → typed Destination.
 *
 * Handles BOTH the mobile-app field shapes and the admin panel field shapes:
 *
 *  Admin panel writes    →  App expects
 *  ──────────────────────────────────────
 *  title                 →  name / title
 *  shortDescription      →  desc / description
 *  fullDescription       →  description (fallback)
 *  imageUrl              →  image / imageUrl
 *  location (string)     →  address
 *  locationCoords{lat,lng}→  location{lat,lng}
 *  entranceFee           →  admission / fee
 *  goodFor (string[])    →  suitableFor / audience
 *  openingHours          →  hours
 *  tempStatus            →  status  (Temporarily Closed)
 *  closeReason           →  closeReason
 */
function normalise(id: string, data: DocumentData): Destination {
  // ── Resolve name ──────────────────────────────────────────────────────────
  const name  = data.name  || data.title || '';
  const title = data.title || data.name  || '';

  // ── Resolve description ───────────────────────────────────────────────────
  const description = data.description  || data.fullDescription || data.shortDescription || data.desc || '';
  const desc        = data.desc || data.shortDescription || data.description || '';

  // ── Resolve image ─────────────────────────────────────────────────────────
  const image    = data.image    || data.imageUrl || (data.images?.[0] ?? '');
  const imageUrl = data.imageUrl || data.image    || (data.images?.[0] ?? '');

  // ── Resolve address ───────────────────────────────────────────────────────
  // Admin stores address as the plain string 'location' field
  const address = data.address || (typeof data.location === 'string' ? data.location : '') || '';

  // ── Resolve GPS coords ────────────────────────────────────────────────────
  // Admin stores coords as locationCoords { lat, lng }
  // App stores coords as location { lat, lng }
  let location = data.location && typeof data.location === 'object' && data.location.lat
    ? data.location
    : data.locationCoords?.lat
      ? { lat: data.locationCoords.lat, lng: data.locationCoords.lng }
      : null;

  // ── Resolve hours / admission / suitableFor ───────────────────────────────
  const hours       = data.hours       || data.openingHours || '';
  const admission   = data.admission   || data.entranceFee  || data.fee || data.price || '';
  const suitableFor = data.suitableFor || data.audience     || data.visitorTypes
                    || (Array.isArray(data.goodFor) ? data.goodFor.join(', ') : '') || '';
  const parking     = data.parking || '';

  // ── Resolve status — admin uses tempStatus for temporary closure ──────────
  const status = data.tempStatus === 'Temporarily Closed'
    ? 'Temporarily Closed'
    : (data.status || '');

  return {
    // Spread raw data first so ALL admin/app fields pass through
    ...data,
    // Then override with normalised values
    id,
    name,
    title,
    description,
    desc,
    image,
    imageUrl,
    address,
    location,
    hours,
    admission,
    suitableFor,
    parking,
    status,
    closeReason:  data.closeReason  || '',
    rating:       parseFloat(data.rating) || 0,
    reviews:      data.reviewCount  ?? data.reviews ?? 0,
    category:     data.category     || '',
    ranking:      data.ranking      || data.mostVisitedRank || null,
    infoBlocks:   data.infoBlocks   || [],
    featured:     !!data.featured,
    distance:     data.distance     || '',
    // Keep goodFor array intact for DestinationDetail tag display
    goodFor:      Array.isArray(data.goodFor) ? data.goodFor : [],
  } as Destination;
}

function fromSnapshot(snap: QuerySnapshot<DocumentData>): Destination[] {
  return snap.docs.map(d => normalise(d.id, d.data()));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * fetchRecommendedDestinations
 * Primary: docs where recommended == true, ordered by rating desc.
 * Fallback: top-10 by rating (if no doc has the recommended flag).
 */
export const fetchRecommendedDestinations = async (): Promise<Destination[]> => {
  try {
    // 1st priority: docs explicitly flagged recommended = true
    const recSnap = await getDocs(
      query(col(), where('recommended', '==', true), orderBy('rating', 'desc'), limit(20))
    );
    if (!recSnap.empty) {
      return fromSnapshot(recSnap).filter(d => (d as any).status !== 'draft');
    }

    // 2nd priority: admin-published docs (status == 'published')
    const pubSnap = await getDocs(
      query(col(), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(20))
    );
    if (!pubSnap.empty) return fromSnapshot(pubSnap);

    // 3rd priority: all docs ordered by rating (index may not exist yet)
    const fallback = await getDocs(query(col(), orderBy('rating', 'desc'), limit(10)));
    return fromSnapshot(fallback).filter(d => (d as any).status !== 'draft');
  } catch (err: any) {
    console.warn('[destinationService] fetchRecommendedDestinations fell back to unordered read:', err?.message);
    try {
      const snap = await getDocs(query(col(), limit(20)));
      return fromSnapshot(snap).filter(d => (d as any).status !== 'draft');
    } catch (e) {
      console.error('[destinationService] fetchRecommendedDestinations failed:', e);
      return [];
    }
  }
};

/**
 * fetchPopularDestinations
 * Orders by reviewCount desc (most-reviewed = most popular).
 * Falls back to rating order, then unordered, so the UI always gets data.
 */
export const fetchPopularDestinations = async (): Promise<Destination[]> => {
  try {
    // 1st priority: admin-featured destinations
    const featuredSnap = await getDocs(
      query(col(), where('featured', '==', true), orderBy('createdAt', 'desc'), limit(20))
    );
    if (!featuredSnap.empty) return fromSnapshot(featuredSnap);

    // 2nd priority: most-reviewed
    const snap = await getDocs(query(col(), orderBy('reviewCount', 'desc'), limit(20)));
    if (!snap.empty) return fromSnapshot(snap);

    // 3rd priority: highest-rated
    const byRating = await getDocs(query(col(), orderBy('rating', 'desc'), limit(20)));
    return fromSnapshot(byRating);
  } catch (err: any) {
    console.warn('[destinationService] fetchPopularDestinations fell back to unordered read:', err?.message);
    try {
      const snap = await getDocs(query(col(), limit(20)));
      return fromSnapshot(snap);
    } catch (e) {
      console.error('[destinationService] fetchPopularDestinations failed:', e);
      return [];
    }
  }
};

/**
 * fetchDestinationById
 * Used by DestinationDetail when the destination is not in router state.
 */
export const fetchDestinationById = async (id: string): Promise<Destination | null> => {
  try {
    const snap = await getDoc(doc(firestore, COLLECTION, id));
    if (!snap.exists()) return null;
    return normalise(snap.id, snap.data());
  } catch (err) {
    console.error('[destinationService] fetchDestinationById failed:', err);
    return null;
  }
};

/**
 * fetchDestinations
 * Full collection read — used by search or admin utilities.
 */
export const fetchDestinations = async (): Promise<Destination[]> => {
  try {
    const snap = await getDocs(col());
    return fromSnapshot(snap);
  } catch (err) {
    console.error('[destinationService] fetchDestinations failed:', err);
    return [];
  }
};