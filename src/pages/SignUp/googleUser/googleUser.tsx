import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent, IonPage, IonHeader, IonToolbar, IonButtons,
  IonBackButton, IonButton, IonInput, IonItem, IonLabel,
  IonIcon, IonLoading, IonAlert, IonAvatar, IonSelect, IonSelectOption,
} from '@ionic/react';
import { cameraOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebase";
import { useSignup } from '../../../context/SignupContext';
import { useAuth } from '../../../context/AuthContext';
import { createUserProfile } from '../../../services/userProfileService';
import '../signup.css';

const GoogleUserProfile: React.FC = () => {
  const history = useHistory();
  const { signupData, updateSignupData, resetSignupData } = useSignup();
  const { user: authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for form fields (pre-filled from context)
  const [firstName, setFirstName] = useState(signupData.firstName ?? '');
  const [surname, setSurname] = useState(signupData.surname ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(signupData.dateOfBirth || '');
  const [username, setUsername] = useState(signupData.username || signupData.firstName || '');
  const [nationality, setNationality] = useState(signupData.nationality || '');
  const [acceptedTerms, setAcceptedTerms] = useState(signupData.acceptedTerms ?? false);
  const [profilePic, setProfilePic] = useState<string | null>(signupData.profilePic);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ header: string; message: string; show: boolean }>({
    header: '',
    message: '',
    show: false,
  });

  const isGoogleUser = signupData.isGoogleUser;

  // Redirect if not coming from proper signup flow
  useEffect(() => {
    if (!isGoogleUser && !signupData.email) {
      history.push('/login');
    }
  }, [isGoogleUser, signupData.email, history]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setProfilePic(result);
      updateSignupData({ profilePic: result });
    };
    reader.readAsDataURL(file);
  };

  const handleSignUp = async () => {
    // Required fields validation
    const required = [
      { field: firstName.trim(), name: 'First Name' },
      { field: surname.trim(), name: 'Surname' },
      { field: dateOfBirth.trim(), name: 'Date of Birth' },
      { field: nationality, name: 'Nationality' },
    ];
    const missing = required.find(item => !item.field);
    if (missing) {
      setAlert({ header: '', message: `Please enter your ${missing.name}`, show: true });
      return;
    }
    if (!acceptedTerms) {
      setAlert({ header: '', message: 'Please accept the terms and conditions', show: true });
      return;
    }

    setLoading(true);
    try {
      let userId = signupData.uid;

      if (!isGoogleUser) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          signupData.email,
          signupData.password
        );
        userId = userCredential.user.uid;
      } else if (!userId && authUser) {
        userId = authUser.uid;
      }

      if (!userId) throw new Error('Unable to get user ID');

      const userData = {
        name: {
          firstname: firstName,
          surname: surname,
          suffix: signupData.suffix || '',
        },
        email: signupData.email,
        dateOfBirth,
        nationality,
        nickname: username,
        img: profilePic,
        isGoogleUser,
        isFullyRegistered: true,
        createdAt: new Date().toISOString(),
      };

      await createUserProfile(userId, userData as any);
      resetSignupData();
      history.push('/home');
    } catch (error: any) {
      const message =
        error.code === 'auth/email-already-in-use'
          ? 'Email already in use. Please use a different email.'
          : error.code === 'auth/weak-password'
          ? 'Password is too weak. Please use a stronger password.'
          : error.message || 'An error occurred during profile setup';
      setAlert({ header: 'Profile Setup Failed', message, show: true });
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = isGoogleUser ? 'Complete Your Profile' : 'Create Profile';
  const pageSubtitle = isGoogleUser ? 'Finish setting up your account with Google' : 'Create your profile';

  return (
    <IonPage>
      <IonContent className="login-content" fullscreen>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={isGoogleUser ? "/login" : "/signUp1"} />
          </IonButtons>
        </IonToolbar>

        <div className="logo-wrap">
          <img src="/assets/images/Pasig Logo.png" alt="Pasig Logo" className="logo" />
        </div>
        <h2 className="title">Tourism AI</h2>
        <p className="subtitle">DISCOVER THE PASIG WITH AI GUIDANCE!</p>

        <div className="signup-progress">
          <div className="progress-line active"></div>
          <div className="progress-step active">
            <span className="step-label">{pageTitle}</span>
          </div>
        </div>

        <div className="login-card">
          <div className="form">
            <p className="formSubtitle">{pageSubtitle}</p>

            {/* Photo Upload */}
            <div className="photo-upload">
              <div className="photo-container">
                <IonAvatar className={`profile-avatar ${profilePic ? 'has-photo' : 'no-photo'}`}>
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" />
                  ) : (
                    <div className="placeholder">
                      <IonIcon icon={cameraOutline} className="placeholder-icon" />
                      <span>Add Photo</span>
                    </div>
                  )}
                </IonAvatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <IonButton
                  fill="clear"
                  className="camera-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <IonIcon icon={profilePic ? checkmarkCircleOutline : cameraOutline} />
                </IonButton>
              </div>
              <p className="photo-hint">
                {profilePic ? 'Tap to change photo' : 'Tap the camera icon to upload a profile picture'}
              </p>
            </div>

            {/* Google pre-filled fields (editable) */}
            <IonLabel position="stacked" className="signup-3-label">First Name {isGoogleUser}</IonLabel>
            <IonItem className="input-item">
              <IonInput
                placeholder="Enter your first name"
                value={firstName}
                onIonChange={(e) => setFirstName(e.detail.value!)}
                className="text-input"
              />
            </IonItem>

            <IonLabel position="stacked" className="signup-3-label">Surname {isGoogleUser}</IonLabel>
            <IonItem className="input-item">
              <IonInput
                placeholder="Enter your surname"
                value={surname}
                onIonChange={(e) => setSurname(e.detail.value!)}
                className="text-input"
              />
            </IonItem>

            <IonLabel position="stacked" className="signup-3-label">Date of Birth {isGoogleUser}</IonLabel>
            <IonItem className="input-item">
              <IonInput
                placeholder="YYYY-MM-DD"
                type="date"
                value={dateOfBirth}
                onIonChange={(e) => setDateOfBirth(e.detail.value!)}
                className="text-input"
              />
            </IonItem>

            <IonLabel position="stacked" className="signup-3-label">Username</IonLabel>
            <IonItem className="input-item">
              <IonInput
                placeholder="Enter your username"
                value={username}
                onIonChange={(e) => setUsername(e.detail.value!)}
                className="text-input"
              />
            </IonItem>

            {/* Required fields */}

            {/* Nationality select */}
            <IonLabel position="stacked" className="signup-3-label">Nationality *</IonLabel>
            <IonItem className="input-item">
              <IonSelect
                placeholder="Select your Nationality"
                value={nationality || ''}
                onIonChange={e => setNationality(e.detail.value ?? '')}
              >
                <IonSelectOption value="filipino">Filipino</IonSelectOption>
                <IonSelectOption value="american">American</IonSelectOption>
                <IonSelectOption value="japanese">Japanese</IonSelectOption>
                <IonSelectOption value="korean">Korean</IonSelectOption>
                <IonSelectOption value="chinese">Chinese</IonSelectOption>
                <IonSelectOption value="other">Other</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Terms */}
            <div className="terms-container">
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="terms-checkbox"
                />
                <label htmlFor="terms" className="terms-label">
                  I agree to the <a href="#" className="terms-link">Terms and Conditions</a> and <a href="#" className="terms-link">Privacy Policy</a>
                </label>
              </div>
              {!acceptedTerms && <p className="terms-error">Please accept the terms to continue</p>}
            </div>

            <IonButton
              expand="block"
              className="login-button"
              onClick={handleSignUp}
              disabled={loading}
            >
              {isGoogleUser ? 'Complete Profile' : 'Sign Up'}
            </IonButton>
          </div>
        </div>

        <IonLoading isOpen={loading} message={isGoogleUser ? 'Completing your profile...' : 'Signing up...'} />
        <IonAlert
          isOpen={alert.show}
          onDidDismiss={() => setAlert(prev => ({ ...prev, show: false }))}
          header={alert.header}
          message={alert.message}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default GoogleUserProfile;