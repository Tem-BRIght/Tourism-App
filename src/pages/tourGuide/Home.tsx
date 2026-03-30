import React from 'react';
import { 
  IonContent, 
  IonPage, 
  IonIcon, 
  IonGrid, 
  IonRow, 
  IonCol,
  IonFooter,
  IonToolbar,
  IonButton,
  IonHeader,
  IonAvatar,
  IonImg,
  IonRouterLink
} from '@ionic/react';
import { 
  peopleOutline, 
  timeOutline, 
  qrCodeOutline 
} from 'ionicons/icons';
import './Home.css';

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader className="header-content ion-no-border" style={{ position: 'relative' }}>
        <IonRouterLink routerLink="/profile" className="profile-link">
          <IonAvatar className="profile-avatar">
            <IonImg src="https://ionicframework.com/docs/img/demos/avatar.svg" alt="profile" />
          </IonAvatar>
        </IonRouterLink>
      </IonHeader>

      <IonContent className="home-content">

        {/* Hero Banner */}
        <div className="home-hero">
          <div className="welcome-section">
            <h2>SEE-WAYS PASIG</h2>
            <h1>TOURGUIDE</h1>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="ion-padding">
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <div className="action-card" onClick={() => window.location.href = '/tourist-list'}>
                    <div className="action-icon tourist">
                      <IonIcon icon={peopleOutline} />
                    </div>
                    <h4>Tourist List</h4>
                    <p>View all tourists</p>
                  </div>
                </IonCol>

                <IonCol size="6">
                  <div className="action-card" onClick={() => window.location.href = '/history'}>
                    <div className="action-icon history">
                      <IonIcon icon={timeOutline} />
                    </div>
                    <h4>History</h4>
                    <p>Past activities</p>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
        </div>

      </IonContent>

      <IonFooter className="ion-no-border">
        <IonToolbar className="footer-toolbar">
          <div className="qr-scanner-container">
            <IonButton
              className="qr-scanner-circle"
              shape="round"
              routerLink="/generate-qr"
            >
              <IonIcon icon={qrCodeOutline} />
            </IonButton>
            <p className="qr-scanner-label">Generate QR Code</p>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default Home;