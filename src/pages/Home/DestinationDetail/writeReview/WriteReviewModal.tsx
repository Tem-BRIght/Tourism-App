import React, { useState, useRef } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonButton, IonContent, IonIcon,
} from '@ionic/react';
import { arrowBack, chevronDown, chevronUp, locationOutline, timeOutline } from 'ionicons/icons';
import {
  collection, doc, runTransaction, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { firestore } from '../../../../firebase';
import { getUserProfile } from '../../../../services/userProfileService';
import './WriteReviewModal.css';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Props {
  isOpen: boolean;
  onDidDismiss: () => void;
  destinationId: string;
  destinationName: string;
  destinationCity?: string;
  destinationRank?: string;
  destinationDuration?: string;
  destinationThumbnail?: string;
  /** Current authenticated user — required to key reviews by userId */
  userId?: string;
  userName?: string;
  userAvatar?: string;
  onSubmit?: (data: ReviewFormData) => void;
}

export interface ReviewFormData {
  overallRating: number;
  detailedRatings: Record<string, number>;
  feeling: string;
  review: string;
  photos: File[];
  visitDate: string;
  companion: string;
  duration: string;
  anonymous: boolean;
  allowVenueReply: boolean;
}

const COMPANION_OPTIONS = ['Solo', 'Couple', 'Family', 'Friends'] as const;
const DURATION_OPTIONS  = ['Less than 1 hour', '1-2 hours', '2-3 hours', 'More than 3 hours'] as const;

const DETAILED_CATEGORIES = [
  { key: 'cleanliness',   label: 'Cleanliness'     },
  { key: 'accessibility', label: 'Accessibility'   },
  { key: 'value',         label: 'Value for Money' },
  { key: 'family',        label: 'Family-friendly' },
];

const REVIEW_GUIDELINES = [
  'Be honest and factual',
  'Focus on your personal experience',
  'Avoid personal information',
  'Be respectful',
];

/* ── Star picker ────────────────────────────────────────────────────────────── */
const StarPicker: React.FC<{
  value: number;
  onChange: (v: number) => void;
  size?: 'lg' | 'sm';
}> = ({ value, onChange, size = 'lg' }) => {
  const [hovered, setHovered] = useState(0);

  return (
    <div className={`wrm-star-picker ${size === 'sm' ? 'wrm-star-picker--sm' : ''}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`wrm-star-btn ${(hovered || value) >= n ? 'wrm-star-btn--filled' : ''}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
};


/* ── Main Modal ─────────────────────────────────────────────────────────────── */
const WriteReviewModal: React.FC<Props> = ({
  isOpen,
  onDidDismiss,
  destinationId,
  destinationName,
  destinationCity,
  destinationRank,
  destinationDuration,
  destinationThumbnail,
  userId,
  userName,
  userAvatar,
  onSubmit,
}) => {
  /* form state */
  const [overallRating,    setOverallRating]    = useState(0);
  const [showDetailed,     setShowDetailed]     = useState(false);
  const [detailedRatings,  setDetailedRatings]  = useState<Record<string, number>>({});
  const [feeling,          setFeeling]          = useState('');
  const [review,           setReview]           = useState('');
  const [photos,           setPhotos]           = useState<File[]>([]);
  const [photoPreviews,    setPhotoPreviews]     = useState<string[]>([]);
  const [photoBase64s,     setPhotoBase64s]      = useState<string[]>([]);
  const [visitDate,        setVisitDate]        = useState('');
  const [companion,        setCompanion]        = useState('');
  const [duration,         setDuration]         = useState('');
  const [anonymous,        setAnonymous]        = useState(false);
  const [allowVenueReply,  setAllowVenueReply]  = useState(true);
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState('');
  const [resolvedName,     setResolvedName]     = useState('');
  const [resolvedAvatar,   setResolvedAvatar]   = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* helpers */
  const reset = () => {
    setOverallRating(0); setShowDetailed(false); setDetailedRatings({});
    setFeeling(''); setReview(''); setPhotos([]); setPhotoPreviews([]);
    setVisitDate(''); setCompanion(''); setDuration('');
    setAnonymous(false); setAllowVenueReply(true);
    setPhotoBase64s([]);
    setResolvedName(''); setResolvedAvatar('');
    setSubmitting(false); setSubmitError('');
  };

  const handleDismiss = () => { reset(); onDidDismiss(); };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - photos.length;
    const toAdd = files.slice(0, remaining);
    setPhotos(prev => [...prev, ...toAdd]);
    toAdd.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        // Compress via Canvas to keep Firestore doc size manageable (max ~150KB per photo)
        const img = new Image();
        img.onload = () => {
          const MAX = 800;
          let { width, height } = img;
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
          if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.75);
          setPhotoPreviews(prev => [...prev, compressed]);
          setPhotoBase64s(prev => [...prev, compressed]);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    setPhotoBase64s(prev => prev.filter((_, i) => i !== index));
  };

  /* ── Firestore submit ──────────────────────────────────────────────────────
   *
   * KEY FIX: We use the userId as the Firestore document ID under the reviews
   * subcollection (doc path: destinations/{destId}/reviews/{userId}).
   *
   * This means:
   *   - Each user can have exactly ONE review per destination (no duplicates).
   *   - Subsequent submits UPDATE the existing doc, not create a new one.
   *   - The destination-level aggregate (rating + reviewCount) only increments
   *     when it is a BRAND NEW review; edits recalculate the running average
   *     by subtracting the old rating before adding the new one.
   *
   * ──────────────────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!overallRating || submitting) return;

    if (!userId) {
      setSubmitError('You must be logged in to submit a review.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    // ── Resolve the current user's display name & avatar from their Firestore profile ──
    // This ensures we always store the latest name/photo, even for email/password users
    // who don't have displayName / photoURL set on their Auth object.
    let authorName   = userName   || '';
    let authorAvatar = userAvatar || '';
    if (userId && !anonymous) {
      try {
        const profile = await getUserProfile(userId);
        if (profile) {
          const fn   = profile.name?.firstname || '';
          const sn   = profile.name?.surname   || '';
          const full = [fn, sn].filter(Boolean).join(' ') || profile.nickname || '';
          if (full)          authorName   = full;
          if (profile.img)   authorAvatar = profile.img;
        }
      } catch { /* fall back to Auth displayName/photoURL */ }
    }
    setResolvedName(authorName);
    setResolvedAvatar(authorAvatar);

    try {
      const destRef   = doc(firestore, 'destinations', destinationId);
      // Use userId as the document ID so each user can only review once
      const reviewRef = doc(firestore, 'destinations', destinationId, 'reviews', userId);

      await runTransaction(firestore, async (tx) => {
        const [destSnap, reviewSnap] = await Promise.all([
          tx.get(destRef),
          tx.get(reviewRef),
        ]);

        if (!destSnap.exists()) return;

        const destData   = destSnap.data();
        const isEdit     = reviewSnap.exists();          // user is updating their own review
        const oldRating  = isEdit ? (reviewSnap.data().overallRating as number) || 0 : 0;

        let prevCount  = (destData.reviewCount as number) || 0;
        let prevRating = (destData.rating      as number) || 0;

        let newCount: number;
        let newRating: number;

        if (isEdit) {
          // Replace the old rating in the running average — count stays the same
          newCount  = prevCount; // no change
          newRating = prevCount > 1
            ? parseFloat(
                ((prevRating * prevCount - oldRating + overallRating) / prevCount).toFixed(1)
              )
            : overallRating; // only reviewer, just use new value
        } else {
          // Brand-new review from this user — increment count
          newCount  = prevCount + 1;
          newRating = parseFloat(
            ((prevRating * prevCount + overallRating) / newCount).toFixed(1)
          );
        }

        // Write / overwrite the review document keyed by userId
        tx.set(reviewRef, {
          userId,
          authorName:     anonymous ? '' : authorName,
          authorAvatar:   anonymous ? '' : authorAvatar,
          overallRating,
          detailedRatings,
          feeling,
          review,
          visitDate,
          companion,
          duration,
          anonymous,
          allowVenueReply,
          // Store compressed base64 photos directly in the review doc
          // Each photo is compressed to ~100-150 KB; max 5 photos ≈ 750 KB (under 1 MB Firestore limit)
          photoBase64s: photoBase64s,
          updatedAt: serverTimestamp(),
          // Only set createdAt on first write (set() overwrites, so we preserve it via merge below)
          ...(!isEdit ? { createdAt: serverTimestamp() } : {}),
        }, { merge: true }); // merge:true preserves createdAt on edits

        // ── Pointer doc: users/{userId}/reviews/{destId} ──────────────────
        // Lets MyReviews fetch by direct path (no collectionGroup index needed).
        const userReviewPointerRef = doc(
          firestore, 'users', userId, 'reviews', destinationId
        );
        tx.set(userReviewPointerRef, {
          destId:    destinationId,
          destName:  destinationName,
          updatedAt: serverTimestamp(),
          ...(!isEdit ? { createdAt: serverTimestamp() } : {}),
        }, { merge: true });

        // Update destination aggregate
        tx.update(destRef, {
          reviewCount: newCount,
          rating:      newRating,
        });
      });

      // Notify parent & close
      onSubmit?.({
        overallRating, detailedRatings, feeling, review,
        photos, visitDate, companion, duration, anonymous, allowVenueReply,
        photoBase64s,
        resolvedName:   authorName,
        resolvedAvatar: authorAvatar,
      } as any);
      handleDismiss();

    } catch (err: any) {
      console.error('Failed to submit review:', err);
      setSubmitError('Failed to submit. Please try again.');
      setSubmitting(false);
    }
  };

  const isShort = review.length < 50 && review.length > 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
      {/* ── Header ── */}
      <IonHeader>
        <IonToolbar className="wrm-toolbar">
          <IonButtons slot="start">
            <IonButton className="dd-icon-btn" onClick={handleDismiss}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle className="wrm-modal-title">Write a Review</IonTitle>
          <IonButtons slot="end">
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="wrm-content">
        <div className="wrm-body">

          {/* ── Destination Info ── */}
          <div className="wrm-dest-info">
            {destinationThumbnail ? (
              <img src={destinationThumbnail} alt={destinationName} className="wrm-dest-thumb" />
            ) : (
              <div className="wrm-dest-thumb wrm-dest-thumb--placeholder">🗺️</div>
            )}
            <div className="wrm-dest-text">
              <p className="wrm-dest-name">{destinationName}</p>
              <div className="wrm-dest-meta">
                {destinationCity && (
                  <span className="wrm-dest-meta-item">
                    <IonIcon icon={locationOutline} className="wrm-dest-meta-icon" />
                    {destinationCity}
                  </span>
                )}
                {destinationRank && (
                  <span className="wrm-dest-rank">#{destinationRank} Most Visited</span>
                )}
              </div>
              {destinationDuration && (
                <span className="wrm-dest-duration">
                  <IonIcon icon={timeOutline} />
                  {destinationDuration}
                </span>
              )}
            </div>
          </div>

          <div className="wrm-divider" />

          {/* ── Reviewer Identity Preview ── */}
          {userId && (
            <div className="wrm-reviewer-preview">
              <div className="wrm-reviewer-preview-avatar">
                {anonymous ? (
                  <span className="wrm-reviewer-preview-anon">?</span>
                ) : resolvedAvatar || userAvatar ? (
                  <img src={resolvedAvatar || userAvatar} alt="You" />
                ) : (
                  <span>
                    {(resolvedName || userName || 'U')[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="wrm-reviewer-preview-info">
                <span className="wrm-reviewer-preview-label">Posting as</span>
                <span className="wrm-reviewer-preview-name">
                  {anonymous ? 'Anonymous' : (resolvedName || userName || 'Traveller')}
                </span>
              </div>
            </div>
          )}

          <div className="wrm-divider" />
          <div className="wrm-section">
            <div className="wrm-rating-center">
              <StarPicker value={overallRating} onChange={setOverallRating} />
              <p className="wrm-tap-hint">Tap to rate your overall experience</p>
            </div>

            <button
              type="button"
              className="wrm-detailed-toggle"
              onClick={() => setShowDetailed(v => !v)}
            >
              <IonIcon icon={showDetailed ? chevronUp : chevronDown} />
              {showDetailed ? 'Hide' : 'Add'} detailed ratings
            </button>

            {showDetailed && (
              <div className="wrm-detailed-grid">
                {DETAILED_CATEGORIES.map(({ key, label }) => (
                  <div key={key} className="wrm-detailed-row">
                    <span className="wrm-detailed-label">{label}</span>
                    <StarPicker
                      value={detailedRatings[key] || 0}
                      onChange={v => setDetailedRatings(prev => ({ ...prev, [key]: v }))}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="wrm-divider" />

          {/* ── Review Title ── */}
          <div className="wrm-section">
            <label className="wrm-field-label">Your Feel</label>
            <div className="wrm-input-wrap">
              <input
                className="wrm-input"
                placeholder="Summarize your experience..."
                maxLength={100}
                value={feeling}
                onChange={e => setFeeling(e.target.value)}
              />
              <span className="wrm-char-count">{feeling.length}/100</span>
            </div>
          </div>

          {/* ── Review Body ── */}
          <div className="wrm-section">
            <label className="wrm-field-label">Your Review</label>
            <div className="wrm-input-wrap">
              <textarea
                className="wrm-textarea"
                placeholder="What did you like or dislike? Share details about your visit..."
                maxLength={1000}
                rows={5}
                value={review}
                onChange={e => setReview(e.target.value)}
              />
              <span className="wrm-char-count">{review.length}/1000</span>
            </div>

            {isShort && (
              <div className="wrm-short-hint">
                <IonIcon icon={locationOutline} className="wrm-short-hint-icon" />
                <p>Your review is quite short. Consider adding what stood out during your visit and whether you'd recommend this to others.</p>
              </div>
            )}
          </div>

          <div className="wrm-divider" />

          {/* ── Photos ── */}
          <div className="wrm-section">
            <p className="wrm-section-label">Add Photos</p>
            <div className="wrm-photo-row">
              {photos.length < 5 && (
                <button
                  type="button"
                  className="wrm-photo-add"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="wrm-photo-add-icon">📷</span>
                  <span className="wrm-photo-add-label">Add Photo</span>
                </button>
              )}
              {photoPreviews.map((src, i) => (
                <div key={i} className="wrm-photo-preview">
                  <img src={src} alt={`Preview ${i + 1}`} />
                  <button type="button" className="wrm-photo-remove" onClick={() => removePhoto(i)}>×</button>
                </div>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handlePhotoAdd}
              />
            </div>
            <p className="wrm-photo-hint">Max 5 photos</p>
          </div>

          <div className="wrm-divider" />

          {/* ── Visit Details ── */}
          <div className="wrm-section">
            <p className="wrm-section-label">Visit Details <span className="wrm-optional">(Optional)</span></p>

            <div className="wrm-field-group">
              <label className="wrm-field-label">When did you visit?</label>
              <div className="wrm-date-wrap">
                <input
                  type="date"
                  className="wrm-date-input"
                  placeholder="Select date"
                  value={visitDate}
                  onChange={e => setVisitDate(e.target.value)}
                />
                <span className="wrm-date-icon">📅</span>
              </div>
            </div>

            <div className="wrm-field-group">
              <label className="wrm-field-label">Who did you go with?</label>
              <div className="wrm-chip-grid wrm-chip-grid--2col">
                {COMPANION_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`wrm-chip ${companion === opt ? 'wrm-chip--active' : ''}`}
                    onClick={() => setCompanion(prev => prev === opt ? '' : opt)}
                  >
                    <span className="wrm-chip-icon">
                      {opt === 'Solo' ? '👤' : opt === 'Couple' ? '👫' : opt === 'Family' ? '👨‍👩‍👧' : '👥'}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="wrm-field-group">
              <label className="wrm-field-label">How long did you stay?</label>
              <div className="wrm-chip-grid wrm-chip-grid--1col">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`wrm-chip ${duration === opt ? 'wrm-chip--active' : ''}`}
                    onClick={() => setDuration(prev => prev === opt ? '' : opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="wrm-divider" />

          {/* ── Checkboxes ── */}
          <div className="wrm-section">
            <label className="wrm-checkbox-row">
              <input
                type="checkbox"
                className="wrm-checkbox"
                checked={anonymous}
                onChange={e => setAnonymous(e.target.checked)}
              />
              <span className={`wrm-checkbox-custom ${anonymous ? 'wrm-checkbox-custom--checked' : ''}`} />
              <div className="wrm-checkbox-text">
                <span className="wrm-checkbox-label">Submit anonymously</span>
                <span className="wrm-checkbox-sub">Your name won't be visible</span>
              </div>
            </label>

            <label className="wrm-checkbox-row">
              <input
                type="checkbox"
                className="wrm-checkbox"
                checked={allowVenueReply}
                onChange={e => setAllowVenueReply(e.target.checked)}
              />
              <span className={`wrm-checkbox-custom ${allowVenueReply ? 'wrm-checkbox-custom--checked' : ''}`} />
              <div className="wrm-checkbox-text">
                <span className="wrm-checkbox-label">Allow responses from venue</span>
                <span className="wrm-checkbox-sub">Venue can reply to your review</span>
              </div>
            </label>
          </div>

          {/* ── Guidelines ── */}
          <div className="wrm-guidelines">
            <div className="wrm-guidelines-header">
              <span className="wrm-guidelines-icon">🛡️</span>
              <span className="wrm-guidelines-title">Review Guidelines</span>
            </div>
            <ul className="wrm-guidelines-list">
              {REVIEW_GUIDELINES.map(g => (
                <li key={g}>• {g}</li>
              ))}
            </ul>
          </div>

          {/* ── Error message ── */}
          {submitError && (
            <p style={{ color: '#ef4444', textAlign: 'center', fontSize: 13, margin: '8px 16px 0' }}>
              {submitError}
            </p>
          )}

          {/* ── Submit ── */}
          <div className="wrm-submit-area">
            <button
              type="button"
              className={`wrm-submit-btn ${(!overallRating || submitting) ? 'wrm-submit-btn--disabled' : ''}`}
              onClick={handleSubmit}
              disabled={!overallRating || submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
            <button type="button" className="wrm-cancel-btn" onClick={handleDismiss}>
              Cancel
            </button>
          </div>

        </div>
      </IonContent>
    </IonModal>
  );
};

export default WriteReviewModal;