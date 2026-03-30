import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon,
  IonContent, IonAvatar, IonTitle, IonList, IonItem, IonLabel,
  IonBackButton, IonLoading, IonPopover, IonInput
} from '@ionic/react';
import {
  ellipsisVertical, camera, person, location, mail,
  save, close
} from 'ionicons/icons';
import { useAuth } from '../../../context/AuthContext';
import {
  createUserProfile, getUserProfile, updateUserProfile,
  uploadProfilePicture, UserProfile, UserName
} from '../../../services/userProfileService';
import './profile.css';

const Profile: React.FC = () => {
  const history = useHistory();
  const { user, loading } = useAuth();
  const [userProfile,    setUserProfile]    = useState<UserProfile | null>(null);
  const [error,          setError]          = useState<string | null>(null);


  // Editing state
  const [isEditing,      setIsEditing]      = useState(false);
  const [editForm,       setEditForm]       = useState<Partial<UserProfile>>({});
  const [isSaving,       setIsSaving]       = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats placeholder (replace with real Firestore data later)
  const stats = { visited: 12, reviews: 8, upcoming: '?' };

  // ── Load profile ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      if (loading || !user) { setProfileLoading(false); return; }

      try {
        setError(null);
        let profile = await getUserProfile(user.uid);

        // Create a placeholder doc if none exists yet
        if (!profile) {
          const defaultNickname = user.email?.split('@')[0] || 'user';
          profile = { email: user.email || '', nickname: defaultNickname };
          await createUserProfile(user.uid, profile);
        }

        setUserProfile(profile);
        if (profile?.img) localStorage.setItem('profilePic', profile.img);
      } catch (err) {
        console.error(err);
        setError('Failed to load profile. Please try again.');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user, loading]);

  // ── Image upload ─────────────────────────────────────────────────────────────
  const handleImageClick = () => {
    if (!isEditing && userProfile) {
      setEditForm({ ...userProfile });
      setIsEditing(true);
      setTimeout(() => fileInputRef.current?.click(), 50);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsSaving(true);
    try {
      const downloadURL = await uploadProfilePicture(user.uid, file);
      setEditForm(prev => ({ ...prev, img: downloadURL }));
      localStorage.setItem('profilePic', downloadURL);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image. File may be too large.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNameChange = (subField: keyof UserName, value: string) => {
    setEditForm(prev => ({
      ...prev,
      name: {
        firstname: prev.name?.firstname || userProfile?.name?.firstname || '',
        surname:   prev.name?.surname   || userProfile?.name?.surname   || '',
        suffix:    prev.name?.suffix    || userProfile?.name?.suffix    || '',
        [subField]: value,
      },
    }));
  };

  const handleEditProfile = () => {
    if (userProfile) {
      setEditForm({ ...userProfile });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!user || !userProfile) return;
    setIsSaving(true);
    try {
      if (!editForm.name?.firstname?.trim()) throw new Error('First name is required');
      if (!editForm.nickname?.trim())        throw new Error('Nickname is required');

      const changes: Partial<UserProfile> = {};
      (Object.keys(editForm) as Array<keyof UserProfile>).forEach(key => {
        if (key === 'name') {
          const nameChanges: Partial<UserProfile['name']> = {};
          (['firstname', 'surname', 'suffix'] as const).forEach(sub => {
            if (editForm.name?.[sub] !== userProfile.name?.[sub]) {
              nameChanges[sub] = editForm.name?.[sub];
            }
          });
          if (Object.keys(nameChanges).length) changes.name = nameChanges as UserProfile['name'];
        } else if (editForm[key] !== userProfile[key]) {
          changes[key] = editForm[key] as any;
        }
      });

      if (Object.keys(changes).length === 0) {
        setIsEditing(false);
        setIsSaving(false);
        return;
      }

      await updateUserProfile(user.uid, changes);
      const merged = { ...userProfile, ...editForm };
      setUserProfile(merged);
      if (merged.img) localStorage.setItem('profilePic', merged.img);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/settings" /></IonButtons>
          <IonTitle>Profile</IonTitle>
          <IonButtons slot="end">
            <IonButton id="profile-menu-button">
              <IonIcon icon={ellipsisVertical} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="profile-content">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <IonLoading
          isOpen={loading || profileLoading || isSaving}
          message={isSaving ? 'Saving...' : 'Loading...'}
        />

        {error && (
          <div className="error-banner">
            <p>{error}</p>
            <IonButton size="small" fill="outline" onClick={() => window.location.reload()}>
              Retry
            </IonButton>
          </div>
        )}

        {!userProfile && !profileLoading && !error && (
          <div className="empty-state">
            <p>No profile data found yet. Tap ⋮ and choose "Edit profile" to create one.</p>
          </div>
        )}

        {userProfile && (
          <>
            {/* ── Photo & name ── */}
            <div className={`profile-top-section${isEditing ? ' profile-top-section--editing' : ''}`}>
              <div
                className="profile-photo-container"
                onClick={handleImageClick}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleImageClick()}
                style={{ cursor: 'pointer' }}
              >
                <div className={`avatar-wrapper${isEditing ? ' avatar-wrapper--editing' : ''}`}>
                  <IonAvatar className="profile-avatar">
                    <img
                      src={editForm.img || userProfile.img || '/assets/images/Temporary.png'}
                      alt="Profile"
                      onError={e => (e.currentTarget.src = '/assets/images/Temporary.png')}
                    />
                  </IonAvatar>
                  {isEditing && (
                    <div className="camera-icon">
                      <IonIcon icon={camera} />
                    </div>
                  )}
                </div>
              </div>

              {!isEditing && (
                <>
                  <h1 className="profile-name">
                    {userProfile.name?.firstname} {userProfile.name?.surname} {userProfile.name?.suffix}
                  </h1>
                  <p className="profile-username">@{userProfile.nickname}</p>
                </>
              )}
            </div>

            {/* ── Personal info ── */}
            <div className="personal-info-section">
              {!isEditing ? (
                <>
                  <h2>Personal Information</h2>
                  <IonList>
                    <IonItem>
                      <IonIcon icon={person} slot="start" />
                      <IonLabel>
                        <h3>Date of Birth</h3>
                        <p>{userProfile.dateOfBirth ? new Date(userProfile.dateOfBirth).toLocaleDateString() : '-'}</p>
                      </IonLabel>
                    </IonItem>
                    <IonItem>
                      <IonIcon icon={location} slot="start" />
                      <IonLabel>
                        <h3>Nationality</h3>
                        <p>{userProfile.nationality ? userProfile.nationality.charAt(0).toUpperCase() + userProfile.nationality.slice(1) : '-'}</p>
                      </IonLabel>
                    </IonItem>
                    <IonItem>
                      <IonIcon icon={mail} slot="start" />
                      <IonLabel>
                        <h3>Email</h3>
                        <p>{userProfile.email}</p>
                      </IonLabel>
                    </IonItem>
                  </IonList>
                </>
              ) : (
                <>
                  <h2 className="edit-section-label">Name</h2>
                  <IonList className="edit-list">
                    <IonItem>
                      <IonLabel position="stacked">First Name</IonLabel>
                      <IonInput value={editForm.name?.firstname} placeholder="Enter first name" onIonChange={e => handleNameChange('firstname', e.detail.value!)} />
                    </IonItem>
                    <IonItem>
                      <IonLabel position="stacked">Surname</IonLabel>
                      <IonInput value={editForm.name?.surname} placeholder="Enter surname" onIonChange={e => handleNameChange('surname', e.detail.value!)} />
                    </IonItem>
                    <IonItem>
                      <IonLabel position="stacked">Suffix (optional)</IonLabel>
                      <IonInput value={editForm.name?.suffix} placeholder="e.g. Jr., III" onIonChange={e => handleNameChange('suffix', e.detail.value!)} />
                    </IonItem>
                    <IonItem>
                      <IonLabel position="stacked">Nickname</IonLabel>
                      <IonInput value={editForm.nickname} placeholder="Enter nickname" onIonChange={e => handleInputChange('nickname', e.detail.value!)} />
                    </IonItem>
                  </IonList>

                  <h2 className="edit-section-label">Personal Details</h2>
                  <IonList className="edit-list">
                    <IonItem>
                      <IonLabel position="stacked">Date of Birth</IonLabel>
                      <IonInput type="date" value={editForm.dateOfBirth?.slice(0, 10)} onIonChange={e => handleInputChange('dateOfBirth', e.detail.value!)} />
                    </IonItem>
                    <IonItem>
                      <IonLabel position="stacked">Nationality</IonLabel>
                      <IonInput value={editForm.nationality} placeholder="Enter nationality" onIonChange={e => handleInputChange('nationality', e.detail.value!)} />
                    </IonItem>
                  </IonList>

                  <IonToolbar>
                    <IonButtons slot="start">
                      <IonButton color="medium" onClick={handleCancelEdit}>
                        <IonIcon icon={close} slot="start" />Cancel
                      </IonButton>
                    </IonButtons>
                    <IonButtons slot="end">
                      <IonButton color="primary" onClick={handleSave} disabled={isSaving}>
                        <IonIcon icon={save} slot="start" />Save
                      </IonButton>
                    </IonButtons>
                  </IonToolbar>
                </>
              )}
            </div>


            {/* ── Profile menu popover ── */}
            <IonPopover trigger="profile-menu-button">
              <IonList>
                <IonItem button onClick={handleEditProfile}>
                  <IonLabel>Edit profile</IonLabel>
                </IonItem>
              </IonList>
            </IonPopover>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Profile;