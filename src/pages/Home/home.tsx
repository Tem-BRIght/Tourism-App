// src/pages/Home/home.tsx
import React, { useState, useEffect } from 'react';
import {
  IonContent, IonHeader, IonPage, IonToolbar,
  IonSearchbar, IonButtons, IonButton, IonIcon,
  IonGrid, IonRow, IonCol, IonCard,
  IonImg, IonAvatar, IonToast,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  search, personCircle, notifications,
  location, star, heart, heartOutline,
} from 'ionicons/icons';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { fetchRecommendedDestinations, fetchPopularDestinations } from '../../services/destinationService';
import { getUserProfile } from '../../services/userProfileService';
import { toggleFavorite, subscribeFavoriteIds } from '../../services/favoritesService';
import { Destination } from '../../types';
import { useUserLocation } from '../../services/useUserLocation';
import { formatDistance } from '../../services/distance';
import './Home.css';

const truncate = (text: string = '', maxLength = 60) =>
  text.length <= maxLength ? text : text.substring(0, maxLength) + '…';

/* ─── Skeleton sub-components ─────────────────────────────────────────── */
const SkeletonRecommendCard: React.FC = () => (
  <div className="skeleton-recommend-card">
    <div className="skeleton-img" />
    <div className="skeleton-body">
      <div className="skeleton-line short" />
      <div className="skeleton-line medium" />
      <div className="skeleton-line long" />
      <div className="skeleton-line tiny" />
    </div>
  </div>
);

const SkeletonPopularCard: React.FC = () => (
  <div className="skeleton-popular-card">
    <div className="skeleton-img" />
    <div className="skeleton-body">
      <div className="skeleton-line medium" />
      <div className="skeleton-line short" />
    </div>
  </div>
);

