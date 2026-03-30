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
  IonAvatar,
  IonImg,
  IonToggle,
  IonAlert,
  IonModal,
  IonInput,
  IonItem,
  IonLabel,
  useIonRouter,
} from '@ionic/react';
import {
  arrowBackOutline,
  personOutline,
  mailOutline,
  callOutline,
  notificationsOutline,
  lockClosedOutline,
  logOutOutline,
  chevronForwardOutline,
  shieldCheckmarkOutline,
  createOutline,
  helpCircleOutline,
  closeOutline,
} from 'ionicons/icons';
import './Profile.css';

const Profile: React.FC = () => {
  const router = useIonRouter();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState('Juan dela Cruz');
  const [email, setEmail] = useState('juan.delacruz@pasig.gov.ph');
  const [contact, setContact] = useState('+63 917 123 4567');

  // Temp state while editing
  const [tempName, setTempName] = useState(fullName);
  const [tempEmail, setTempEmail] = useState(email);
  const [tempContact, setTempContact] = useState(contact);

  const openEdit = () => {
    setTempName(fullName);
    setTempEmail(email);
    setTempContact(contact);
    setShowEditModal(true);
  };

  const saveEdit = () => {
    setFullName(tempName);
    setEmail(tempEmail);
    setContact(tempContact);
    setShowEditModal(false);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="profile-header">
          <IonRouterLink routerLink="/home" className="profile-back-btn">
            <IonIcon icon={arrowBackOutline} />
          </IonRouterLink>
          <IonTitle className="profile-header-title">Profile</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="profile-content">

        {/* ── Avatar + Name ── */}
        <div className="profile-hero">
          <div className="profile-avatar-wrap">
            <IonAvatar className="profile-avatar-lg">
              <IonImg src="https://ionicframework.com/docs/img/demos/avatar.svg" alt="avatar" />
            </IonAvatar>
            <div className="profile-badge">
              <IonIcon icon={shieldCheckmarkOutline} />
            </div>
          </div>
          <h2 className="profile-name">{fullName}</h2>
          <span className="profile-role">Tour Guide · Pasig City</span>
        </div>

        {/* ── Personal Info ── */}
        <div className="profile-section">
          <p className="section-label">Personal Info</p>

          {/* Edit Profile row */}
          <div className="settings-row tappable" onClick={openEdit}>
            <div className="info-icon-wrap">
              <IonIcon icon={createOutline} />
            </div>
            <div className="info-text">
              <span className="info-value">Edit Profile</span>
              <span className="info-label">Name, email, contact number</span>
            </div>
            <IonIcon icon={chevronForwardOutline} className="chevron-icon" />
          </div>
        </div>

        {/* ── General ── */}
        <div className="profile-section">
          <p className="section-label">General</p>

          {/* Notifications */}
          <div className="settings-row">
            <div className="info-icon-wrap">
              <IonIcon icon={notificationsOutline} />
            </div>
            <div className="info-text">
              <span className="info-value">Notifications</span>
              <span className="info-label">Session alerts & updates</span>
            </div>
            <IonToggle
              checked={notificationsOn}
              onIonChange={(e) => setNotificationsOn(e.detail.checked)}
              className="pasig-toggle"
            />
          </div>

          {/* Change Password */}
          <div className="settings-row tappable" onClick={() => router.push('/change-password')}>
            <div className="info-icon-wrap">
              <IonIcon icon={lockClosedOutline} />
            </div>
            <div className="info-text">
              <span className="info-value">Change Password</span>
              <span className="info-label">Update your credentials</span>
            </div>
            <IonIcon icon={chevronForwardOutline} className="chevron-icon" />
          </div>

          {/* Help Center */}
          <div className="settings-row tappable">
            <div className="info-icon-wrap">
              <IonIcon icon={helpCircleOutline} />
            </div>
            <div className="info-text">
              <span className="info-value">Help Center</span>
              <span className="info-label">FAQs & support</span>
            </div>
            <IonIcon icon={chevronForwardOutline} className="chevron-icon" />
          </div>
        </div>

        {/* ── Logout ── */}
        <div className="profile-section">
          <IonButton
            expand="block"
            className="logout-btn"
            onClick={() => setShowLogoutAlert(true)}
          >
            <IonIcon icon={logOutOutline} slot="start" />
            Log Out
          </IonButton>
        </div>

      </IonContent>

      {/* ── Edit Profile Modal ── */}
      <IonModal
        isOpen={showEditModal}
        onDidDismiss={() => setShowEditModal(false)}
        className="edit-profile-modal"
        breakpoints={[0, 0.65]}
        initialBreakpoint={0.65}
      >
        <div className="edit-modal-content">
          <div className="edit-modal-header">
            <h3>Edit Profile</h3>
            <IonButton fill="clear" className="edit-close-btn" onClick={() => setShowEditModal(false)}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </div>

          <div className="edit-field">
            <span className="edit-field-label">Full Name</span>
            <div className="edit-input-wrap">
              <IonIcon icon={personOutline} className="edit-field-icon" />
              <input
                className="edit-input"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Full Name"
              />
            </div>
          </div>

          <div className="edit-field">
            <span className="edit-field-label">Email</span>
            <div className="edit-input-wrap">
              <IonIcon icon={mailOutline} className="edit-field-icon" />
              <input
                className="edit-input"
                type="email"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                placeholder="Email"
              />
            </div>
          </div>

          <div className="edit-field">
            <span className="edit-field-label">Contact Number</span>
            <div className="edit-input-wrap">
              <IonIcon icon={callOutline} className="edit-field-icon" />
              <input
                className="edit-input"
                type="tel"
                value={tempContact}
                onChange={(e) => setTempContact(e.target.value)}
                placeholder="Contact Number"
              />
            </div>
          </div>

          <IonButton expand="block" className="save-btn" onClick={saveEdit}>
            Save Changes
          </IonButton>
        </div>
      </IonModal>

      {/* ── Logout Alert ── */}
      <IonAlert
        isOpen={showLogoutAlert}
        onDidDismiss={() => setShowLogoutAlert(false)}
        header="Log Out"
        message="Are you sure you want to log out?"
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Log Out',
            role: 'confirm',
            handler: () => {
              window.location.href = '/';
            },
          },
        ]}
      />
    </IonPage>
  );
};

export default Profile;