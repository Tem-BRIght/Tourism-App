import React, { useState } from 'react';
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
  IonModal,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge
} from '@ionic/react';
import { 
  arrowBackOutline,
  timeOutline,
  calendarOutline,
  peopleOutline,
  checkmarkCircle,
  timeOutline as pendingIcon,
  closeCircle
} from 'ionicons/icons';
import './History.css';

// Fallback mock sessions shown when localStorage is empty
const MOCK_SESSION_HISTORY = [
  {
    id: 1,
    date: '2024-01-15',
    startTime: '2024-01-15T09:30:00',
    endTime: '2024-01-15T11:45:00',
    durationSeconds: 8100,
    tourists: [
      { id: 1, name: 'John Doe',       email: 'john.doe@email.com',   status: 'Reviewed' },
      { id: 2, name: 'Jane Smith',     email: 'jane.smith@email.com', status: 'Reviewed' },
      { id: 3, name: 'Robert Johnson', email: 'robert.j@email.com',   status: 'Pending'  },
    ],
  },
  {
    id: 2,
    date: '2024-01-14',
    startTime: '2024-01-14T14:00:00',
    endTime: '2024-01-14T16:30:00',
    durationSeconds: 9000,
    tourists: [
      { id: 4, name: 'Maria Garcia', email: 'maria.g@email.com', status: 'Reviewed' },
      { id: 5, name: 'David Wilson', email: 'david.w@email.com', status: 'Reviewed' },
      { id: 6, name: 'Sarah Brown',  email: 'sarah.b@email.com', status: 'Reviewed' },
      { id: 7, name: 'James Miller', email: 'james.m@email.com', status: 'Pending'  },
    ],
  },
];

// ── Helper: load sessions from localStorage, fall back to mock ──
const loadSessions = () => {
  try {
    const saved = localStorage.getItem('tourSessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Tourists from localStorage won't have 'status' — default to 'Reviewed'
      return parsed.map((s: any) => ({
        ...s,
        tourists: s.tourists.map((t: any) => ({ ...t, status: t.status ?? 'Reviewed' })),
      }));
    }
  } catch (_) {}
  return MOCK_SESSION_HISTORY;
};

const History: React.FC = () => {
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // Read fresh every render so new sessions appear immediately
  const sessions = loadSessions();

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const formatDuration = (s: any) => {
    // Support both old { hours, minutes } shape and new durationSeconds
    if (typeof s.durationSeconds === 'number') {
      const h = Math.floor(s.durationSeconds / 3600);
      const m = Math.floor((s.durationSeconds % 3600) / 60);
      const sec = s.durationSeconds % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${sec}s`;
      return `${sec}s`;
    }
    return `${s.duration?.hours ?? 0}h ${s.duration?.minutes ?? 0}m`;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Reviewed') return <IonIcon icon={checkmarkCircle} className="status-icon reviewed" />;
    if (status === 'Pending')  return <IonIcon icon={pendingIcon}     className="status-icon pending"  />;
    return null;
  };

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setShowModal(true);
  };

  const totalTourists = sessions.reduce((acc: number, s: any) => acc + s.tourists.length, 0);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="history-header">
          <IonRouterLink routerLink="/home" className="back-button">
            <IonIcon icon={arrowBackOutline} />
          </IonRouterLink>
          <IonTitle className="history-title">Tour History</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="history-content">
        <div className="history-stats">
          <div className="stat-card">
            <div className="stat-value">{sessions.length}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalTourists}</div>
            <div className="stat-label">Tourists Served</div>
          </div>
        </div>

        <div className="history-list">
          <h3>Recent Sessions</h3>
          {sessions.map((session: any) => (
            <IonCard key={session.id} className="history-card" onClick={() => handleSessionClick(session)}>
              <IonCardContent>
                <div className="session-header">
                  <div className="session-date">
                    <IonIcon icon={calendarOutline} />
                    <span>{formatDate(session.date)}</span>
                  </div>
                  <div className="session-duration">
                    <IonIcon icon={timeOutline} />
                    <span>{formatDuration(session)}</span>
                  </div>
                </div>

                <div className="session-details">
                  <div className="session-time">
                    <span className="time-label">Started:</span>
                    <span className="time-value">{formatDateTime(session.startTime)}</span>
                  </div>
                  <div className="session-time">
                    <span className="time-label">Ended:</span>
                    <span className="time-value">{formatDateTime(session.endTime)}</span>
                  </div>
                </div>

                <div className="session-footer">
                  <div className="tourist-count">
                    <IonIcon icon={peopleOutline} />
                    <span>{session.tourists.length} Tourists</span>
                  </div>
                  <div className="status-summary">
                    <span className="reviewed-count">
                      {session.tourists.filter((t: any) => t.status === 'Reviewed').length} Reviewed
                    </span>
                    <span className="pending-count">
                      {session.tourists.filter((t: any) => t.status === 'Pending').length} Pending
                    </span>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>
      </IonContent>

      {/* Session Details Modal */}
      <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)} className="session-modal">
        {selectedSession && (
          <div className="modal-container">
            <div className="modal-header">
              <h2>Session Details</h2>
              <IonButton fill="clear" onClick={() => setShowModal(false)} className="close-button">✕</IonButton>
            </div>

            <div className="tourist-table-container">
              <div className="table-header">
                <div className="col-no">No.</div>
                <div className="col-name">Name</div>
                <div className="col-email">Email</div>
                <div className="col-status">Status</div>
              </div>
              <IonList className="tourist-table-list">
                {selectedSession.tourists.map((tourist: any, index: number) => (
                  <IonItem key={tourist.id} className="tourist-table-row" lines="full">
                    <div className="col-no">{index + 1}</div>
                    <div className="col-name">{tourist.name}</div>
                    <div className="col-email">{tourist.email}</div>
                    <div className="col-status">
                      <div className={`status-cell ${tourist.status.toLowerCase()}`}>
                        {getStatusIcon(tourist.status)}
                        <span>{tourist.status}</span>
                      </div>
                    </div>
                  </IonItem>
                ))}
              </IonList>
            </div>

            <div className="modal-footer">
              <IonButton expand="block" className="close-modal-btn" onClick={() => setShowModal(false)}>
                Close
              </IonButton>
            </div>
          </div>
        )}
      </IonModal>
    </IonPage>
  );
};

export default History;