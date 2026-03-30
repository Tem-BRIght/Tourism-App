// src/pages/Settings/Scan/Scan.tsx
// ─────────────────────────────────────────────────────────────────────────────
// QR-code scanner page.
//
// Supported QR payload formats (same logic as DestinationDetail deep-link):
//   1.  /destination/<docId>            (app deep-link)
//   2.  /destination?id=<docId>         (app deep-link with query param)
//   3.  https://<host>/destination/<id> (full URL)
//   4.  Raw Firestore doc ID            (bare string)
//
// On each successful scan → writes one visit doc to the `visits` collection:
//   { destinationTop, destinationId, scannedAt, userId? }
//
// Uses html5-qrcode for web/Capacitor browser support.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonIcon, IonToast,
} from '@ionic/react';
import { useIonRouter } from '@ionic/react';
import {
  qrCodeOutline, flashOutline, flashOffOutline,
  imageOutline, checkmarkCircle, alertCircleOutline,
  refreshOutline,
} from 'ionicons/icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// Firebase
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, addDoc, doc, getDoc, Firestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { notifyVisitRecorded } from '../../../services/notificationsService';

import './Scan.css';

// ── Firebase config (same project as destinations_page.ts) ────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyDS9QJtZBmMBbBZb6Sowxvc-PYEtlHe3LU',
  authDomain: 'seeways-be14b.firebaseapp.com',
  databaseURL: 'https://seeways-be14b-default-rtdb.firebaseio.com',
  projectId: 'seeways-be14b',
  storageBucket: 'seeways-be14b.firebasestorage.app',
  messagingSenderId: '53598789861',
  appId: '1:53598789861:web:bcae5bc7423a56de49b40c',
  measurementId: 'G-KZT8FJM8LD',
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db: Firestore = getFirestore(firebaseApp);
const auth          = getAuth(firebaseApp);

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Given any supported QR payload string, extract the Firestore destination id.
 * Returns null if the payload does not reference a destination.
 */
