import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonIcon,
  IonButton,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonRouterLink,
  IonSpinner,
} from '@ionic/react';
import {
  arrowBackOutline,
  listOutline,
  checkmarkCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import './GenerateQR.css';

// Build a fresh session payload each time
const buildSessionPayload = () =>
  encodeURIComponent(
    JSON.stringify({
      sessionId: 'TOUR-2024-001',
      guideId: 'G-101',
      guideName: 'Tour Guide',
      timestamp: Date.now(),
    })
  );

// Free QR Server API — no npm package needed
const buildQRUrl = (data: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${data}&color=1a1a2e&bgcolor=ffffff&ecc=H&margin=10`;

const GenerateQR: React.FC = () => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [expiresIn, setExpiresIn] = useState(300); // 5-minute countdown

  const generateQR = () => {
    setIsLoading(true);
    const url = buildQRUrl(buildSessionPayload());
    setQrUrl(url);
    setExpiresIn(300);
    // Allow the img time to load from the API
    setTimeout(() => setIsLoading(false), 800);
  };

  // Generate on mount
  useEffect(() => {
    generateQR();
  }, []);

  // Countdown timer — restarts whenever expiresIn resets to 300
  useEffect(() => {
    if (expiresIn <= 0) return;
    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresIn]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isExpired = expiresIn === 0;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="generate-header">
          <IonRouterLink routerLink="/home" className="gen-back-button">
            <IonIcon icon={arrowBackOutline} />
          </IonRouterLink>
          <IonTitle className="generate-title">GENERATE QR</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="generate-content">
        <div className="generate-wrapper">

          {/* Instruction */}
          <div className="gen-instruction">
            <p>Share this QR code with your tourists.</p>
            <p>Once they scan it, their info will appear in the list.</p>
          </div>

          {/* QR Card */}
          <div className={`qr-card ${isExpired ? 'expired' : ''}`}>
            <div className="qr-card-inner">
              {isLoading ? (
                <div className="qr-loading">
                  <IonSpinner name="crescent" />
                  <p>Generating QR...</p>
                </div>
              ) : isExpired ? (
                <div className="qr-expired-overlay">
                  <IonIcon icon={timeOutline} />
                  <p>QR Expired</p>
                  <span>Tap refresh to generate a new one</span>
                </div>
              ) : (
                <img
                  src={qrUrl}
                  alt="Session QR Code"
                  className="qr-image"
                />
              )}
            </div>

            {/* Timer */}
            {!isLoading && (
              <div
                className={`qr-timer ${expiresIn <= 30 ? 'warning' : ''} ${
                  isExpired ? 'expired-timer' : ''
                }`}
              >
                <IonIcon icon={timeOutline} />
                <span>
                  {isExpired
                    ? 'Expired'
                    : `Expires in ${formatTime(expiresIn)}`}
                </span>
              </div>
            )}
          </div>

          {/* Session ID badge */}
          {!isLoading && (
            <div className="session-badge">
              <IonIcon icon={checkmarkCircleOutline} />
              <span>Session ID: TOUR-2024-001</span>
            </div>
          )}

          {/* View List button */}
          <IonButton
            expand="block"
            className="view-list-btn"
            routerLink="/tourist-list"
          >
            <IonIcon icon={listOutline} slot="start" />
            View Tourist List
          </IonButton>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default GenerateQR;