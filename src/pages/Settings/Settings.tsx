import React, { useState, useEffect } from 'react';
import {
  IonButtons,
  IonBackButton,
  IonAvatar,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonAlert,
  IonLoading,
} from '@ionic/react';
import { useIonRouter } from '@ionic/react';
import {
  heartOutline,
  starOutline,
  person,
  notificationsOutline,
  globeOutline,
  shieldCheckmarkOutline,
  helpCircleOutline,
  headsetOutline,
  warningOutline,
  phonePortraitOutline,
  documentTextOutline,
  logOutOutline,
  chevronForwardOutline,
  personCircleOutline,
  scanOutline,
} from 'ionicons/icons';

import { useAuth } from '../../context/AuthContext';
import { getUserProfile, UserProfile } from '../../services/userProfileService';

import './Settings.css';

const Settings: React.FC = () => {
  const router = useIonRouter();
  const { user, logout, loading: authLoading } = useAuth();

  const [userProfile, setUserProfile]         = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading]   = useState(true);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const [loggingOut, setLoggingOut]           = useState(false);

  // ── Fetch profile from Firestore ──────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user?.uid) return;

    let cancelled = false;
    const fetch = async () => {
      setProfileLoading(true);
      try {
        const profile = await getUserProfile(user.uid);
        if (!cancelled) setUserProfile(profile);
      } catch (err) {
        console.error('[Settings] Failed to load profile:', err);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user?.uid, authLoading]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const onItemClick = (label: string) => {
    switch (label) {
      case 'Favorites':        router.push('/favorites');                   break;
      case 'My Reviews':       router.push('/my-reviews');         break;
      case 'Tour Guide':       router.push('/tour');    break;
      case 'Scan':             router.push('/scan');                        break;
      case 'Privacy Settings': router.push('/settings/privacy');            break;
      case 'Help Center':      router.push('/settings/help');               break;
      case 'Contact Support':  router.push('/settings/contact-support');    break;
      case 'Report Problem':   router.push('/settings/report-problem');     break;
      case 'About App':        router.push('/settings/about');              break;
      case 'Terms & Privacy':  router.push('/settings/terms');              break;
      default:                 console.log('[Settings] unhandled:', label);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push('/login', 'root', 'replace');
    } catch (err) {
      console.error('[Settings] Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const displayName = userProfile
    ? [userProfile.name?.firstname, userProfile.name?.surname, userProfile.name?.suffix]
        .filter(Boolean).join(' ').trim() || userProfile.nickname || 'User'
    : user?.displayName || 'User';

  const nickname = userProfile?.nickname
    ? `@${userProfile.nickname}`
    : user?.email?.split('@')[0]
      ? `@${user.email!.split('@')[0]}`
      : '';

  const avatarSrc =
    userProfile?.img ||
    localStorage.getItem('profilePic') ||
    '/assets/images/Temporary.png';

  // ── Sub-component ─────────────────────────────────────────────────────────
  const Item = ({
    icon, color, label, onClick, extraClass = '',
  }: {
    icon: string; color: string; label: string;
    onClick: () => void; extraClass?: string;
  }) => (
    <div className={`item ${extraClass}`} onClick={onClick}>
      <div className={`icon ${color}`}>
        <IonIcon icon={icon} />
      </div>
      <span>{label}</span>
      <IonIcon icon={chevronForwardOutline} className="arrow" />
    </div>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/home" /></IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonLoading
        isOpen={authLoading || profileLoading || loggingOut}
        message={loggingOut ? 'Logging out…' : 'Loading…'}
      />

      {/* ── Profile card ───────────────────────────────────────────────── */}
      <div
        className="profile-top-section"
        role="button"
        tabIndex={0}
        onClick={() => router.push('/profile')}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push('/profile')}
        style={{ cursor: 'pointer' }}
      >
        <div className="profile-photo-container">
          <div className="avatar-wrapper">
            <IonAvatar className="profile-avatar">
              <img
                src={avatarSrc}
                alt="Profile"
                onError={e => (e.currentTarget.src = '/assets/images/Temporary.png')}
              />
            </IonAvatar>
          </div>
        </div>

        {!profileLoading && (
          <>
            <h2 className="settings-profile-name">{displayName}</h2>
            {nickname && <p className="settings-profile-username">{nickname}</p>}
          </>
        )}

        <div className="view-profile-link">View Profile</div>
      </div>

      <IonContent scrollY={true} style={{ '--overflow': 'scroll' }}>

        {/* ── Profile ────────────────────────────────────────────────────── */}
        <div className="section">
          <p className="section-title">Profile</p>
          <div className="card">
            <Item icon={heartOutline}  color="red"    label="Favorites"  onClick={() => onItemClick('Favorites')}  />
            <Item icon={starOutline}   color="yellow" label="My Reviews" onClick={() => onItemClick('My Reviews')} />
            <Item icon={person}   color="blue"   label="Tour Guide" onClick={() => onItemClick('Tour Guide')} />
            <Item icon={scanOutline}   color="blue"   label="Scan"       onClick={() => onItemClick('Scan')}       />
          </div>
        </div>

        {/* ── Support ────────────────────────────────────────────────────── */}
        <div className="section">
          <p className="section-title">Support</p>
          <div className="card">
            <Item icon={helpCircleOutline} color="cyan" label="Help Center"     onClick={() => onItemClick('Help Center')}     />
            <Item icon={headsetOutline}    color="mint" label="Contact Support" onClick={() => onItemClick('Contact Support')} />
            <Item icon={warningOutline}    color="red"  label="Report Problem"  onClick={() => onItemClick('Report Problem')}  />
          </div>
        </div>

        {/* ── About ──────────────────────────────────────────────────────── */}
        <div className="section">
          <p className="section-title">About</p>
          <div className="card">
            <Item icon={phonePortraitOutline} color="gray" label="About App"       onClick={() => onItemClick('About App')}       />
            <Item icon={documentTextOutline}  color="gray" label="Terms & Privacy" onClick={() => onItemClick('Terms & Privacy')} />
            <Item
              icon={logOutOutline}
              color="red-outline"
              label="Logout"
              onClick={() => setShowLogoutAlert(true)}
              extraClass="logout"
            />
          </div>

          <div className="footer">
            <p>Version 1.0.0</p>
            <p>© 2025 All rights reserved</p>
          </div>
        </div>

        {/* ── Scroll spacer so footer clears tab bar ─────────────────────── */}
        <div style={{ height: '32px' }} />

        {/* ── Logout confirmation ─────────────────────────────────────────── */}
        <IonAlert
          isOpen={showLogoutAlert}
          onDidDismiss={() => setShowLogoutAlert(false)}
          header="Confirm Logout"
          message="Are you sure you want to logout?"
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Logout', handler: handleLogout },
          ]}
        />

      </IonContent>
    </IonPage>
  );
};

export default Settings;