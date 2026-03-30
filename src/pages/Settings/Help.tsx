import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon
} from '@ionic/react';
import {
  bookOutline,
  cardOutline,
  mapOutline,
  personOutline,
  bugOutline,
  chatbubbleEllipsesOutline,
  callOutline,
  mailOutline,
  locationOutline,
  helpCircleOutline
} from 'ionicons/icons';

import './Help.css';

const Help: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/settings" />
          </IonButtons>
          <IonTitle>Help Center</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>

        {/* Search */}
        <div className="help-search">
          <IonSearchbar placeholder="Type your question..." />
        </div>

        {/* Categories */}
        <IonList inset>
          <IonItem lines="none">
            <IonIcon icon={helpCircleOutline} slot="start" />
            <IonLabel><strong>Categories</strong></IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={bookOutline} slot="start" />
            <IonLabel>Getting Started</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={cardOutline} slot="start" />
            <IonLabel>Booking & Payments</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={mapOutline} slot="start" />
            <IonLabel>Tour Guides</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={mapOutline} slot="start" />
            <IonLabel>Navigation & Maps</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={personOutline} slot="start" />
            <IonLabel>Account & Profile</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={bugOutline} slot="start" />
            <IonLabel>Technical Issues</IonLabel>
          </IonItem>
        </IonList>

        {/* FAQs */}
        <IonList inset>
          <IonItem lines="none">
            <IonIcon icon={helpCircleOutline} slot="start" />
            <IonLabel><strong>Frequently Asked Questions</strong></IonLabel>
          </IonItem>

          <IonItem button>
            <IonLabel>How do I book a tour guide?</IonLabel>
          </IonItem>

          <IonItem button>
            <IonLabel>How do I cancel a booking?</IonLabel>
          </IonItem>

          <IonItem button>
            <IonLabel>Is there an offline mode?</IonLabel>
          </IonItem>

          <IonItem button>
            <IonLabel>How do I earn badges?</IonLabel>
          </IonItem>

          <IonItem button>
            <IonLabel>How do I contact support?</IonLabel>
          </IonItem>
        </IonList>

        {/* Contact Options */}
        <IonList inset>
          <IonItem lines="none">
            <IonIcon icon={callOutline} slot="start" />
            <IonLabel><strong>Contact Options</strong></IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={chatbubbleEllipsesOutline} slot="start" />
            <IonLabel>Live Chat with Support</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={callOutline} slot="start" />
            <IonLabel>Call CATO Office</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={mailOutline} slot="start" />
            <IonLabel>Email Support</IonLabel>
          </IonItem>

          <IonItem button>
            <IonIcon icon={locationOutline} slot="start" />
            <IonLabel>Visit in Person</IonLabel>
          </IonItem>
        </IonList>

        {/* Actions */}
        <div className="help-actions">
          <IonButton expand="block" fill="outline">
            View All FAQs
          </IonButton>

          <IonButton expand="block">
            Contact Us
          </IonButton>
        </div>

      </IonContent>
    </IonPage>
  );
};

export default Help;
