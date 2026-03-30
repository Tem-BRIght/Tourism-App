import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  IonContent, IonPage, IonHeader, IonToolbar, 
  IonButtons, IonBackButton, IonButton, IonInput, 
  IonItem, IonLabel, IonIcon, IonLoading, IonAlert,
  InputCustomEvent, InputChangeEventDetail
} from '@ionic/react';
import { mailOutline, lockClosedOutline } from 'ionicons/icons';
import { useSignup } from '../../context/SignupContext';
import './signup.css';

const SignUP2: React.FC = () => {
    const history = useHistory();
    const { signupData, updateSignupData } = useSignup();
    const [email, setEmail] = useState(signupData.email ?? '');
    const [password, setPassword] = useState(signupData.password ?? '');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');

    const handleNext = () => {
      if (!email.trim() || !password || !confirmPassword) {
        setAlertMessage('Please fill in all fields');
        setShowAlert(true);
        return;
      }

      if (password !== confirmPassword) {
        setAlertMessage('Passwords do not match');
        setShowAlert(true);
        return;
      }

      if (password.length < 6) {
        setAlertMessage('Password must be at least 6 characters');
        setShowAlert(true);
        return;
      }

      updateSignupData({
        email: email,
        password: password,
      });
      history.push('/signup3');
    };


  return (
    <IonPage>
      <IonContent className="login-content" fullscreen>
         
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/login" />
            </IonButtons>
          </IonToolbar>

        <div className="logo-wrap">
          <img src="/assets/images/Pasig Logo.png" alt="Pasig Logo" className="logo" />
        </div>
        <h2 className="title">Tourism AI</h2>
        <p className="subtitle">DISCOVER THE PASIG WITH AI GUIDANCE!</p>
        
        {/* Progress Indicator */}
          <div className="signup-progress">
            <div className="progress-step completed">
              <span className="step-number">1</span>
              <span className="step-label">Personal Info</span>
            </div>
            <div className="progress-line active"></div>
            <div className="progress-step active">
              <span className="step-number">2</span>
              <span className="step-label">Account</span>
            </div>
            <div className="progress-line not"></div>
            <div className="progress-step not">
              <span className="step-number">3</span>
              <span className="step-label">Profile</span>
            </div>
          </div>

        <div className="login-card"> 
          <div className="form">
            <p className="formSubtitle">Create Account</p>
            
            <IonLabel position="stacked">Email</IonLabel>
            <IonItem className="input-item">
              <IonIcon icon={mailOutline} slot="start" className="input-icon" />
              <IonInput 
                placeholder="Enter your email" 
                type="email" 
                className="text-input"
                value={email}
                onIonChange={(e: InputCustomEvent<InputChangeEventDetail>) => setEmail(e.detail.value!)}
              />
            </IonItem>

            <IonLabel position="stacked">Password</IonLabel>
            <IonItem className="input-item">
              <IonIcon icon={lockClosedOutline} slot="start" className="input-icon" />
              <IonInput 
                placeholder="Enter your password" 
                type="password" 
                className="text-input"
                value={password}
                onIonChange={(e: InputCustomEvent<InputChangeEventDetail>) => setPassword(e.detail.value!)}
              />
            </IonItem>

            <IonLabel position="stacked">Confirm Password</IonLabel>
            <IonItem className="input-item">
              <IonIcon icon={lockClosedOutline} slot="start" className="input-icon" />
              <IonInput 
                placeholder="Confirm your password" 
                type="password" 
                className="text-input"
                value={confirmPassword}
                onIonChange={(e: InputCustomEvent<InputChangeEventDetail>) => setConfirmPassword(e.detail.value!)}
              />
            </IonItem>

            <IonButton 
              expand="block" 
              className="login-button"
              onClick={handleNext}
            >
              Next
            </IonButton>
          </div>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          message={alertMessage}
          buttons={['OK']}
        />

      </IonContent>
    </IonPage>
  );
};

export default SignUP2;