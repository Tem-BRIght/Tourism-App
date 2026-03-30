import React, { useEffect, useRef, useState } from 'react';
import { IonContent, IonPage, IonIcon } from '@ionic/react';
import {
  arrowBack,
  close,
  locationOutline,
  searchOutline,
  star,
  navigateOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import './maps.css';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { fetchRecommendedDestinations, fetchPopularDestinations } from '../../services/destinationService';
import { useUserLocation } from '../../services/useUserLocation';
import { formatDistance } from '../../services/distance';
import { Destination } from '../../types';

// ── Helper: resolve lat/lng from any known Firestore shape ────────────────
const resolveCoords = (dest: any): { lat: number; lng: number } | null => {
  const lat =
    dest?.locationCoords?.lat ??
    dest?.location?.lat ??
    dest?.location?.latitude ??
    dest?.lat ??
    null;
  const lng =
    dest?.locationCoords?.lng ??
    dest?.location?.lng ??
    dest?.location?.longitude ??
    dest?.lng ??
    null;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
};

const MapPage: React.FC = () => {
  const history = useHistory();
  const { coords } = useUserLocation();

  const mapRef        = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef    = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const initDoneRef   = useRef(false);

  const [searchQuery,     setSearchQuery]     = useState('');
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [searchResults,   setSearchResults]   = useState<Destination[]>([]);
  const [selectedDest,    setSelectedDest]    = useState<Destination | null>(null);
  const [error,           setError]           = useState<string | null>(null);
  const [mapReady,        setMapReady]        = useState(false);

  // ── Fetch all destinations on mount ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [recommended, popular] = await Promise.all([
          fetchRecommendedDestinations(),
          fetchPopularDestinations(),
        ]);
        const merged = [...recommended, ...popular];
        const unique = Array.from(new Map(merged.map(d => [d.id, d])).values());
        setAllDestinations(unique);
      } catch (err) {
        console.error('Failed to load destinations:', err);
        setError('Failed to load destinations.');
      }
    };
    load();
  }, []);

  // ── Search logic ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(
      allDestinations.filter(d =>
        (d.title || d.name || '').toLowerCase().includes(q) ||
        (d.address || '').toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q)
      )
    );
  }, [searchQuery, allDestinations]);

  // ── Distance helper ───────────────────────────────────────────────────────
  const getDistance = (dest: Destination): string => {
    const c = resolveCoords(dest);
    if (coords && c) {
      return formatDistance(coords.latitude, coords.longitude, c.lat, c.lng);
    }
    const stored = (dest as any).distance;
    return stored && stored !== 'Unknown' ? stored : '—';
  };

  // ── Init Leaflet — once, after the wrapper div is in the DOM ──────────────
  useEffect(() => {
    if (!mapRef.current || initDoneRef.current) return;
    initDoneRef.current = true;

    try {
      const center: [number, number] = coords
        ? [coords.latitude, coords.longitude]
        : [14.5995, 120.9842];

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView(center, 13);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      if (coords) {
        userMarkerRef.current = L.circleMarker(
          [coords.latitude, coords.longitude],
          { radius: 8, fillColor: '#3B82F6', color: '#fff', weight: 2, fillOpacity: 1 }
        ).addTo(map).bindPopup('<b>You are here</b>');
      }

      leafletMapRef.current = map;

      // KEY FIX: give the browser one frame to apply CSS dimensions,
      // then tell Leaflet to recalculate the container size.
      requestAnimationFrame(() => {
        map.invalidateSize();
        setMapReady(true);
      });
    } catch (err) {
      console.error(err);
      setError('Error initializing map.');
    }

    return () => {
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      initDoneRef.current   = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run exactly once on mount

  // ── Update user dot when GPS coords arrive / change ───────────────────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !coords) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([coords.latitude, coords.longitude]);
    } else {
      userMarkerRef.current = L.circleMarker(
        [coords.latitude, coords.longitude],
        { radius: 8, fillColor: '#3B82F6', color: '#fff', weight: 2, fillOpacity: 1 }
      ).addTo(map).bindPopup('<b>You are here</b>');
    }
  }, [coords]);

  // ── Markers ───────────────────────────────────────────────────────────────
  const addMarkersToMap = (map: L.Map, destinations: Destination[]) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const pinIcon = (color: string) =>
      L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:${color};border:3px solid #fff;
          transform:rotate(-45deg);
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36],
      });

    destinations.forEach(dest => {
      const c = resolveCoords(dest);
      if (!c) return;

      const marker = L.marker([c.lat, c.lng], { icon: pinIcon('#3B82F6') })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:'DM Sans',sans-serif;min-width:160px">
            <strong style="font-size:13px;color:#0F172A">${dest.title || dest.name}</strong>
            <p style="margin:4px 0 0;font-size:11px;color:#64748B">${dest.address || ''}</p>
            ${dest.rating ? `<p style="margin:4px 0 0;font-size:11px;color:#F59E0B">★ ${dest.rating}</p>` : ''}
          </div>
        `);

      marker.on('click', () => setSelectedDest(dest));
      markersRef.current.push(marker);
    });
  };

  useEffect(() => {
    if (!leafletMapRef.current || !mapReady) return;
    addMarkersToMap(
      leafletMapRef.current,
      searchResults.length > 0 ? searchResults : allDestinations
    );
  }, [searchResults, allDestinations, mapReady]);

  // ── Fly to destination ────────────────────────────────────────────────────
  const flyToDestination = (dest: Destination) => {
    const c = resolveCoords(dest);
    if (leafletMapRef.current && c) {
      leafletMapRef.current.flyTo([c.lat, c.lng], 16, { duration: 1.2 });
    }
    setSelectedDest(dest);
    setSearchQuery('');
  };

  const handleGoClick = (dest: Destination) =>
    history.push(`/destination/${dest.id}`, dest);

  const showResults = searchQuery.trim().length > 0;

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div className="map-page-wrapper">

          {/* ── Header ── */}
          <div className="map-header">
            <button
              className="map-back-btn"
              onClick={() => history.goBack()}
              aria-label="Back"
            >
              <IonIcon icon={arrowBack} />
            </button>

            <div className="map-search-bar">
              <IonIcon icon={searchOutline} className="map-search-icon" />
              <input
                autoFocus
                className="map-search-input"
                placeholder="Search destinations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {searchQuery.length > 0 && (
              <button
                className="map-clear-btn"
                onClick={() => { setSearchQuery(''); setSelectedDest(null); }}
                aria-label="Clear"
              >
                <IonIcon icon={close} />
              </button>
            )}
          </div>

          {/* ── Search results ── */}
          {showResults && (
            <div className={`search-results-panel ${searchResults.length > 0 ? 'has-results' : ''}`}>
              {searchResults.length > 0
                ? searchResults.map(dest => (
                    <div
                      key={dest.id}
                      className={`result-item ${selectedDest?.id === dest.id ? 'active' : ''}`}
                      onClick={() => flyToDestination(dest)}
                    >
                      <div className="result-pin-icon">
                        <IonIcon icon={locationOutline} />
                      </div>
                      <div className="result-info">
                        <div className="result-name">{dest.title || dest.name}</div>
                        <div className="result-addr">{dest.address}</div>
                      </div>
                      <div className="result-dist">{getDistance(dest)}</div>
                    </div>
                  ))
                : (
                  <div className="no-results">
                    <IonIcon icon={searchOutline} />
                    <p>No results for "<strong>{searchQuery}</strong>"</p>
                  </div>
                )
              }
            </div>
          )}

          {/* ── Error ── */}
          {error && <div className="map-error"><p>{error}</p></div>}

          {/* ── Map ── */}
          <div
            ref={mapRef}
            className={`map-container ${error ? 'hidden' : ''}`}
          />

          {/* ── Selected destination card ── */}
          {selectedDest && !showResults && (
            <div className="dest-bottom-card">
              <img
                className="dest-card-img"
                src={(selectedDest as any).imageUrl || (selectedDest as any).image}
                alt={selectedDest.title || selectedDest.name}
              />
              <div className="dest-card-info">
                <p className="dest-card-name">{selectedDest.title || selectedDest.name}</p>
                <p className="dest-card-addr">
                  <IonIcon icon={locationOutline} />
                  {selectedDest.address}
                </p>
                <div className="dest-card-meta">
                  {selectedDest.rating && (
                    <span className="dest-card-rating">
                      <IonIcon icon={star} /> {selectedDest.rating}
                    </span>
                  )}
                  <span className="dest-card-dist">{getDistance(selectedDest)}</span>
                </div>
              </div>
              <button
                className="dest-go-btn"
                onClick={() => handleGoClick(selectedDest)}
                aria-label="Go"
              >
                <IonIcon icon={navigateOutline} />
                Go
              </button>
            </div>
          )}

        </div>
      </IonContent>
    </IonPage>
  );
};

export default MapPage;