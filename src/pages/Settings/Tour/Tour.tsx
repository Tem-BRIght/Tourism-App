import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonIcon, IonLoading, IonToast,
  IonRefresher, IonRefresherContent, IonAlert, IonModal,
} from '@ionic/react';
import { useIonRouter } from '@ionic/react';
import {
  calendarOutline, locationOutline, personOutline,
  timeOutline, cashOutline, checkmarkCircle, closeCircle,
  hourglassOutline, star, callOutline,
  chevronForwardOutline, trashOutline, alertCircleOutline,
  walkOutline, bicycleOutline, mapOutline, checkmarkOutline,
  closeOutline, arrowForwardOutline, receiptOutline, ribbonOutline,
} from 'ionicons/icons';
import {
  collection, getDocs, query, where, orderBy,
  doc, deleteDoc, Timestamp,
} from 'firebase/firestore';
import { firestore } from '../../../firebase';
import { useAuth } from '../../../context/AuthContext';
import './Tour.css';

// ── Types ─────────────────────────────────────────────────────────────────────
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface Booking {
  id: string;
  guideId: string;
  guideName: string;
  guideAvatar: string;
  guideRating: number;
  destinationId: string;
  destinationName: string;
  destinationImage: string;
  tourDate: string;
  tourTime: string;
  durationHours: number;
  groupSize: number;
  totalFee: number;
  currency: string;
  status: BookingStatus;
  notes: string;
  guidePhone: string;
  createdAt: string;
  tourType?: string;
}

export type TourType = 'walking' | 'rolling';

interface TourTypeInfo {
  key: TourType;
  icon: string;
  label: string;
  tagline: string;
  shortDesc: string;
  places: string[];
  duration: string;
  fee: string;
  color: string;
  accent: string;
}

interface TimeSlot {
  id: string;
  time: string;
  label: string;
  spotsLeft: number;
  totalSpots: number;
}

// ── Tour Type Data ─────────────────────────────────────────────────────────────
const TOUR_TYPES: TourTypeInfo[] = [
  {
    key: 'walking',
    icon: walkOutline,
    label: 'Poblacion Walking Tour',
    tagline: 'Explore on foot at your own pace',
    shortDesc: "Stroll through Poblacion's historic streets, plazas, and hidden alleys with a knowledgeable local guide. Perfect for history lovers and photographers.",
    places: ['Poblacion Church', 'Rizal Avenue', 'Palengke ng Maynila', 'Heritage Houses', 'Calle Crisologo'],
    duration: '2–3 hours',
    fee: '₱350 / person',
    color: '#e0f2fe',
    accent: '#0284c7',
  },
  {
    key: 'rolling',
    icon: bicycleOutline,
    label: 'Rolling Tour',
    tagline: 'Cover more ground by bike or trike',
    shortDesc: "Hop on a bike or trike and cruise through Poblacion's main districts, markets, and scenic riverside spots. Great for families and groups.",
    places: ['Pasig Palengke', 'Pasig River Esplanade', 'Maybunga Park', 'Tikling Junction', 'Kapitolyo Strip'],
    duration: '1.5–2.5 hours',
    fee: '₱480 / person',
    color: '#dcfce7',
    accent: '#16a34a',
  },
];

