import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  IonContent, IonPage, IonHeader, IonToolbar, 
  IonButtons, IonBackButton, IonButton, IonInput, 
  IonItem, IonLabel, IonIcon, IonLoading, IonAlert,
  InputCustomEvent, InputChangeEventDetail, IonAvatar, 
  IonSelect, IonSelectOption,
  } from '@ionic/react';
import { cameraOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useSignup } from '../../context/SignupContext';
import { createUserProfile, uploadProfilePicture } from '../../services/userProfileService';
import './signup.css';

const SignUP3: React.FC = () => {
    const history = useHistory();
    const { signupData, updateSignupData, resetSignupData } = useSignup();
    const [username, setUsername] = useState(signupData.username ?? '');
    const [dateOfBirth, setDateOfBirth] = useState(signupData.dateOfBirth ?? '');
    const [nationality, setNationality] = useState(signupData.nationality ?? '');
    const [acceptedTerms, setAcceptedTerms] = useState(signupData.acceptedTerms ?? false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [profilePic, setProfilePic] = useState<string | null>(signupData.profilePic);
    const [loading, setLoading] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [alertHeader, setAlertHeader] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setProfilePic(result);
          updateSignupData({ profilePic: result });
        };
        reader.readAsDataURL(file);
      }
    };

    const handleSignUp = async () => {
      // Validation
      if (!username.trim() || !dateOfBirth.trim() || !nationality) {
        setAlertMessage('Please fill in all fields');
        setShowAlert(true);
        return;
      }

      if (!acceptedTerms) {
        setAlertMessage('Please accept the terms and conditions');
        setShowAlert(true);
        return;
      }

      setLoading(true);
      try {
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          signupData.email,
          signupData.password
        );

        // Create user profile in Firestore using nested name and new field names
        const userData = {
          name: {
            firstname: signupData.firstName,
            surname: signupData.surname,
            suffix: signupData.suffix,
          },
          email: signupData.email,
          dateOfBirth: dateOfBirth,
          nationality: nationality,
          nickname: username,
          img: profilePic,
        };

        await createUserProfile(userCredential.user.uid, userData as any);

        // Reset signup context
        resetSignupData();

        // Redirect to home
        history.push('/home');
      } catch (error: any) {
        setLoading(false);
        setAlertHeader('Sign Up Failed');

        if (error.code === 'auth/email-already-in-use') {
          setAlertMessage('Email already in use. Please use a different email.');
        } else if (error.code === 'auth/weak-password') {
          setAlertMessage('Password is too weak. Please use a stronger password.');
        } else {
          setAlertMessage(error.message || 'An error occurred during sign up');
        }
        setShowAlert(true);
      }
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
            <div className="progress-line completed"></div>
            <div className="progress-step completed">
              <span className="step-number">2</span>
              <span className="step-label">Account</span>
            </div>
            <div className="progress-line active"></div>
            <div className="progress-step active">
              <span className="step-number">3</span>
              <span className="step-label">Profile</span>
            </div>
          </div>

        <div className="login-card"> 
          <div className="form">
            <p className="formSubtitle">Create Profile</p>
            
            {/* Photo Upload Section */}
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

            <IonLabel position="stacked" className="signup-3-label">Username</IonLabel>
            <IonItem className="input-item">
              <IonInput
                placeholder="Enter your username"
                value={username}
                onIonChange={(e) => setUsername(e.detail.value!)}
                className="text-input"
              />
            </IonItem>

            <IonLabel position="stacked" className="signup-3-label">Date of Birth</IonLabel>
            <IonItem className="input-item">
              <IonInput
                placeholder="YYYY-MM-DD"
                type="date"
                value={dateOfBirth}
                onIonChange={(e) => setDateOfBirth(e.detail.value!)}
                className="text-input"
              />
            </IonItem>

            <IonLabel position="stacked" className="signup-3-label">Nationality</IonLabel>
            <IonItem className="input-item">
              <IonSelect
                placeholder="Select your Nationality"
                value={nationality || ''}
                onIonChange={(e) => setNationality(e.detail.value ?? '')}
                className="text-input"
              >
                <IonSelectOption value="filipino">Filipino</IonSelectOption>
                <IonSelectOption value="american">American</IonSelectOption>
                <IonSelectOption value="japanese">Japanese</IonSelectOption>
                <IonSelectOption value="korean">Korean</IonSelectOption>
                <IonSelectOption value="chinese">Chinese</IonSelectOption>
                <IonSelectOption value="other">Other</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Terms and Conditions */}
            <div className="terms-container">
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="terms-checkbox"
                />
                <label htmlFor="terms" className="terms-label"> I agree to the <a href="#" className="terms-link">Terms and Conditions</a> and <a href="#" className="terms-link">Privacy Policy</a>
                </label>
              </div>
              {!acceptedTerms && (
                <p className="terms-error">Please accept the terms to continue</p>
              )}
            </div>

            <IonButton 
              expand="block" 
              className="login-button"
              onClick={handleSignUp}
              disabled={loading}
            >
              Sign Up
            </IonButton>
          </div>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeader}
          message={alertMessage}
          buttons={['OK']}
        />

      </IonContent>
    </IonPage>
  );
};

export default SignUP3;