const HomeSkeleton: React.FC = () => (
  <IonPage>
    <IonHeader className="header">
      <IonToolbar className="top-bar">
        <IonButtons slot="start" className="left-icons">
          <IonButton fill="clear">
            <div className="skeleton-icon-circle" />
          </IonButton>
        </IonButtons>
        <div className="skeleton-searchbar" />
        <IonButtons slot="end" className="right-icons">
          <IonButton fill="clear">
            <div className="skeleton-avatar-circle" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent fullscreen>
      {/* Recommended skeleton */}
      <section className="section">
        <div className="section-header">
          <div className="skeleton-line" style={{ width: 160, height: 18, borderRadius: 8 }} />
          <div className="skeleton-line" style={{ width: 50, height: 14, borderRadius: 8 }} />
        </div>
        <div className="horizontal-scroll" style={{ gap: 14 }}>
          {[1, 2, 3].map(i => <SkeletonRecommendCard key={i} />)}
        </div>
      </section>

      {/* Popular skeleton */}
      <section className="section">
        <div className="section-header">
          <div className="skeleton-line" style={{ width: 180, height: 18, borderRadius: 8 }} />
          <div className="skeleton-line" style={{ width: 56, height: 14, borderRadius: 8 }} />
        </div>
        <IonGrid className="popular-grid">
          <IonRow>
            {[1, 2, 3, 4].map(i => (
              <IonCol key={i} size="6" size-md="4" size-lg="3">
                <SkeletonPopularCard />
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
      </section>
    </IonContent>
  </IonPage>
);

/* ─── Main component ──────────────────────────────────────────────────── */
const Home: React.FC = () => {
  const history = useHistory();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { coords } = useUserLocation();

  const [profilePic, setProfilePic]   = useState('/assets/images/Temporary.png');
  const [firstName, setFirstName]     = useState('');
  const [favorites, setFavorites]     = useState<Set<string>>(new Set());
  const [recommended, setRecommended] = useState<Destination[]>([]);
  const [popular, setPopular]         = useState<Destination[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [toastMsg, setToastMsg]       = useState('');
  // rank map: destination title → rank number (1 = most visited)
  const [visitRanks, setVisitRanks]   = useState<Map<string, number>>(new Map());

  // ── auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) history.replace('/login');
  }, [isAuthenticated, authLoading, history]);

  // ── profile ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.uid) {
      (async () => {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile?.img)             setProfilePic(profile.img);
          if (profile?.name?.firstname) setFirstName(profile.name.firstname);
          else if (profile?.nickname)   setFirstName(profile.nickname);
        } catch (err) { console.error(err); }
      })();
    }
  }, [authLoading, isAuthenticated, user]);

  // ── destinations + visit ranks ───────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      (async () => {
        try {
          setDataLoading(true);
          const [recData, popData] = await Promise.all([
            fetchRecommendedDestinations(),
            fetchPopularDestinations(),
          ]);
          setRecommended(recData ?? []);
          setPopular(popData ?? []);

          // Build rank map from the `visits` collection (each doc = 1 tourist scan)
          const visitsSnap = await getDocs(collection(firestore, 'visits'));
          const countMap   = new Map<string, number>();
          visitsSnap.forEach(d => {
            const name: string = (d.data() as any).destinationTop ?? '';
            if (name) countMap.set(name, (countMap.get(name) ?? 0) + 1);
          });
          // Sort descending → assign rank 1, 2, 3…
          const ranked = Array.from(countMap.entries())
            .sort((a, b) => b[1] - a[1]);
          const rankMap = new Map<string, number>();
          ranked.forEach(([name], i) => rankMap.set(name, i + 1));
          setVisitRanks(rankMap);
        } catch (err) { console.error(err); }
        finally { setDataLoading(false); }
      })();
    }
  }, [authLoading, isAuthenticated]);

  // ── real-time RTDB favorites listener ────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeFavoriteIds(user.uid, ids => setFavorites(ids));
    return () => unsub();
  }, [user?.uid]);

  // ── Distance helper ────────────────────────────────────────────────────
  const getDistance = (dest: Destination): string => {
    const destLat: number | undefined =
      (dest as any).locationCoords?.lat ??
      (dest as any).location?.lat ??
      (dest as any).location?.latitude ??
      (dest as any).lat ?? undefined;
    const destLng: number | undefined =
      (dest as any).locationCoords?.lng ??
      (dest as any).location?.lng ??
      (dest as any).location?.longitude ??
      (dest as any).lng ?? undefined;

    if (coords && destLat != null && destLng != null) {
      return formatDistance(coords.latitude, coords.longitude, destLat, destLng);
    }
    const stored = (dest as any).distance;
    return stored && stored !== 'Unknown' ? stored : '—';
  };

  const handleFavoriteToggle = async (dest: Destination, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;
    const currentlyFav = favorites.has(dest.id);
    setFavorites(prev => {
      const next = new Set(prev);
      currentlyFav ? next.delete(dest.id) : next.add(dest.id);
      return next;
    });
    try {
      await toggleFavorite(user.uid, dest, currentlyFav);
      setToastMsg(currentlyFav ? 'Removed from Favorites' : '❤️ Added to Favorites');
    } catch (err) {
      setFavorites(prev => {
        const next = new Set(prev);
        currentlyFav ? next.add(dest.id) : next.delete(dest.id);
        return next;
      });
      console.error('Favorite toggle failed', err);
    }
  };

  const handleDestinationClick = (dest: Destination) =>
    history.push(`/destination/${dest.id}`, dest);

  /** Navigate to Maps when the user taps or types in the searchbar */
  const goToMaps = () => history.push('/maps');

  // ── Show skeleton while loading ─────────────────────────────────────────
  if (authLoading || dataLoading) return <HomeSkeleton />;

  return (
    <IonPage>
      {/* ── Header ── */}
      <IonHeader className="header">
        <IonToolbar className="top-bar">
          <IonButtons slot="start" className="left-icons">
            <IonButton fill="clear" aria-label="Notifications"
              onClick={() => history.push('/notifications')}>
              <span className="notification-badge" />
              <IonIcon icon={notifications} />
            </IonButton>
          </IonButtons>

          {/* Tapping the searchbar navigates to Maps */}
          <div
            className="main-search-tap-area"
            onClick={goToMaps}
            role="button"
            aria-label="Search destinations"
          >
            <IonSearchbar
              className="main-search"
              placeholder="Search destinations…"
              searchIcon={search}
              
              onIonFocus={goToMaps}
            />
          </div>

          <IonButtons slot="end" className="right-icons">
            <IonButton fill="clear" aria-label="Profile" onClick={() => history.push('/Settings')}>
              <div className="profile-pic-container">
                {profilePic
                  ? <IonAvatar className="profile-pic">
                      <img src={profilePic} alt="Profile" />
                    </IonAvatar>
                  : <IonIcon icon={personCircle} style={{ fontSize: 32 }} />}
              </div>
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        {/* AI guide FAB */}
        <div className="ai-nav-button" role="button" aria-label="Open AI Guide"
          onClick={() => history.push('/ai-guide')}>
          <IonImg src="/assets/images/AI/ALI 3.png" />
        </div>

        {/* ── Recommended ── */}
        <section className="section">
          <div className="section-header">
            <h2>Recommended for You</h2>
            <IonButton fill="clear" className="view-all"
              onClick={() => history.push('/recommended')}>
              See All
            </IonButton>
          </div>

          <div className="horizontal-scroll">
            {recommended.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 14 }}>No recommendations yet.</p>
            ) : recommended
                .filter(place =>
                  (place as any).status !== 'Temporarily Closed' &&
                  (place as any).tempStatus !== 'Temporarily Closed'
                )
                .map(place => (
              <IonCard key={place.id} className="recommend-card"
                onClick={() => handleDestinationClick(place)}>
                <div className="image-container">
                  <IonImg src={place.imageUrl || place.image} alt={place.title || place.name} />
                  {place.category && <span className="card-category-tag">{place.category}</span>}
                </div>
                <div className="card-body">
                  <div className="card-location">
                    <IonIcon icon={location} />
                    <span className="location-text">{place.address}</span>
                  </div>
                  <h3 className="card-title">{place.title || place.name}</h3>
                  <p className="card-desc">{truncate((place as any).shortDescription || (place as any).fullDescription || place.desc || '')}</p>
                  <div className="meta-row">
                    <div className="rating">
                      <IonIcon icon={star} />
                      <span>{place.rating || '0'}</span>
                    </div>
                    <span className="dot">•</span>
                    <span className="distance">{getDistance(place)}</span>
                  </div>
                </div>
              </IonCard>
            ))}
          </div>
        </section>

        {/* ── Popular ── */}
        <section className="section">
          <div className="section-header">
            <h2>Popular Destinations</h2>
            <IonButton fill="clear" className="view-all"
              onClick={() => history.push('/popular')}>
              View All
            </IonButton>
          </div>

          <IonGrid className="popular-grid">
            <IonRow>
              {popular.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 14, padding: '0 4px' }}>
                  No popular destinations yet.
                </p>
              ) : popular.slice(0, 5).map(dest => {
                const d = dest as any;
                return (
                  <IonCol key={dest.id} size="6" size-md="4" size-lg="3">
                    <div
                      className={`popular-card${(d.status === 'Temporarily Closed' || d.tempStatus === 'Temporarily Closed') ? ' card-closed' : ''}`}
                      role="button"
                      aria-label={`View ${dest.title || dest.name}`}
                      onClick={() => handleDestinationClick(dest)}
                    >
                      <div className="image-container">
                        <IonImg src={dest.imageUrl || dest.image} alt={dest.title || dest.name} />
                        {(d.status === 'Temporarily Closed' || d.tempStatus === 'Temporarily Closed') && (
                          <div className="card-closed-overlay">
                            <span className="card-closed-label">Temporarily Closed</span>
                          </div>
                        )}
                        <div
                          className="heart-icon"
                          role="button"
                          aria-label={favorites.has(dest.id) ? 'Remove from favorites' : 'Add to favorites'}
                          onClick={e => handleFavoriteToggle(dest, e)}
                        >
                          <IonIcon icon={favorites.has(dest.id) ? heart : heartOutline} />
                        </div>
                        {(() => {
                          const name  = dest.title || dest.name || '';
                          const rank  = visitRanks.get(name);
                          return rank ? <div className="ribbon">#{rank}</div> : null;
                        })()}
                      </div>
                      <div className="card-info">
                        <h4>{dest.title || dest.name}</h4>
                        <div className="rating">
                          <IonIcon icon={star} />
                          <span>{dest.rating || '0'}</span>
                          {dest.reviews && <span style={{ color: '#94A3B8' }}>({dest.reviews})</span>}
                        </div>
                        <div className="distance">
                          <IonIcon icon={location} />
                          <span>{getDistance(dest)}</span>
                        </div>
                      </div>
                    </div>
                  </IonCol>
                );
              })}
            </IonRow>
          </IonGrid>
        </section>

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={2000}
          position="bottom"
          onDidDismiss={() => setToastMsg('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;