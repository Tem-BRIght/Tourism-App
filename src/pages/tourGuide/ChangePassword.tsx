import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonRouterLink,
  IonIcon,
  IonButton,
  IonAlert,
} from '@ionic/react';
import {
  arrowBackOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import './ChangePassword.css';

const ChangePassword: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = () => {
    setErrorMsg('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    // Success — handle real API call here
    setShowSuccessAlert(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const passwordStrength = () => {
    if (newPassword.length === 0) return null;
    if (newPassword.length < 6) return 'weak';
    if (newPassword.length < 10 || !/[0-9]/.test(newPassword)) return 'fair';
    return 'strong';
  };

  const strength = passwordStrength();

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="profile-header">
          <IonRouterLink routerLink="/profile" className="profile-back-btn">
            <IonIcon icon={arrowBackOutline} />
          </IonRouterLink>
          <IonTitle className="profile-header-title">Change Password</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="profile-content">
        <div className="cp-wrapper">

          {/* Icon Banner */}
          <div className="cp-banner">
            <div className="cp-banner-icon">
              <IonIcon icon={lockClosedOutline} />
            </div>
            <p>Keep your account secure by using a strong password you don't use elsewhere.</p>
          </div>

          {/* Current Password */}
          <div className="cp-section">
            <p className="section-label">Current Password</p>
            <div className="edit-field">
              <div className="edit-input-wrap">
                <IonIcon icon={lockClosedOutline} className="edit-field-icon" />
                <input
                  className="edit-input"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <IonIcon
                  icon={showCurrent ? eyeOffOutline : eyeOutline}
                  className="eye-icon"
                  onClick={() => setShowCurrent(!showCurrent)}
                />
              </div>
            </div>
          </div>

          {/* New Password */}
          <div className="cp-section">
            <p className="section-label">New Password</p>
            <div className="edit-field">
              <div className="edit-input-wrap">
                <IonIcon icon={lockClosedOutline} className="edit-field-icon" />
                <input
                  className="edit-input"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <IonIcon
                  icon={showNew ? eyeOffOutline : eyeOutline}
                  className="eye-icon"
                  onClick={() => setShowNew(!showNew)}
                />
              </div>

              {/* Strength Indicator */}
              {strength && (
                <div className="strength-wrap">
                  <div className="strength-bars">
                    <div className={`strength-bar ${strength === 'weak' || strength === 'fair' || strength === 'strong' ? 'active weak-color' : ''}`} />
                    <div className={`strength-bar ${strength === 'fair' || strength === 'strong' ? 'active fair-color' : ''}`} />
                    <div className={`strength-bar ${strength === 'strong' ? 'active strong-color' : ''}`} />
                  </div>
                  <span className={`strength-label ${strength}`}>{strength.charAt(0).toUpperCase() + strength.slice(1)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Confirm Password */}
          <div className="cp-section">
            <p className="section-label">Confirm New Password</p>
            <div className="edit-field">
              <div className={`edit-input-wrap ${confirmPassword && confirmPassword !== newPassword ? 'input-error' : ''}`}>
                <IonIcon icon={lockClosedOutline} className="edit-field-icon" />
                <input
                  className="edit-input"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
                <IonIcon
                  icon={showConfirm ? eyeOffOutline : eyeOutline}
                  className="eye-icon"
                  onClick={() => setShowConfirm(!showConfirm)}
                />
              </div>
              {confirmPassword && confirmPassword === newPassword && (
                <div className="match-msg">
                  <IonIcon icon={checkmarkCircleOutline} />
                  <span>Passwords match</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="cp-error">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Save Button */}
          <IonButton
            expand="block"
            className="save-btn"
            onClick={handleSave}
          >
            Save New Password
          </IonButton>

        </div>
      </IonContent>

      {/* Success Alert */}
      <IonAlert
        isOpen={showSuccessAlert}
        onDidDismiss={() => setShowSuccessAlert(false)}
        header="Password Updated"
        message="Your password has been changed successfully."
        buttons={[{ text: 'OK', role: 'confirm' }]}
      />
    </IonPage>
  );
};

export default ChangePassword;