function extractDestinationId(raw: string): string | null {
  const trimmed = raw.trim();

  // Bare Firestore doc ID (20 alphanumeric chars)
  if (/^[A-Za-z0-9]{20}$/.test(trimmed)) return trimmed;

  try {
    const url      = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy${trimmed}`);
    const pathname = url.pathname;

    // /destination/<id>
    const match = pathname.match(/\/destination\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];

    // /destination?id=<id>
    const qid = url.searchParams.get('id');
    if (pathname.includes('/destination') && qid) return qid;
  } catch { /* Not a URL */ }

  return null;
}

/**
 * Fetch the destination title from Firestore and record one visit in the
 * `visits` collection.  Resolves to the destination title (or the raw id
 * if the doc cannot be read) so the caller can display a friendly message.
 */
async function recordVisit(destId: string): Promise<string> {
  let destinationTop = destId; // fallback label

  try {
    const snap = await getDoc(doc(db, 'destinations', destId));
    if (snap.exists()) {
      const data = snap.data() as any;
      destinationTop = data.title || data.name || destId;
    }
  } catch (err) {
    console.warn('[Scan] could not fetch destination title:', err);
  }

  try {
    const userId = auth.currentUser?.uid ?? null;
    await addDoc(collection(db, 'visits'), {
      destinationTop,   // used by loadTopRanks() in destinations_page.ts
      destinationId: destId,
      scannedAt: new Date().toISOString(),
      ...(userId ? { userId } : {}),
    });
  } catch (err) {
    console.error('[Scan] failed to record visit:', err);
  }

  return destinationTop;
}

// ─────────────────────────────────────────────────────────────────────────────
const Scan: React.FC = () => {
  const router = useIonRouter();

  const scannerRef    = useRef<Html5Qrcode | null>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);

  const [scanning,   setScanning]   = useState(false);
  const [torchOn,    setTorchOn]    = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
  const [resultMsg,  setResultMsg]  = useState('');
  const [toastMsg,   setToastMsg]   = useState('');
  const [cameraErr,  setCameraErr]  = useState('');
  const [lastScan,   setLastScan]   = useState('');  // debounce

  // ── Start camera ───────────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setCameraErr('');
    setScanResult(null);
    setResultMsg('');

    try {
      const qr = new Html5Qrcode('qr-viewfinder', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = qr;

      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => { handleScanSuccess(decodedText); },
        () => { /* scan errors are normal – ignore */ }
      );

      setScanning(true);
    } catch (err: any) {
      console.error('[Scan] camera start failed:', err);
      setCameraErr(
        err?.message?.includes('Permission')
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not start camera. Make sure no other app is using it.'
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop camera ────────────────────────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch { /* ignore */ }
    scannerRef.current = null;
    setScanning(false);
    setTorchOn(false);
  }, []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    startScanner();
    return () => { stopScanner(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle scan result ─────────────────────────────────────────────────────
  const handleScanSuccess = useCallback(async (raw: string) => {
    // Debounce — ignore repeated identical scans within 3 s
    if (raw === lastScan) return;
    setLastScan(raw);
    setTimeout(() => setLastScan(''), 3000);

    const destId = extractDestinationId(raw);

    if (destId) {
      stopScanner();
      setScanResult('success');
      setResultMsg('Scanning… recording visit');

      // Record the visit and get the destination title
      const title = await recordVisit(destId);

      // Send a personal notification to the tourist
      const userId = auth.currentUser?.uid;
      if (userId) notifyVisitRecorded(userId, title, destId);

      setResultMsg(`✓ Visit recorded for "${title}". Opening…`);

      // Short delay so user sees the success state before navigation
      setTimeout(() => router.push(`/destination/${destId}`, 'forward'), 900);
    } else {
      setScanResult('error');
      setResultMsg(`QR code not recognised as a destination:\n"${raw}"`);
      // Auto-reset after 3 s so user can try again
      setTimeout(() => {
        setScanResult(null);
        setResultMsg('');
        setLastScan('');
      }, 3000);
    }
  }, [lastScan, router, stopScanner]);

  // ── Torch toggle ──────────────────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!scannerRef.current?.isScanning) return;
    try {
      const track = (scannerRef.current as any)?.videoElement
        ?.srcObject?.getVideoTracks?.()[0];
      if (track?.applyConstraints) {
        await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
        setTorchOn(t => !t);
      } else {
        setToastMsg('Torch not supported on this device.');
      }
    } catch {
      setToastMsg('Torch not supported on this device.');
    }
  };

  // ── Image file fallback ───────────────────────────────────────────────────
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const qr = scannerRef.current ?? new Html5Qrcode('qr-viewfinder', { verbose: false });
      const result = await qr.scanFile(file, true);
      handleScanSuccess(result);
    } catch {
      setToastMsg('No QR code found in the selected image.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="scan-toolbar">
          <IonButtons slot="start"><IonBackButton defaultHref="/settings" /></IonButtons>
          <IonTitle>Scan QR Code</IonTitle>
          <IonButtons slot="end">
            <button className="scan-hdr-btn" onClick={toggleTorch} disabled={!scanning}>
              <IonIcon icon={torchOn ? flashOutline : flashOffOutline} />
            </button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="scan-content" scrollY={false}>

        {/* ── Camera viewfinder ──────────────────────────────────────────── */}
        <div className="scan-camera-wrap">
          <div id="qr-viewfinder" ref={viewfinderRef} className="scan-viewfinder" />

          {/* Overlay frame + corners */}
          <div className="scan-frame-overlay">
            <div className="scan-corner scan-corner--tl" />
            <div className="scan-corner scan-corner--tr" />
            <div className="scan-corner scan-corner--bl" />
            <div className="scan-corner scan-corner--br" />
            {scanning && !scanResult && <div className="scan-laser" />}
          </div>

          {/* Success / error overlay */}
          {scanResult === 'success' && (
            <div className="scan-result-overlay scan-result-overlay--success">
              <IonIcon icon={checkmarkCircle} className="scan-result-icon" />
              <p className="scan-result-msg">{resultMsg}</p>
            </div>
          )}
          {scanResult === 'error' && (
            <div className="scan-result-overlay scan-result-overlay--error">
              <IonIcon icon={alertCircleOutline} className="scan-result-icon" />
              <p className="scan-result-msg">{resultMsg}</p>
            </div>
          )}

          {/* Camera error */}
          {cameraErr && (
            <div className="scan-cam-error">
              <IonIcon icon={alertCircleOutline} className="scan-cam-err-icon" />
              <p>{cameraErr}</p>
              <button className="scan-retry-btn" onClick={startScanner}>
                <IonIcon icon={refreshOutline} /> Retry
              </button>
            </div>
          )}
        </div>

        {/* ── Instructions ──────────────────────────────────────────────── */}
        <div className="scan-instructions">
          <IonIcon icon={qrCodeOutline} className="scan-inst-icon" />
          <p className="scan-inst-title">Point camera at a destination QR code</p>
          <p className="scan-inst-sub">Each scan is counted as one tourist visit.</p>
        </div>

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <div className="scan-actions">
          <label className="scan-action-btn scan-action-btn--secondary">
            <IonIcon icon={imageOutline} />
            <span>Upload QR Image</span>
            <input type="file" accept="image/*" onChange={handleFileScan} style={{ display: 'none' }} />
          </label>

          {!scanning && !cameraErr && (
            <button className="scan-action-btn scan-action-btn--primary" onClick={startScanner}>
              <IonIcon icon={refreshOutline} />
              <span>Restart Camera</span>
            </button>
          )}
        </div>

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={2500}
          position="bottom"
          onDidDismiss={() => setToastMsg('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default Scan;