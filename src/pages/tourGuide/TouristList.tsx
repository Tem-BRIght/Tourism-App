import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  IonContent, 
  IonPage, 
  IonHeader,
  IonToolbar,
  IonTitle,
  IonRouterLink,
  IonIcon,
  IonCard,
  IonCardContent,
  IonList,
  IonItem,
  IonSearchbar,
  IonButton,
  IonModal,
  IonAvatar,
  IonImg
} from '@ionic/react';
import { 
  arrowBackOutline,
  searchOutline,
  mailOutline,
  closeOutline,
  playOutline,
  stopOutline,
  timeOutline,
  peopleOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import './TouristList.css';

const MOCK_TOURISTS = [
  { id: 1, name: 'John Doe', email: 'john.doe@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 3, name: 'Robert Johnson', email: 'robert.j@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 4, name: 'Maria Garcia', email: 'maria.g@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 5, name: 'David Wilson', email: 'david.w@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 6, name: 'Sarah Brown', email: 'sarah.b@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 7, name: 'James Miller', email: 'james.m@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 8, name: 'Emma Davis', email: 'emma.d@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 9, name: 'Michael Lee', email: 'michael.l@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
  { id: 10, name: 'Lisa Anderson', email: 'lisa.a@email.com', avatar: 'https://ionicframework.com/docs/img/demos/avatar.svg' },
];

const TouristList: React.FC = () => {
  const history = useHistory();
  const [searchText, setSearchText] = useState('');
  const [selectedTourist, setSelectedTourist] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);           // seconds
  const [showSummary, setShowSummary] = useState(false);
  const [finalDuration, setFinalDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start / stop timer
  useEffect(() => {
    if (sessionActive) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionActive]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleStart = () => {
    setElapsed(0);
    setSessionActive(true);
  };

  const handleEnd = () => {
    setSessionActive(false);
    setFinalDuration(elapsed);
    setShowSummary(true);
    setElapsed(0);
  };

  const filteredTourists = MOCK_TOURISTS.filter(tourist =>
    tourist.name.toLowerCase().includes(searchText.toLowerCase()) ||
    tourist.email.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleTouristClick = (tourist: any) => {
    setSelectedTourist(tourist);
    setShowModal(true);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="list-page-header">
          <IonRouterLink routerLink="/generate-qr" className="back-button">
            <IonIcon icon={arrowBackOutline} />
          </IonRouterLink>
          <IonTitle className="list-page-title">Tourist List</IonTitle>
          <div className="header-placeholder"></div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="list-page-content">

        {/* Search Bar */}
        <div className="search-container">
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value!)}
            placeholder="Search by name or email"
            className="custom-searchbar"
            animated
          />
        </div>

        {/* Stats Card */}
        <div className="stats-card">
          <div className="stat-item">
            <div className="stat-number">{MOCK_TOURISTS.length}</div>
            <div className="stat-label">Total Tourists</div>
          </div>
        </div>

        {/* Tourist Table Card */}
        <IonCard className="tourist-page-card">
          <IonCardContent>
            <div className="tourist-table-header">
              <div className="header-col-id">ID</div>
              <div className="header-col-name">Name</div>
              <div className="header-col-email">Email</div>
            </div>

            <IonList className="tourist-page-list">
              {filteredTourists.length > 0 ? (
                filteredTourists.map((tourist) => (
                  <IonItem
                    key={tourist.id}
                    className="tourist-page-row"
                    lines="full"
                    button
                    onClick={() => handleTouristClick(tourist)}
                  >
                    <div className="row-col-id">{tourist.id}</div>
                    <div className="row-col-name">
                      <IonAvatar className="tourist-avatar">
                        <IonImg src={tourist.avatar} />
                      </IonAvatar>
                      <span className="tourist-name">{tourist.name}</span>
                    </div>
                    <div className="row-col-email">{tourist.email}</div>
                  </IonItem>
                ))
              ) : (
                <div className="no-results">
                  <IonIcon icon={searchOutline} />
                  <p>No tourists found</p>
                </div>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Session FAB */}
        <div className="session-fab-wrap">
          {/* Timer pill — visible only while session is active */}
          {sessionActive && (
            <div className="session-timer-pill">
              <IonIcon icon={timeOutline} />
              <span>{formatTime(elapsed)}</span>
            </div>
          )}

          <button
            className={`session-fab ${sessionActive ? 'session-fab--end' : 'session-fab--start'}`}
            onClick={sessionActive ? handleEnd : handleStart}
          >
            <IonIcon icon={sessionActive ? stopOutline : playOutline} />
            <span>{sessionActive ? 'End' : 'Start'}</span>
          </button>
        </div>

      </IonContent>

      {/* Tourist Details Modal */}
      <IonModal
        isOpen={showModal}
        onDidDismiss={() => setShowModal(false)}
        className="tourist-detail-modal"
        breakpoints={[0, 0.4]}
        initialBreakpoint={0.4}
      >
        {selectedTourist && (
          <div className="detail-modal-content">
            <div className="detail-modal-header">
              <IonButton fill="clear" onClick={() => setShowModal(false)} className="detail-close-btn">
                <IonIcon icon={closeOutline} />
              </IonButton>
            </div>

            <div className="detail-avatar-container">
              <IonAvatar className="detail-avatar">
                <IonImg src={selectedTourist.avatar} />
              </IonAvatar>
              <h2>{selectedTourist.name}</h2>
            </div>

            <div className="detail-info">
              <div className="detail-info-item">
                <IonIcon icon={mailOutline} />
                <div className="detail-info-text">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{selectedTourist.email}</span>
                </div>
              </div>
            </div>

            <div className="detail-actions">
              <IonButton expand="block" className="action-btn">
                <IonIcon icon={mailOutline} slot="start" />
                Send Message
              </IonButton>
            </div>
          </div>
        )}
      </IonModal>

      {/* Session Summary Modal */}
      <IonModal
        isOpen={showSummary}
        onDidDismiss={() => setShowSummary(false)}
        className="summary-modal"
        breakpoints={[0, 0.55]}
        initialBreakpoint={0.55}
      >
        <div className="summary-content">
          {/* Success icon */}
          <div className="summary-icon">
            <IonIcon icon={checkmarkCircleOutline} />
          </div>

          <h2>Session Ended</h2>
          <p>Here's a summary of your completed tour session.</p>

          {/* Summary stats */}
          <div className="summary-stats">
            <div className="summary-stat">
              <div className="summary-stat-icon">
                <IonIcon icon={timeOutline} />
              </div>
              <span className="summary-stat-value">{formatTime(finalDuration)}</span>
              <span className="summary-stat-label">Duration</span>
            </div>

            <div className="summary-stat-divider" />

            <div className="summary-stat">
              <div className="summary-stat-icon">
                <IonIcon icon={peopleOutline} />
              </div>
              <span className="summary-stat-value">{MOCK_TOURISTS.length}</span>
              <span className="summary-stat-label">Tourists</span>
            </div>
          </div>

          <IonButton
            expand="block"
            className="summary-close-btn"
            onClick={() => {
              setShowSummary(false);
              history.push('/feedback-qr');
            }}
          >
            Done
          </IonButton>
        </div>
      </IonModal>

    </IonPage>
  );
};

export default TouristList;