// src/pages/Home/DestinationDetail/DestinationDetail.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButtons, IonButton, IonIcon, IonImg, IonModal, IonFooter,
  IonText, IonLoading, IonBadge, IonToast,
} from '@ionic/react';
import {
  arrowBack, location as locationIcon, star, shareSocial,
  heart, heartOutline, time, cash, people, car, refresh,
  chevronForward, create, chevronBack, chevronForwardOutline,
  calendarOutline,
} from 'ionicons/icons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  collection, getDocs, query, orderBy, doc, getDoc,
} from 'firebase/firestore';
import { firestore } from '../../../firebase';
import { Destination, InfoBlock } from '../../../types';
import { fetchDestinationById } from '../../../services/destinationService';
import { toggleFavorite, getFavoriteIds } from '../../../services/favoritesService';
import { useAuth } from '../../../context/AuthContext';
import { useUserLocation } from '../../../services/useUserLocation';
import { formatDistance as haversineFormatDistance } from '../../../services/distance';
import './DestinationDetail.css';
import WriteReviewModal from './writeReview/WriteReviewModal';

const GROQ_API_KEY      = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL        = 'llama-3.3-70b-versatile';

interface NearbyAttraction { name: string; distance: string; icon?: string; }
// Live review shape from Firestore subcollection
interface ReviewReply { authorName: string; text: string; createdAt?: string; isVenue?: boolean; }
interface Review {
  id?: string;
  author: string;
  rating: number;
  text: string;
  avatar?: string;
  anonymous?: boolean;
  feeling?: string;
  visitDate?: string;
  companion?: string;
  duration?: string;
  createdAt?: string;
  replies?: ReviewReply[];
}
interface UpcomingEvent    { month: string; day: string | number; title: string; time: string; }
interface TimelineEntry    { year: string; event: string; }
interface ItinerarySlot    { time: string; activity: string; tip?: string; }
interface ItineraryDay     { day: number; theme: string; slots: ItinerarySlot[]; }
interface GalleryPhoto    { url: string; caption?: string; }

const StarRating: React.FC<{ value: number; max?: number }> = ({ value, max = 5 }) => (
  <span className="star-row">
    {Array.from({ length: max }).map((_, i) => (
      <IonIcon key={i} icon={star} className={i < Math.round(value) ? 'star filled' : 'star empty'} />
    ))}
  </span>
);

const ProseSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="dd-section">
    <h3 className="dd-section-title">{title}</h3>
    {children}
  </div>
);

