import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonRouterLink,
  IonIcon,
  IonButton,
  IonSpinner,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  arrowBackOutline,
  starOutline,
  timeOutline,
  listOutline,
  chatbubbleEllipsesOutline,
} from 'ionicons/icons';
import './FeedbackQR.css';

// Feedback link tourists land on after scanning
// In a real app this would be a dynamic URL tied to the session ID
const FEEDBACK_URL = 'https://forms.google.com/tourguide-feedback';

const buildQRUrl = (data: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(data)}&color=0d2f6e&bgcolor=ffffff&ecc=H&margin=10`;

const FeedbackQR: React.FC = () => {
  const history = useHistory();
  const [qrUrl, setQrUrl]       = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expiresIn, setExpiresIn] = useState(600); // 10-minute window

  useEffect(() => {
    const url = buildQRUrl(FEEDBACK_URL);
    setQrUrl(url);
    setTimeout(() => setIsLoading(false), 800);
  }, []);

  // Countdown
  useEffect(() => {
    if (expiresIn <= 0) return;
    const interval = setInterval(() => {
      setExpiresIn(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresIn]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isExpired = expiresIn === 0;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="fqr-header">
          <IonRouterLink routerLink="/tourist-list" className="fqr-back-btn">
            <IonIcon icon={arrowBackOutline} />
          </IonRouterLink>
          <IonTitle className="fqr-title">FEEDBACK QR</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="fqr-content">
        <div className="fqr-wrapper">

          {/* Hero label */}
          <div className="fqr-hero">
            <h2>Tour Completed!</h2>
            <p>Let your tourists share their experience. Ask them to scan this QR to leave a review.</p>
          </div>

          {/* QR Card */}
          <div className={`fqr-card ${isExpired ? 'fqr-expired' : ''}`}>
            <div className="fqr-card-inner">
              {isLoading ? (
                <div className="fqr-loading">
                  <IonSpinner name="crescent" />
                  <p>Generating QR...</p>
                </div>
              ) : isExpired ? (
                <div className="fqr-expired-overlay">
                  <IonIcon icon={timeOutline} />
                  <p>QR Expired</p>
                  <span>The feedback window has closed.</span>
                </div>
              ) : (
                <img src={qrUrl} alt="Feedback QR Code" className="fqr-image" />
              )}
            </div>

            {/* Timer */}
            {!isLoading && (
              <div className={`fqr-timer ${expiresIn <= 60 ? 'fqr-timer--warning' : ''} ${isExpired ? 'fqr-timer--expired' : ''}`}>
                <IonIcon icon={timeOutline} />
                <span>{isExpired ? 'Expired' : `Available for ${formatTime(expiresIn)}`}</span>
              </div>
            )}
          </div>

          {/* Instruction steps */}
          {!isLoading && !isExpired && (
            <div className="fqr-steps">
              <div className="fqr-step">
                <div className="fqr-step-num">1</div>
                <span>Show this QR to your tourists</span>
              </div>
              <div className="fqr-step">
                <div className="fqr-step-num">2</div>
                <span>They scan it with their phone camera</span>
              </div>
              <div className="fqr-step">
                <div className="fqr-step-num">3</div>
                <span>They fill out the short review form</span>
              </div>
            </div>
          )}

          {/* View Reviews */}
          <IonButton
            expand="block"
            className="fqr-home-btn"
            onClick={() => history.push('/reviews')}
          >
            <IonIcon icon={listOutline} slot="start" />
            View Reviews
          </IonButton>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default FeedbackQR;