// ── Time Slot Data (mock — replace with Firestore fetch) ───────────────────────
const MOCK_SLOTS: Record<TourType, TimeSlot[]> = {
  walking: [
    { id: 'w1', time: '07:00 AM', label: 'Morning Sunrise',  spotsLeft: 4, totalSpots: 8 },
    { id: 'w2', time: '09:00 AM', label: 'Mid Morning',      spotsLeft: 2, totalSpots: 8 },
    { id: 'w3', time: '03:00 PM', label: 'Golden Afternoon', spotsLeft: 7, totalSpots: 8 },
    { id: 'w4', time: '05:00 PM', label: 'Sunset Stroll',    spotsLeft: 0, totalSpots: 8 },
  ],
  rolling: [
    { id: 'r1', time: '06:30 AM', label: 'Early Bird',       spotsLeft: 5, totalSpots: 6 },
    { id: 'r2', time: '08:30 AM', label: 'Morning Ride',     spotsLeft: 1, totalSpots: 6 },
    { id: 'r3', time: '02:00 PM', label: 'Afternoon Cruise', spotsLeft: 6, totalSpots: 6 },
    { id: 'r4', time: '04:30 PM', label: 'Sunset Ride',      spotsLeft: 3, totalSpots: 6 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<BookingStatus, { label: string; icon: string; className: string }> = {
  pending:   { label: 'Pending',   icon: hourglassOutline, className: 'bh-badge--pending'   },
  confirmed: { label: 'Confirmed', icon: checkmarkCircle,  className: 'bh-badge--confirmed' },
  completed: { label: 'Completed', icon: checkmarkCircle,  className: 'bh-badge--completed' },
  cancelled: { label: 'Cancelled', icon: closeCircle,      className: 'bh-badge--cancelled' },
};

const MAIN_TABS: { key: 'tours' | 'history'; label: string }[] = [
  { key: 'tours',   label: 'Tour Types' },
  { key: 'history', label: 'History'    },
];

const toDateStr = (raw: any): string => {
  if (!raw) return '';
  if (raw instanceof Timestamp) return raw.toDate().toISOString();
  return String(raw);
};

const formatDateShort = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─────────────────────────────────────────────────────────────────────────────
const TourPage: React.FC = () => {
  const router = useIonRouter();
  const { user } = useAuth();

  const [mainTab, setMainTab]           = useState<'tours' | 'history'>('tours');
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(false);
  const [toastMsg, setToastMsg]         = useState('');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelling, setCancelling]     = useState(false);
  const [expandedTour, setExpandedTour] = useState<TourType | null>(null);

  // Availability modal
  const [slotModal, setSlotModal]       = useState(false);
  const [selectedTour, setSelectedTour] = useState<TourTypeInfo | null>(null);
  // Track joined slots (wire to Firestore as needed)
  const [joinedSlots, setJoinedSlots]   = useState<Set<string>>(new Set());
  const [joiningSlot, setJoiningSlot]   = useState<string | null>(null);

  // ── Fetch history ──────────────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(firestore, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('tourDate', 'desc'),
      );
      const snap = await getDocs(q);
      const loaded: Booking[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id:               d.id,
          guideId:          data.guideId          || '',
          guideName:        data.guideName        || 'Tour Guide',
          guideAvatar:      data.guideAvatar      || '',
          guideRating:      parseFloat(data.guideRating) || 0,
          destinationId:    data.destinationId    || '',
          destinationName:  data.destinationName  || 'Unknown Destination',
          destinationImage: data.destinationImage || data.destImage || '',
          tourDate:         toDateStr(data.tourDate),
          tourTime:         data.tourTime         || '',
          durationHours:    data.durationHours    || data.duration || 1,
          groupSize:        data.groupSize        || 1,
          totalFee:         parseFloat(data.totalFee || data.fee || 0),
          currency:         data.currency         || '₱',
          status:           (data.status as BookingStatus) || 'pending',
          notes:            data.notes            || '',
          guidePhone:       data.guidePhone       || '',
          createdAt:        toDateStr(data.createdAt),
          tourType:         data.tourType         || '',
        } as Booking;
      });
      setBookings(loaded);
    } catch (err) {
      console.error('[TourPage] load failed:', err);
      setToastMsg('Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (mainTab === 'history') loadBookings();
  }, [mainTab, loadBookings]);

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await deleteDoc(doc(firestore, 'bookings', cancelTarget.id));
      setBookings(prev => prev.filter(b => b.id !== cancelTarget.id));
      setToastMsg('Booking cancelled.');
    } catch (err) {
      setToastMsg('Could not cancel. Try again.');
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  // ── Join slot ──────────────────────────────────────────────────────────────
  const handleJoin = async (slot: TimeSlot) => {
    if (joinedSlots.has(slot.id)) return;
    setJoiningSlot(slot.id);
    try {
      // TODO: replace with Firestore write
      // await setDoc(doc(firestore, 'slotJoins', `${user.uid}_${slot.id}`), { ... })
      await new Promise(res => setTimeout(res, 600));
      setJoinedSlots(prev => new Set([...prev, slot.id]));
      setToastMsg(`You joined the ${slot.time} slot! 🎉`);
    } catch {
      setToastMsg('Could not join. Try again.');
    } finally {
      setJoiningSlot(null);
    }
  };

  const openAvailability = (tour: TourTypeInfo) => {
    setSelectedTour(tour);
    setSlotModal(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/settings" /></IonButtons>
          <IonTitle>Tour Guide</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonLoading isOpen={loading || cancelling} message={cancelling ? 'Cancelling…' : 'Loading…'} />

      <IonContent className="bh-content">
        <IonRefresher slot="fixed" onIonRefresh={async e => { await loadBookings(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* ── Main tabs ───────────────────────────────────────────────────── */}
        <div className="bh-tab-bar">
          {MAIN_TABS.map(t => (
            <button
              key={t.key}
              className={`bh-tab ${mainTab === t.key ? 'bh-tab--active' : ''}`}
              onClick={() => setMainTab(t.key)}
            >
              {t.label}
              {t.key === 'history' && bookings.length > 0 && (
                <span className="bh-tab-count">{bookings.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ════════════════════ TOUR TYPES ════════════════════ */}
        {mainTab === 'tours' && (
          <div className="tour-types-list">

            {TOUR_TYPES.map(tour => (
              <div key={tour.key} className="tour-type-card">
                <div
                  className="tour-type-header"
                  style={{ background: tour.color }}
                  onClick={() => setExpandedTour(expandedTour === tour.key ? null : tour.key)}
                >
                  <div className="tour-type-icon-wrap" style={{ background: tour.accent }}>
                    <IonIcon icon={tour.icon} />
                  </div>
                  <div className="tour-type-header-text">
                    <h3 className="tour-type-label">{tour.label}</h3>
                    <p className="tour-type-tagline">{tour.tagline}</p>
                  </div>
                  <IonIcon
                    icon={chevronForwardOutline}
                    className={`tour-type-chevron ${expandedTour === tour.key ? 'tour-type-chevron--open' : ''}`}
                  />
                </div>

                {expandedTour === tour.key && (
                  <div className="tour-type-body">
                    <p className="tour-type-desc">{tour.shortDesc}</p>
                    <div className="tour-type-meta">
                      <span className="tour-meta-pill"><IonIcon icon={timeOutline} /> {tour.duration}</span>
                      <span className="tour-meta-pill"><IonIcon icon={cashOutline} /> {tour.fee}</span>
                    </div>
                    <p className="tour-places-label">Places you'll visit</p>
                    <ul className="tour-places-list">
                      {tour.places.map((place, i) => (
                        <li key={i} className="tour-place-item">
                          <IonIcon icon={locationOutline} style={{ color: tour.accent }} />
                          {place}
                        </li>
                      ))}
                    </ul>
                    <button className="tour-avail-btn" style={{ background: tour.accent }} onClick={() => openAvailability(tour)}>
                      Check Availability <IonIcon icon={arrowForwardOutline} />
                    </button>
                  </div>
                )}

                {expandedTour !== tour.key && (
                  <div className="tour-type-collapsed-footer">
                    <span className="tour-collapsed-meta"><IonIcon icon={timeOutline} /> {tour.duration}</span>
                    <span className="tour-collapsed-meta"><IonIcon icon={cashOutline} /> {tour.fee}</span>
                    <button className="tour-avail-btn-sm" style={{ background: tour.accent }}
                      onClick={e => { e.stopPropagation(); openAvailability(tour); }}>
                      Check Availability
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════ HISTORY ════════════════════ */}
        {mainTab === 'history' && (
          <div className="history-wrap">
            {!loading && bookings.length === 0 && (
              <div className="bh-empty">
                <div className="bh-empty-icon">🧭</div>
                <h3 className="bh-empty-title">No tour history yet</h3>
                <p className="bh-empty-sub">Tours you join or book will appear here.</p>
                <button className="bh-empty-btn" onClick={() => setMainTab('tours')}>Explore Tours</button>
              </div>
            )}

            {bookings.length > 0 && (
              <div className="history-timeline">
                {bookings.map((booking, idx) => {
                  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                  const isLast    = idx === bookings.length - 1;
                  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

                  return (
                    <div key={booking.id} className={`ht-row ${isLast ? 'ht-row--last' : ''}`}>
                      {/* Spine */}
                      <div className="ht-spine">
                        <div className={`ht-dot ht-dot--${booking.status}`}>
                          <IonIcon icon={statusCfg.icon} />
                        </div>
                        {!isLast && <div className="ht-line" />}
                      </div>

                      {/* Card */}
                      <div className="ht-card">
                        <div className="ht-card-top">
                          <span className="ht-date">
                            <IonIcon icon={calendarOutline} />
                            {formatDateShort(booking.tourDate)}
                            {booking.tourTime && ` · ${booking.tourTime}`}
                          </span>
                          <span className={`ht-status-pill ht-status-pill--${booking.status}`}>
                            {statusCfg.label}
                          </span>
                        </div>

                        <div className="ht-dest-row"
                          onClick={() => booking.destinationId && router.push(`/destination/${booking.destinationId}`)}>
                          {booking.destinationImage
                            ? <img src={booking.destinationImage} alt={booking.destinationName} className="ht-dest-thumb"
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            : <div className="ht-dest-thumb ht-dest-placeholder">🏛️</div>
                          }
                          <div className="ht-dest-info">
                            <p className="ht-dest-name">{booking.destinationName}</p>
                            {booking.tourType && (
                              <span className="ht-tour-type-tag">
                                <IonIcon icon={booking.tourType === 'rolling' ? bicycleOutline : walkOutline} />
                                {booking.tourType === 'rolling' ? 'Rolling Tour' : 'Walking Tour'}
                              </span>
                            )}
                          </div>
                          <IonIcon icon={chevronForwardOutline} className="ht-arrow" />
                        </div>

                        <div className="ht-meta-row">
                          <div className="ht-guide-chip">
                            <div className="ht-guide-avatar">
                              {booking.guideAvatar
                                ? <img src={booking.guideAvatar} alt={booking.guideName} />
                                : <IonIcon icon={personOutline} />}
                            </div>
                            <span className="ht-guide-name">{booking.guideName}</span>
                            {booking.guideRating > 0 && (
                              <span className="ht-guide-rating">
                                <IonIcon icon={star} /> {booking.guideRating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <div className="ht-detail-chips">
                            <span className="ht-chip"><IonIcon icon={hourglassOutline} /> {booking.durationHours}h</span>
                            <span className="ht-chip"><IonIcon icon={personOutline} /> {booking.groupSize}</span>
                            {booking.totalFee > 0 && (
                              <span className="ht-chip"><IonIcon icon={cashOutline} /> {booking.currency}{booking.totalFee.toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        {booking.notes && (
                          <div className="ht-notes">
                            <IonIcon icon={alertCircleOutline} />
                            <p>{booking.notes}</p>
                          </div>
                        )}

                        <div className="ht-footer">
                          {booking.guidePhone && (
                            <a href={`tel:${booking.guidePhone}`} className="ht-action-btn ht-action-call">
                              <IonIcon icon={callOutline} /> Call Guide
                            </a>
                          )}
                          {canCancel && (
                            <button className="ht-action-btn ht-action-cancel" onClick={() => setCancelTarget(booking)}>
                              <IonIcon icon={trashOutline} /> Cancel
                            </button>
                          )}
                          {booking.status === 'completed' && (
                            <span className="ht-completed-badge">
                              <IonIcon icon={ribbonOutline} /> Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ height: 32 }} />

        <IonAlert
          isOpen={!!cancelTarget}
          onDidDismiss={() => setCancelTarget(null)}
          header="Cancel Booking"
          message={`Cancel your tour with ${cancelTarget?.guideName} at ${cancelTarget?.destinationName}?`}
          buttons={[
            { text: 'Keep It', role: 'cancel' },
            { text: 'Cancel Booking', cssClass: 'alert-button-danger', handler: confirmCancel },
          ]}
        />

        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2200} position="bottom" onDidDismiss={() => setToastMsg('')} />
      </IonContent>

      {/* ════════════════════ AVAILABILITY MODAL ════════════════════ */}
      <IonModal isOpen={slotModal} onDidDismiss={() => setSlotModal(false)} breakpoints={[0, 0.8, 1]} initialBreakpoint={0.8}>
        <div className="slot-modal">
          <div className="slot-modal-header">
            <div>
              <p className="slot-modal-label">Available Slots</p>
              <h3 className="slot-modal-title">{selectedTour?.label}</h3>
            </div>
            <button className="slot-modal-close" onClick={() => setSlotModal(false)}>
              <IonIcon icon={closeOutline} />
            </button>
          </div>

          <p className="slot-modal-date">
            Today · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>

          <div className="slot-list">
            {(MOCK_SLOTS[selectedTour?.key ?? 'walking'] ?? []).map(slot => {
              const full    = slot.spotsLeft === 0;
              const joined  = joinedSlots.has(slot.id);
              const joining = joiningSlot === slot.id;
              const pct     = ((slot.totalSpots - slot.spotsLeft) / slot.totalSpots) * 100;

              return (
                <div
                  key={slot.id}
                  className={`slot-item ${joined ? 'slot-item--joined' : ''} ${full && !joined ? 'slot-item--full' : ''}`}
                  style={joined ? { borderColor: selectedTour?.accent, background: selectedTour?.color } : {}}
                >
                  {/* Time + label */}
                  <div className="slot-time-col">
                    <span className="slot-time">{slot.time}</span>
                    <span className="slot-label-text">{slot.label}</span>
                  </div>

                  {/* Spots bar */}
                  <div className="slot-spots-col">
                    <span className={`slot-spots-text ${full && !joined ? 'slot-spots-full' : joined ? 'slot-spots-joined' : ''}`}>
                      {joined ? 'You joined' : full ? 'Full' : `${slot.spotsLeft} spots left`}
                    </span>
                    <div className="slot-bar-track">
                      <div
                        className="slot-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: full && !joined ? '#ef4444' : selectedTour?.accent,
                          opacity: joined ? 0.55 : 1,
                        }}
                      />
                    </div>
                  </div>

                  {/* Join / Joined */}
                  <div className="slot-action-col">
                    {joined ? (
                      <span className="slot-joined-pill" style={{ color: selectedTour?.accent, borderColor: selectedTour?.accent }}>
                        <IonIcon icon={checkmarkOutline} /> Joined
                      </span>
                    ) : (
                      <button
                        className="slot-join-btn"
                        disabled={full || joining}
                        style={!full ? { background: selectedTour?.accent } : {}}
                        onClick={() => handleJoin(slot)}
                      >
                        {joining ? '…' : full ? 'Full' : 'Join'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="slot-modal-footer">
            <p className="slot-footer-note">
              <IonIcon icon={receiptOutline} />
              Payment collected on the day of the tour. Cancel anytime before it starts.
            </p>
          </div>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default TourPage;