const DestinationDetail: React.FC = () => {
  const history  = useHistory();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  // Support QR scan deep-link: /destination?id=<docId>
  const searchParams = new URLSearchParams(location.search);
  const qrId = searchParams.get('id') || '';
  const id   = routeId || qrId;
  const { user } = useAuth();
  const { coords, locationError: locationGpsError } = useUserLocation();

  const [dest, setDest] = useState<Destination | null>((location.state as Destination) || null);

  const mapRef          = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<L.Map | null>(null);
  const userMarkerRef   = useRef<L.Marker | null>(null);
  const routeLayerRef   = useRef<L.Polyline | null>(null);

  const [showItinerary,   setShowItinerary]   = useState(false);
  const [itinerary,       setItinerary]       = useState('');
  const [itineraryData,   setItineraryData]   = useState<ItineraryDay[] | null>(null);
  const [generating,      setGenerating]      = useState(false);
  const [showMap,         setShowMap]         = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [routeError,      setRouteError]      = useState('');
  const [navMode,         setNavMode]         = useState<'walking' | 'driving' | 'commute'>('driving');
  const [routeInfo,       setRouteInfo]       = useState<{ distance: string; duration: string } | null>(null);
  const [routeActive,     setRouteActive]     = useState(false);
  const [isFavorite,      setIsFavorite]      = useState(false);
  const [favLoading,      setFavLoading]      = useState(false);
  const [toastMsg,        setToastMsg]        = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  // Reply state: maps review id → { open: bool, text: string, submitting: bool }
  const [replyMap, setReplyMap] = useState<Record<string, { open: boolean; text: string; submitting: boolean }>>({}); 
  // Lightbox: unified gallery of destination + review photos
  const [lightbox, setLightbox] = useState<{ photos: GalleryPhoto[]; index: number } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // ── Live reviews loaded from Firestore subcollection ─────────────────────
  const [liveReviews,     setLiveReviews]     = useState<Review[]>([]);
  const [reviewsLoading,  setReviewsLoading]  = useState(false);
  // Local mirror of aggregate values so they update without a page reload
  const [liveRating,      setLiveRating]      = useState<number | null>(null);
  const [liveCount,       setLiveCount]       = useState<number | null>(null);
  // Live rank computed from the visits collection (QR scans)
  const [liveRank,        setLiveRank]        = useState<number | null>(null);

  // ── Load destination if not in router state (also handles QR scan) ────────
  useEffect(() => {
    if (dest || !id) return;
    fetchDestinationById(id)
      .then(raw => {
        if (!raw) return;
        const r = raw as any;
        // Normalise admin field names → app field names
        const normalised: any = {
          ...r,
          // name: admin uses 'title', app uses 'name'
          name:        r.name        || r.title        || '',
          // description: admin uses 'shortDescription'/'fullDescription'
          description: r.description || r.fullDescription || r.shortDescription || '',
          // address: admin stores as string 'location' field
          address:     r.address     || (typeof r.location === 'string' ? r.location : '') || '',
          // hours / admission
          hours:       r.hours       || r.openingHours || '',
          admission:   r.admission   || r.entranceFee  || r.fee || '',
          // suitableFor: admin uses 'goodFor' array
          suitableFor: r.suitableFor || r.visitorTypes ||
                       (Array.isArray(r.goodFor) ? r.goodFor.join(', ') : '') || '',
          parking:     r.parking     || '',
          // location coords from admin locationCoords field
          location:    r.location?.lat
                         ? r.location
                         : r.locationCoords
                           ? { lat: r.locationCoords.lat, lng: r.locationCoords.lng }
                           : r.location,
          // status: admin uses tempStatus for temporary closure
          status:      r.tempStatus === 'Temporarily Closed' ? 'Temporarily Closed' : (r.status || ''),
          closeReason: r.closeReason || '',
          // image
          imageUrl:    r.imageUrl || r.image || '',
          image:       r.image    || r.imageUrl || '',
        };
        setDest(normalised);
      })
      .catch(console.error);
  }, [id, dest]);

  // ── Load reviews from Firestore subcollection ────────────────────────────
  const loadReviews = async (destId: string) => {
    setReviewsLoading(true);
    try {
      const reviewsRef = collection(firestore, 'destinations', destId, 'reviews');
      const q          = query(reviewsRef, orderBy('createdAt', 'desc'));
      const snap       = await getDocs(q);

      // Batch-fetch unique user profiles (skip duplicates & anon reviews)
      const uniqueUserIds = Array.from(
        new Set(
          snap.docs
            .map(d => d.data())
            .filter(data => !data.anonymous && data.userId)
            .map(data => data.userId as string)
        )
      );
      const profileCache: Record<string, { name: string; avatar: string }> = {};
      await Promise.all(
        uniqueUserIds.map(async uid => {
          try {
            const userSnap = await getDoc(doc(firestore, 'users', uid));
            if (userSnap.exists()) {
              const ud  = userSnap.data();
              const fn  = ud.name?.firstname || '';
              const sn  = ud.name?.surname   || '';
              const full = [fn, sn].filter(Boolean).join(' ') || ud.nickname || '';
              profileCache[uid] = {
                name:   full,
                avatar: ud.img || '',
              };
            }
          } catch { /* silent */ }
        })
      );

      const loaded: Review[] = snap.docs.map(d => {
        const data   = d.data();
        const isAnon = !!data.anonymous;
        const uid    = data.userId as string | undefined;

        // Prefer live profile data; fall back to what was saved in the review doc
        const cachedProfile = uid && !isAnon ? profileCache[uid] : undefined;
        const authorName   = isAnon
          ? 'Anonymous'
          : cachedProfile?.name || data.authorName || 'Traveller';
        const authorAvatar = isAnon
          ? undefined
          : cachedProfile?.avatar || data.authorAvatar || undefined;

        return {
          id:        d.id,
          author:    authorName,
          rating:    data.overallRating || 0,
          text:      data.review || data.title || '',
          avatar:    authorAvatar,
          anonymous: isAnon,
          feeling:   data.feeling   || '',
          visitDate: data.visitDate || '',
          companion: data.companion || '',
          duration:  data.duration  || '',
          createdAt: data.createdAt?.toDate?.()?.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || '',
          replies:   data.replies   || [],
        };
      });
      setLiveReviews(loaded);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    const destId = id || dest?.id;
    if (!destId) return;
    loadReviews(destId);
  }, [id, dest?.id]);

  // ── Compute live rank from visits collection ──────────────────────────────
  useEffect(() => {
    const destName = (dest as any)?.title || (dest as any)?.name || '';
    if (!destName) return;
    (async () => {
      try {
        const snap     = await getDocs(collection(firestore, 'visits'));
        const countMap = new Map<string, number>();
        snap.forEach(d => {
          const name: string = (d.data() as any).destinationTop ?? '';
          if (name) countMap.set(name, (countMap.get(name) ?? 0) + 1);
        });
        if (!countMap.size) return;
        const sorted = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]);
        const rank   = sorted.findIndex(([name]) => name === destName) + 1;
        if (rank > 0) setLiveRank(rank);
      } catch (err) { console.error('[DestinationDetail] visits rank fetch:', err); }
    })();
  }, [dest]);

  // ── Load initial favorite state from RTDB ────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !dest?.id) return;
    getFavoriteIds(user.uid)
      .then(ids => setIsFavorite(ids.has(dest.id)))
      .catch(console.error);
  }, [user?.uid, dest?.id]);

  // ── Clean up map on modal close ──────────────────────────────────────────
  useEffect(() => {
    if (!showMap && mapInstanceRef.current) {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      userMarkerRef.current  = null;
      routeLayerRef.current  = null;
      setRouteInfo(null);
      setRouteActive(false);
    }
  }, [showMap, watchId]);

  // ── Favorite toggle ──────────────────────────────────────────────────────
  const handleFavoriteToggle = async () => {
    if (!user?.uid || !dest) return;
    setFavLoading(true);
    setIsFavorite(prev => !prev);
    try {
      const next = await toggleFavorite(user.uid, dest, isFavorite);
      setIsFavorite(next);
      setToastMsg(next ? '❤️ Added to Favorites' : 'Removed from Favorites');
    } catch (err) {
      setIsFavorite(prev => !prev);
      console.error('Favorite toggle failed', err);
      setToastMsg('Something went wrong. Please try again.');
    } finally {
      setFavLoading(false);
    }
  };

  // ── Map init ─────────────────────────────────────────────────────────────
  const initMap = () => {
    if (!mapRef.current || !dest) return;
    if (mapInstanceRef.current) mapInstanceRef.current.remove();
    try {
      const raw = dest as any;
      const lat = raw.location?.lat ?? raw.locationCoords?.lat ?? 14.5776;
      const lng = raw.location?.lng ?? raw.locationCoords?.lng ?? 121.0858;
      const name    = dest.name    || raw.title    || 'Destination';
      const address = dest.address || (typeof raw.location === 'string' ? raw.location : '') || '';
      const map = L.map(mapRef.current).setView([lat, lng], 16);
      if (map.attributionControl) map.attributionControl.setPrefix(false);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      L.marker([lat, lng]).addTo(map)
        .bindPopup(`<strong>${name}</strong><br>${address}`)
        .openPopup();
      mapInstanceRef.current = map;
      // Ensure tiles fill the modal container
      requestAnimationFrame(() => map.invalidateSize());
    } catch (err) { console.error('Map init error:', err); }
  };

  // ── Format seconds → "X min" / "X hr Y min" ────────────────────────────
  const formatDuration = (seconds: number): string => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // ── Routing config per mode ──────────────────────────────────────────────
  // Each mode hits a different OSRM backend so paths are genuinely distinct:
  //   walking → routed-foot  : uses footpaths, alleys, pedestrian shortcuts
  //   driving → routed-car   : roads/streets only, no pedestrian ways
  //   commute → routed-car   : same road network but duration inflated for
  //                            jeepney/bus stops & transfers (~1.6×)
  const OSRM_BASE: Record<'walking' | 'driving' | 'commute', string> = {
    walking: 'https://routing.openstreetmap.de/routed-foot',
    driving: 'https://routing.openstreetmap.de/routed-car',
    commute: 'https://routing.openstreetmap.de/routed-car',
  };

  const modeColor = (mode: 'walking' | 'driving' | 'commute') => {
    if (mode === 'walking') return '#10b981';  // green
    if (mode === 'commute') return '#f59e0b';  // amber
    return '#3b82f6';                           // blue
  };

  // Walking speed ~5 km/h; OSRM foot already uses this.
  // Commute: use driving distance but multiply duration by 1.6 for stops/waits.
  const adjustDuration = (mode: 'walking' | 'driving' | 'commute', rawSeconds: number) =>
    mode === 'commute' ? rawSeconds * 1.6 : rawSeconds;

  const handleGetDirections = (mode: 'walking' | 'driving' | 'commute' = navMode) => {
    if (!dest) return;
    const raw = dest as any;
    const destLat = raw.location?.lat ?? raw.locationCoords?.lat ?? 14.5776;
    const destLng = raw.location?.lng ?? raw.locationCoords?.lng ?? 121.0858;
    setRouteError('');
    setRouteInfo(null);
    setLoadingLocation(true);

    if (watchId) navigator.geolocation.clearWatch(watchId);

    const id = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        setLoadingLocation(false);
        const map = mapInstanceRef.current;
        if (!map) return;

        // Remove previous user marker & route
        if (userMarkerRef.current) userMarkerRef.current.remove();
        if (routeLayerRef.current) routeLayerRef.current.remove();

        // Blue pulsing dot for user location
        const userIcon = L.divIcon({
          className: '',
          html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.35);"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
          .addTo(map).bindPopup('<strong>Your Location</strong>').openPopup();

        const color   = modeColor(mode);
        const baseUrl = OSRM_BASE[mode];

        try {
          // alternatives=true so OSRM returns shortest path alternatives
          const res = await fetch(
            `${baseUrl}/route/v1/driving/${longitude},${latitude};${destLng},${destLat}` +
            `?overview=full&geometries=geojson&alternatives=false&steps=false`
          );

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          if (data.code === 'Ok' && data.routes?.length > 0) {
            const best = data.routes[0];
            const path: [number, number][] = best.geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            );

            const polyOpts: L.PolylineOptions = {
              color,
              weight:    mode === 'walking' ? 4 : 5,
              opacity:   0.92,
              dashArray: mode === 'commute' ? '10,7' : undefined,
              lineJoin:  'round',
              lineCap:   'round',
            };

            const route = L.polyline(path, polyOpts).addTo(map);
            routeLayerRef.current = route;
            map.fitBounds(route.getBounds(), { padding: [50, 50] });

            setRouteInfo({
              distance: formatDistance(best.distance),
              duration: formatDuration(adjustDuration(mode, best.duration)),
            });
            setRouteActive(true);
          } else {
            throw new Error('No route returned');
          }
        } catch (err) {
          console.warn('Routing failed, falling back to straight line:', err);
          setRouteError('Could not calculate route. Showing straight line.');
          const fallback = L.polyline(
            [[latitude, longitude], [destLat, destLng]],
            { color, weight: 3, dashArray: '6,8', opacity: 0.75 }
          ).addTo(map);
          routeLayerRef.current = fallback;
          map.fitBounds(fallback.getBounds(), { padding: [40, 40] });
          setRouteActive(true);
        }
      },
      err => {
        console.error('Geolocation error:', err);
        setLoadingLocation(false);
        setRouteError('Location access denied. Please enable GPS.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
    setWatchId(id);
  };

  // ── Clear route & reset map to destination ───────────────────────────────
  const handleClearRoute = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    const map = mapInstanceRef.current;
    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
    setRouteInfo(null);
    setRouteError('');
    setRouteActive(false);
    // Recenter on destination
    if (map && dest) {
      const raw = dest as any;
      const lat = raw.location?.lat ?? raw.locationCoords?.lat ?? 14.5776;
      const lng = raw.location?.lng ?? raw.locationCoords?.lng ?? 121.0858;
      map.setView([lat, lng], 16, { animate: true });
    }
  };

  // ── Reply helpers ────────────────────────────────────────────────────────
  const toggleReply = (reviewId: string) => {
    setReplyMap(prev => ({
      ...prev,
      [reviewId]: { open: !prev[reviewId]?.open, text: prev[reviewId]?.text || '', submitting: false },
    }));
  };

  const setReplyText = (reviewId: string, text: string) => {
    setReplyMap(prev => ({ ...prev, [reviewId]: { ...prev[reviewId], text } }));
  };

  const submitReply = async (reviewId: string) => {
    const state = replyMap[reviewId];
    if (!state?.text.trim() || state.submitting) return;
    if (!user) { setToastMsg('Please log in to reply.'); return; }

    setReplyMap(prev => ({ ...prev, [reviewId]: { ...prev[reviewId], submitting: true } }));
    try {
      const { doc: firestoreDoc, updateDoc, arrayUnion } = await import('firebase/firestore');
      const reviewRef = firestoreDoc(firestore, 'destinations', id || dest!.id, 'reviews', reviewId);
      const newReply: ReviewReply = {
        authorName: user.displayName || 'You',
        text:       state.text.trim(),
        createdAt:  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        isVenue:    false,
      };
      await updateDoc(reviewRef, { replies: arrayUnion(newReply) });

      // Optimistic UI update
      setLiveReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, replies: [...(r.replies || []), newReply] } : r
      ));
      setReplyMap(prev => ({ ...prev, [reviewId]: { open: false, text: '', submitting: false } }));
      setToastMsg('💬 Reply posted!');
    } catch (err) {
      console.error('Reply failed:', err);
      setToastMsg('Failed to post reply. Please try again.');
      setReplyMap(prev => ({ ...prev, [reviewId]: { ...prev[reviewId], submitting: false } }));
    }
  };

  if (!dest) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <p>Destination not found.</p>
          <IonButton onClick={() => history.push('/home')}>Go Back</IonButton>
        </IonContent>
      </IonPage>
    );
  }

  const handleBack = () => history.length > 1 ? history.goBack() : history.push('/home');

  const generateItinerary = async () => {
    if (!dest) return;
    setGenerating(true);
    setItineraryData(null);
    setItinerary('');

    const d = dest as any;
    const genName    = dest.name    || d.title    || '';
    const genAddress = dest.address || (typeof d.location === 'string' ? d.location : '') || '';
    const genDesc    = dest.description || d.fullDescription || d.shortDescription || '';
    const contextParts: string[] = [
      `Destination: ${genName}`,
      genAddress      ? `Address: ${genAddress}`                                : '',
      d.hours             ? `Opening hours: ${d.hours}`                          : '',
      d.admission         ? `Admission/fees: ${d.admission}`                     : '',
      d.visitDuration     ? `Suggested visit duration: ${d.visitDuration}`       : '',
      d.bestTimeToVisit   ? `Best time to visit: ${d.bestTimeToVisit}`           : '',
      d.whatToBring       ? `What to bring: ${d.whatToBring}`                    : '',
      d.suitableFor       ? `Suitable for: ${d.suitableFor}`                     : '',
      d.parking           ? `Parking: ${d.parking}`                              : '',
      genDesc             ? `Description: ${genDesc}`                            : '',
      d.historySummary    ? `History: ${d.historySummary}`                       : '',
      d.culturalImportance? `Cultural significance: ${d.culturalImportance}`     : '',
      d.amenities?.length ? `Amenities: ${(d.amenities as string[]).join(', ')}` : '',
      d.proTips?.length   ? `Pro tips: ${(d.proTips as string[]).join(' | ')}`   : '',
      (d.nearbyAttractions as NearbyAttraction[])?.length
        ? `Nearby attractions: ${(d.nearbyAttractions as NearbyAttraction[]).map(n => `${n.name} (${n.distance})`).join(', ')}`
        : '',
    ].filter(Boolean);

    const systemPrompt = `You are an expert local travel guide. Generate a detailed, practical day-by-day itinerary in valid JSON only — no markdown, no extra text.

Return an array of day objects. Each day has:
- "day": number (1, 2, ...)
- "theme": short evocative title for the day (e.g. "Arrival & First Impressions")
- "slots": array of time-slot objects, each with:
  - "time": time string like "9:00 AM"
  - "activity": what to do (1–2 sentences, specific and actionable)
  - "tip": optional insider tip (1 sentence)

Generate exactly 1 day (morning, afternoon, evening slots) unless the suggested visit duration implies multiple days. Tailor every slot to the destination's actual hours, admission, amenities, and nearby attractions. Be specific — name real features, use real times.

Respond ONLY with a valid JSON array, no markdown fences.`;

    const userPrompt = `Create an itinerary for:\n${contextParts.join('\n')}`;

    try {
      const res = await fetch(GROQ_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 1200,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json  = await res.json();
      const raw   = json.choices?.[0]?.message?.content?.trim() || '[]';
      const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
      const days: ItineraryDay[] = JSON.parse(clean);
      setItineraryData(days);
    } catch (err) {
      console.error('Itinerary generation failed:', err);
      setItinerary('Could not generate itinerary. Please check your API key or try again.');
    } finally {
      setGenerating(false);
      setShowItinerary(true);
    }
  };

  // ── Extended fields ──────────────────────────────────────────────────────
  const d = dest as any;
  // Normalize Firestore field names (admin uses 'title', app uses 'name' etc.)
  const destName    = dest.name    || d.title        || '';
  const destAddress = dest.address || (typeof d.location === 'string' ? d.location : '') || '';
  const destDesc    = dest.description || d.fullDescription || d.shortDescription || dest.desc || '';
  const destImageUrl = d.imageUrl  || d.image        || '';

  const images: string[] = d.images?.length ? d.images : [destImageUrl].filter(Boolean);

  const tagline         = d.tagline         || '';
  const hours           = d.hours           || d.openingHours  || '';
  const admission       = d.admission       || d.entranceFee  || d.price || d.fee || '';
  const suitableFor     = d.suitableFor     || d.audience     || d.visitorTypes ||
                       (Array.isArray(d.goodFor) ? d.goodFor.join(', ') : '') || '';
  const parking         = d.parking         || '';
  const lastUpdated     = d.lastUpdated     || '';
  const mostVisitedRank = liveRank ? String(liveRank) : (d.mostVisitedRank || '');
  const visitDuration   = d.visitDuration   || '';
  const bestTimeToVisit = d.bestTimeToVisit || '';
  const whatToBring     = d.whatToBring     || '';
  const historySummary  = d.historySummary  || '';
  const timeline: TimelineEntry[]              = d.timeline          || [];
  const culturalImportance                     = d.culturalImportance || '';
  const amenities: string[]                    = d.amenities          || [];
  const proTips: string[]                      = d.proTips            || [];
  const nearbyAttractions: NearbyAttraction[]  = d.nearbyAttractions || [];
  const upcomingEvents: UpcomingEvent[]        = d.upcomingEvents     || [];
  const photoGallery: string[]                 = d.photoGallery       || [];

  // Use live values when available, fall back to Firestore document fields
  const ratingValue = liveRating  ?? (parseFloat(dest.rating as any) || 0);
  const reviewCount = liveCount   ?? (dest.reviews || 0);
  const isClosed    = d.status === 'Temporarily Closed' || d.tempStatus === 'Temporarily Closed';
  const closeReason = d.closeReason || '';

  // Displayed reviews: live Firestore subcollection first, then static fallback
  const reviews: Review[] = liveReviews.length > 0
    ? liveReviews
    : (d.reviews_list || []);

  // ── Live straight-line distance (updates as user moves via watchPosition) ─
  const destLat = d.location?.lat || d.locationCoords?.lat;
  const destLng = d.location?.lng || d.locationCoords?.lng;
  const liveDistance = coords && destLat != null && destLng != null
    ? haversineFormatDistance(coords.latitude, coords.longitude, destLat, destLng)
    : null;

  return (
    <IonPage>
      <IonHeader className="dd-header ion-no-border">
        <IonToolbar className="dd-toolbar">
          <IonButtons slot="start">
            <IonButton className="dd-icon-btn" onClick={handleBack}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton className="dd-icon-btn" onClick={() => {}}>
              <IonIcon icon={shareSocial} />
            </IonButton>
            <IonButton className="dd-icon-btn" onClick={handleFavoriteToggle} disabled={favLoading}>
              <IonIcon icon={isFavorite ? heart : heartOutline} className={isFavorite ? 'heart-active' : ''} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen scrollY>
        {/* Hero Carousel */}
        <div className="dd-hero">
          <div className="dd-hero-slides" style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}>
            {images.map((src: string, i: number) => (
              <img key={i} src={src} alt={destName} className="dd-hero-img" />
            ))}
          </div>
          {images.length > 1 && (
            <>
              <button className="dd-slide-btn dd-slide-prev" onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}>
                <IonIcon icon={chevronBack} />
              </button>
              <button className="dd-slide-btn dd-slide-next" onClick={() => setCurrentImageIndex(i => Math.min(images.length - 1, i + 1))}>
                <IonIcon icon={chevronForwardOutline} />
              </button>
              <span className="dd-image-counter">{currentImageIndex + 1}/{images.length}</span>
            </>
          )}
        </div>

        {isClosed && (
          <div className="dd-closed-banner">
            <span className="dd-closed-icon">⚠</span>
            <div>
              <strong>Temporarily Closed</strong>
              {closeReason && <p className="dd-closed-reason">{closeReason}</p>}
            </div>
          </div>
        )}

        <div className="dd-card">
          <div className="dd-name-row">
            <h1 className="dd-name">{destName}</h1>
            {tagline && <p className="dd-tagline">{tagline}</p>}
          </div>

          <div className="dd-rating-row">
            <StarRating value={ratingValue} />
            <span className="dd-rating-val">{ratingValue}</span>
            <span className="dd-review-count">({reviewCount} reviews)</span>
            {mostVisitedRank && <span className="dd-rank-badge">#{mostVisitedRank} most visit</span>}
          </div>

          <div className="dd-meta-list">
            {destAddress  && <div className="dd-meta-item"><IonIcon icon={locationIcon} className="dd-meta-icon" /><span>{destAddress}</span></div>}
            {hours        && <div className="dd-meta-item"><IonIcon icon={time}         className="dd-meta-icon" /><span>{hours}</span></div>}
            {admission    && <div className="dd-meta-item"><IonIcon icon={cash}         className="dd-meta-icon" /><span>{admission}</span></div>}
            {suitableFor  && <div className="dd-meta-item"><IonIcon icon={people}       className="dd-meta-icon" /><span>{suitableFor}</span></div>}
            {parking      && <div className="dd-meta-item"><IonIcon icon={car}          className="dd-meta-icon" /><span>{parking}</span></div>}
            {lastUpdated  && <div className="dd-meta-item"><IonIcon icon={refresh}      className="dd-meta-icon" /><span>Last Updated: {lastUpdated}</span></div>}
          </div>

          <div className="dd-action-row">
            <button className="dd-action-btn" onClick={() => setShowMap(true)} disabled={isClosed}>
              <IonIcon icon={locationIcon} /><span>Navigate</span>
            </button>
            <button className="dd-action-btn" onClick={generateItinerary} disabled={generating || isClosed}>
              <IonIcon icon={calendarOutline} /><span>Itinerary</span>
            </button>
            <button className="dd-action-btn" onClick={() => history.push('/ai-guide')}>
              <IonIcon icon={people} /><span>Guide</span>
            </button>
          </div>

          {destDesc && (
            <ProseSection title={`About ${destName}`}>
              {d.aboutBullets?.length ? (
                <>
                  <p className="dd-body-text">{destDesc}</p>
                  <ul className="dd-icon-list">
                    {d.aboutBullets.map((b: any, i: number) => (
                      <li key={i} className="dd-icon-list-item">
                        {b.icon && <span className="dd-list-icon">{b.icon}</span>}
                        <span>{b.text || b}</span>
                      </li>
                    ))}
                  </ul>
                  {d.aboutFooter && <p className="dd-body-text">{d.aboutFooter}</p>}
                </>
              ) : (
                <p className="dd-body-text">{destDesc}</p>
              )}
              {(visitDuration || bestTimeToVisit || whatToBring) && (
                <div className="dd-visit-strip">
                  {visitDuration    && <div className="dd-visit-item"><IonIcon icon={time} className="dd-visit-icon" /><div><span className="dd-visit-label">Suggested Visit Duration</span><span className="dd-visit-value">{visitDuration}</span></div></div>}
                  {bestTimeToVisit  && <div className="dd-visit-item"><span className="dd-visit-icon">⚙</span><div><span className="dd-visit-label">Best Time to Visit</span><span className="dd-visit-value">{bestTimeToVisit}</span></div></div>}
                  {whatToBring      && <div className="dd-visit-item"><span className="dd-visit-icon">?</span><div><span className="dd-visit-label">What to Bring</span><span className="dd-visit-value">{whatToBring}</span></div></div>}
                </div>
              )}
            </ProseSection>
          )}

          {dest.infoBlocks && dest.infoBlocks.map((block: InfoBlock, idx: number) => (
            <ProseSection key={idx} title={block.title}>
              {block.type === 'none'   && <p className="dd-body-text">{block.plainText}</p>}
              {block.type === 'bullet' && <ul className="dd-bullet-list">{block.items.map((it, i) => it && <li key={i}>{it}</li>)}</ul>}
              {block.type === 'check'  && <ul className="dd-check-list">{block.items.map((it, i) => it && <li key={i}>{it}</li>)}</ul>}
            </ProseSection>
          ))}

          {(historySummary || timeline.length > 0 || culturalImportance) && (
            <ProseSection title="History & Cultural Significance">
              {historySummary && <p className="dd-body-text">{historySummary}</p>}
              {timeline.length > 0 && (
                <div className="dd-timeline">
                  <p className="dd-timeline-label"><strong>Historical Timeline:</strong></p>
                  {timeline.map((e: TimelineEntry, i: number) => (
                    <div key={i} className="dd-timeline-entry">
                      <span className="dd-timeline-year">{e.year}</span>
                      <span className="dd-timeline-event">{e.event}</span>
                    </div>
                  ))}
                </div>
              )}
              {culturalImportance && <><p className="dd-body-text"><strong>Cultural Importance:</strong></p><p className="dd-body-text">{culturalImportance}</p></>}
            </ProseSection>
          )}

          {amenities.length > 0 && (
            <ProseSection title="Features & Amenities">
              <div className="dd-amenities-block">
                <div className="dd-amenities-header"><span className="dd-amenity-check">✓</span><strong>Available</strong></div>
                <ul className="dd-amenity-list">{amenities.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            </ProseSection>
          )}

          {proTips.length > 0 && (
            <div className="dd-pro-tips">
              <div className="dd-pro-tips-header"><span>💡</span><strong>Pro Tips</strong></div>
              <ol className="dd-pro-tips-list">{proTips.map((tip, i) => <li key={i}>{tip}</li>)}</ol>
            </div>
          )}

          {nearbyAttractions.length > 0 && (
            <ProseSection title="Nearby Attractions">
              <div className="dd-nearby-list">
                {nearbyAttractions.map((place: NearbyAttraction, i: number) => (
                  <div key={i} className="dd-nearby-item">
                    <div className="dd-nearby-icon-wrap"><span>{place.icon || '📍'}</span></div>
                    <div className="dd-nearby-info">
                      <span className="dd-nearby-name">{place.name}</span>
                      <span className="dd-nearby-dist">{place.distance} away</span>
                    </div>
                    <IonIcon icon={chevronForward} className="dd-nearby-arrow" />
                  </div>
                ))}
              </div>
            </ProseSection>
          )}

          {/* ── Reviews ── */}
          <ProseSection title="Reviews">
            <div className="dd-reviews-header">
              <div className="dd-reviews-summary">
                <StarRating value={ratingValue} />
                <span className="dd-rating-val">{ratingValue}</span>
                <span className="dd-review-count">({reviewCount} reviews)</span>
              </div>
              <button className="dd-write-review-btn" onClick={() => setShowReviewModal(true)}>
                <IonIcon icon={create} />Write Review
              </button>
            </div>

            {/* ── Who's been here ── */}
            {reviews.length > 0 && (
              <div className="dd-been-here">
                <div className="dd-been-here-avatars">
                  {reviews.slice(0, 6).map((rev, i) => (
                    <div
                      key={i}
                      className={`dd-been-here-avatar ${rev.anonymous ? 'dd-been-here-avatar--anon' : ''}`}
                      style={{ zIndex: 10 - i, marginLeft: i === 0 ? 0 : -10 }}
                      title={rev.anonymous ? 'Anonymous' : rev.author}
                    >
                      {rev.anonymous ? (
                        <span>?</span>
                      ) : rev.avatar ? (
                        <img src={rev.avatar} alt={rev.author} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <span>{rev.author[0]?.toUpperCase()}</span>
                      )}
                    </div>
                  ))}
                  {reviews.length > 6 && (
                    <div className="dd-been-here-avatar dd-been-here-avatar--more" style={{ zIndex: 1, marginLeft: -10 }}>
                      +{reviews.length - 6}
                    </div>
                  )}
                </div>
                <p className="dd-been-here-label">
                  <strong>{reviews.length}</strong> {reviews.length === 1 ? 'person has' : 'people have'} visited this place
                </p>
              </div>
            )}

            {reviewsLoading ? (
              <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                Loading reviews…
              </p>
            ) : reviews.length === 0 ? (
              <div className="dd-reviews-empty">
                <span className="dd-reviews-empty-icon">💬</span>
                <p>No reviews yet. Be the first to share your experience!</p>
              </div>
            ) : (
              <div className="dd-review-list">
                {reviews.map((rev: Review, i: number) => {
                  const replyState = replyMap[rev.id || String(i)] || { open: false, text: '', submitting: false };
                  const isCurrentUser = user?.uid && rev.id === user.uid;
                  return (
                    <div key={i} className="dd-review-item">
                      {/* ── Reviewer header ── */}
                      <div className="dd-review-top">
                        <div className={`dd-reviewer-avatar ${rev.anonymous ? 'dd-reviewer-avatar--anon' : ''}`}>
                          {rev.anonymous
                            ? <span className="dd-anon-icon">A</span>
                            : rev.avatar
                              ? <img src={rev.avatar} alt={rev.author} />
                              : <span>{rev.author[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <div className="dd-reviewer-meta">
                          <div className="dd-reviewer-name-row">
                            <p className="dd-reviewer-name">{rev.author}</p>
                            {isCurrentUser && <span className="dd-reviewer-you-badge">You</span>}
                          </div>
                          <div className="dd-reviewer-sub-row">
                            <StarRating value={rev.rating} />
                            {rev.createdAt && <span className="dd-review-date">{rev.createdAt}</span>}
                          </div>
                          {(rev.companion || rev.duration || rev.visitDate) && (
                            <div className="dd-review-meta-tags">
                              {rev.companion && <span className="dd-review-tag">
                                {rev.companion === 'Solo' ? '👤' : rev.companion === 'Couple' ? '👫' : rev.companion === 'Family' ? '👨‍👩‍👧' : '👥'} {rev.companion}
                              </span>}
                              {rev.duration && <span className="dd-review-tag">🕐 {rev.duration}</span>}
                              {rev.visitDate && <span className="dd-review-tag">📅 {new Date(rev.visitDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Review feeling (title) ── */}
                      {rev.feeling && <p className="dd-review-feeling">"{rev.feeling}"</p>}

                      {/* ── Review body ── */}
                      {rev.text && <p className="dd-review-text">{rev.text}</p>}

                      {/* ── Existing replies ── */}
                      {(rev.replies || []).length > 0 && (
                        <div className="dd-reply-thread">
                          {(rev.replies || []).map((reply, ri) => (
                            <div key={ri} className="dd-reply-item">
                              <div className="dd-reply-avatar">
                                <span>{reply.authorName?.[0]?.toUpperCase() || 'U'}</span>
                              </div>
                              <div className="dd-reply-body">
                                <div className="dd-reply-header">
                                  <span className="dd-reply-author">{reply.authorName}</span>
                                  {reply.isVenue && <span className="dd-reply-venue-badge">Venue</span>}
                                  {reply.createdAt && <span className="dd-reply-date">{reply.createdAt}</span>}
                                </div>
                                <p className="dd-reply-text">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── Reply action ── */}
                      {user && (
                        <div className="dd-review-actions">
                          <button
                            className={`dd-reply-toggle-btn ${replyState.open ? 'dd-reply-toggle-btn--active' : ''}`}
                            onClick={() => toggleReply(rev.id || String(i))}
                          >
                            💬 {replyState.open ? 'Cancel' : 'Reply'}
                          </button>
                        </div>
                      )}

                      {/* ── Reply input ── */}
                      {replyState.open && (
                        <div className="dd-reply-compose">
                          <div className="dd-reply-compose-avatar">
                            {user?.photoURL
                              ? <img src={user.photoURL} alt="You" />
                              : <span>{(user?.displayName || 'Y')[0].toUpperCase()}</span>
                            }
                          </div>
                          <div className="dd-reply-compose-right">
                            <textarea
                              className="dd-reply-input"
                              placeholder={`Reply to ${rev.author}…`}
                              rows={2}
                              value={replyState.text}
                              onChange={e => setReplyText(rev.id || String(i), e.target.value)}
                            />
                            <button
                              className={`dd-reply-send-btn ${(!replyState.text.trim() || replyState.submitting) ? 'dd-reply-send-btn--disabled' : ''}`}
                              onClick={() => submitReply(rev.id || String(i))}
                              disabled={!replyState.text.trim() || replyState.submitting}
                            >
                              {replyState.submitting ? 'Posting…' : 'Post Reply'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ProseSection>

          {(() => {
            const gallery = photoGallery.length > 0 ? photoGallery : images;
            return gallery.length > 0 ? (
              <ProseSection title="Photo Gallery">
                <div className="dd-gallery-grid">
                  {gallery.slice(0, 6).map((src: string, i: number) => (
                    <img key={i} src={src} alt={`Gallery ${i + 1}`} className="dd-gallery-img" />
                  ))}
                </div>
              </ProseSection>
            ) : null;
          })()}

          {upcomingEvents.length > 0 && (
            <ProseSection title="Upcoming Events">
              <div className="dd-events-list">
                {upcomingEvents.map((ev: UpcomingEvent, i: number) => (
                  <div key={i} className="dd-event-item">
                    <div className="dd-event-date">
                      <span className="dd-event-month">{ev.month}</span>
                      <span className="dd-event-day">{ev.day}</span>
                    </div>
                    <div className="dd-event-info">
                      <span className="dd-event-title">{ev.title}</span>
                      <span className="dd-event-time">{ev.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="dd-view-all-btn">View All Events</button>
            </ProseSection>
          )}

          <div style={{ height: 32 }} />
        </div>

        {/* ── Modals ── */}
        <IonModal isOpen={showItinerary} onDidDismiss={() => setShowItinerary(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Itinerary — {destName}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowItinerary(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding itin-content">
            {itineraryData && itineraryData.length > 0 ? (
              <div className="itin-wrapper">
                {itineraryData.map((day) => (
                  <div key={day.day} className="itin-day-card">
                    <div className="itin-day-header">
                      <span className="itin-day-badge">Day {day.day}</span>
                      <span className="itin-day-theme">{day.theme}</span>
                    </div>
                    <div className="itin-slots">
                      {day.slots.map((slot, si) => (
                        <div key={si} className="itin-slot">
                          <div className="itin-slot-time-col">
                            <span className="itin-slot-time">{slot.time}</span>
                            {si < day.slots.length - 1 && <div className="itin-slot-line" />}
                          </div>
                          <div className="itin-slot-body">
                            <p className="itin-slot-activity">{slot.activity}</p>
                            {slot.tip && (
                              <div className="itin-slot-tip">
                                <span className="itin-tip-icon">💡</span>
                                <span>{slot.tip}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : itinerary ? (
              <IonText><pre className="itinerary-text">{itinerary}</pre></IonText>
            ) : null}
          </IonContent>
        </IonModal>

        <IonModal isOpen={showMap} onDidDismiss={() => { setShowMap(false); setRouteError(''); }} onDidPresent={initMap}>
          <IonHeader><IonToolbar><IonTitle>{destName} Location</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowMap(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
          <IonContent scrollY={false}>
            <div ref={mapRef} className="map-container" style={{ width: '100%', height: '100%' }} />
          </IonContent>
          <IonFooter className="ion-no-border">
            <div className="map-directions-bar">
              {/* Transport mode tabs */}
              <div className="nav-mode-tabs">
                <button
                  className={`nav-mode-tab ${navMode === 'walking' ? 'active walking' : ''}`}
                  onClick={() => { setNavMode('walking'); handleGetDirections('walking'); }}
                  disabled={loadingLocation}
                >
                  <span className="nav-mode-icon">🚶</span>
                  <span>Walk</span>
                </button>
                <button
                  className={`nav-mode-tab ${navMode === 'driving' ? 'active driving' : ''}`}
                  onClick={() => { setNavMode('driving'); handleGetDirections('driving'); }}
                  disabled={loadingLocation}
                >
                  <span className="nav-mode-icon">🚗</span>
                  <span>Drive</span>
                </button>
                <button
                  className={`nav-mode-tab ${navMode === 'commute' ? 'active commute' : ''}`}
                  onClick={() => { setNavMode('commute'); handleGetDirections('commute'); }}
                  disabled={loadingLocation}
                >
                  <span className="nav-mode-icon">🚌</span>
                  <span>Commute</span>
                </button>
              </div>

              {/* Route info pill */}
              {routeInfo && (
                <div className="nav-route-info">
                  <span className="nav-route-duration">🕐 {routeInfo.duration}</span>
                  <span className="nav-route-sep">·</span>
                  <span className="nav-route-distance">📍 {routeInfo.distance}</span>
                  {navMode === 'commute' && (
                    <span className="nav-route-note">Estimated via transit</span>
                  )}
                </div>
              )}

              {routeError && <p className="route-error">{routeError}</p>}

              {routeActive ? (
                <IonButton expand="block" fill="outline" className="directions-btn directions-btn--off" onClick={handleClearRoute}>
                  <IonIcon icon={locationIcon} slot="start" />
                  Clear Directions
                </IonButton>
              ) : (
                <IonButton expand="block" fill="solid" className="directions-btn" onClick={() => handleGetDirections(navMode)} disabled={loadingLocation}>
                  <IonIcon icon={locationIcon} slot="start" />
                  {loadingLocation ? 'Getting location…' : 'Get Directions'}
                </IonButton>
              )}
            </div>
          </IonFooter>
        </IonModal>

        {/* ── WriteReviewModal wired to Firestore ── */}
        <WriteReviewModal
          isOpen={showReviewModal}
          onDidDismiss={() => setShowReviewModal(false)}
          destinationId={id || dest.id}
          destinationName={destName || 'Unknown Destination'}
          destinationCity={destAddress}
          destinationRank={mostVisitedRank || undefined}
          destinationDuration={(dest as any).visitDuration}
          destinationThumbnail={(dest as any).images?.[0] || destImageUrl}
          userId={user?.uid}
          userName={user?.displayName || undefined}
          userAvatar={user?.photoURL || undefined}
          onSubmit={(data) => {
            // Check if the current user already had a review (edit scenario)
            const existingReview = user?.uid
              ? liveReviews.find(r => r.id === user.uid)
              : undefined;

            const prevCount  = liveCount  ?? (Number(dest.reviews) || 0);
            const prevRating = liveRating ?? (parseFloat(dest.rating as any) || 0);

            let newCount: number;
            let newRating: number;

            if (existingReview) {
              // Edit: count stays the same, recalculate average by swapping old rating for new
              newCount  = prevCount;
              newRating = prevCount > 1
                ? parseFloat(
                    ((prevRating * prevCount - existingReview.rating + data.overallRating) / prevCount).toFixed(1)
                  )
                : data.overallRating;
            } else {
              // New review: increment count
              newCount  = prevCount + 1;
              newRating = parseFloat(
                ((prevRating * prevCount + data.overallRating) / newCount).toFixed(1)
              );
            }

            setLiveCount(newCount);
            setLiveRating(newRating);

            const d2 = data as any;
            const newReviewEntry: Review = {
              id:        user?.uid,
              // Use Firestore-resolved name/avatar passed back from WriteReviewModal
              author:    data.anonymous ? 'Anonymous' : (d2.resolvedName || user?.displayName || 'You'),
              avatar:    data.anonymous ? undefined    : (d2.resolvedAvatar || user?.photoURL || undefined),
              anonymous: data.anonymous,
              rating:    data.overallRating,
              text:      data.review || data.feeling || '',
              feeling:   data.feeling || '',
              visitDate: data.visitDate || '',
              companion: data.companion || '',
              duration:  data.duration || '',
              createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
              replies:   [],
            };

            if (existingReview) {
              // Replace the existing review in the list
              setLiveReviews(prev =>
                prev.map(r => r.id === user?.uid ? newReviewEntry : r)
              );
            } else {
              // Prepend brand-new review
              setLiveReviews(prev => [newReviewEntry, ...prev]);
            }

            setToastMsg('✅ Review submitted — thank you!');
          }}
        />

        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2000} position="bottom" onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};

export default DestinationDetail;