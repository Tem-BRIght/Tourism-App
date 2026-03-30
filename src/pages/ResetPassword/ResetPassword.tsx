// src/pages/ResetPassword/ResetPassword.tsx
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonContent, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonInput, IonItem, IonLabel, IonIcon, IonAlert, IonLoading,
} from '@ionic/react';
import { mailOutline } from 'ionicons/icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

const ResetPassword: React.FC = () => {
  const history = useHistory();
  const [email,       setEmail]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [alertMsg,    setAlertMsg]    = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [showAlert,   setShowAlert]   = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setAlertHeader('Missing Email');
      setAlertMsg('Please enter your email address.');
      setShowAlert(true);
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAlertHeader('Email Sent');
      setAlertMsg('A password reset link has been sent to your email. Check your inbox.');
      setShowAlert(true);
    } catch (err: any) {
      setAlertHeader('Error');
      setAlertMsg(
        err.code === 'auth/user-not-found'
          ? 'No account found with that email address.'
          : err.message || 'Something went wrong. Please try again.',
      );
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen style={{ '--background': '#fff' }}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/login" />
          </IonButtons>
        </IonToolbar>

        <div style={{ padding: '40px 24px 0' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
            Forgot Password?
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 32 }}>
            Enter your registered email and we'll send you a reset link.
          </p>

          <IonLabel style={{ fontSize: 14, fontWeight: 500, color: '#333', marginBottom: 6, display: 'block' }}>
            Email
          </IonLabel>
          <IonItem className="input-item" style={{ '--background': '#EEEEEE', borderRadius: 12, marginBottom: 24 }}>
            <IonIcon icon={mailOutline} slot="start" style={{ color: '#9aa4b2', fontSize: 20, marginRight: 10 }} />
            <IonInput
              type="email"
              placeholder="Enter your email"
              value={email}
              onIonChange={e => setEmail(e.detail.value!)}
            />
          </IonItem>

          <IonButton expand="block" onClick={handleReset} disabled={loading}
            style={{ '--background': '#367CFF', '--border-radius': '8px', fontWeight: 700 }}>
            Send Reset Link
          </IonButton>

          <IonButton expand="block" fill="clear" onClick={() => history.push('/login')}
            style={{ marginTop: 12, color: '#64748B' }}>
            Back to Login
          </IonButton>
        </div>

        <IonLoading isOpen={loading} message="Sending reset link…" />
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => { setShowAlert(false); if (alertHeader === 'Email Sent') history.push('/login'); }}
          header={alertHeader}
          message={alertMsg}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;