import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { AuthProvider } from './context/AuthContext';
import { SignupProvider } from './context/SignupContext';

// ── Auth pages ────────────────────────────────────────────────────────────────
import Login             from './pages/Login/Login';
import SignUP1           from './pages/SignUp/signup1';
import SignUP2           from './pages/SignUp/signup2';
import SignUP3           from './pages/SignUp/signup3';
import ResetPassword     from './pages/ResetPassword/ResetPassword';
import GoogleUserProfile from './pages/SignUp/googleUser/googleUser';

// ── Main app pages ────────────────────────────────────────────────────────────
import Home              from './pages/Home/home';
import DestinationDetail from './pages/Home/DestinationDetail/DestinationDetail';
import Notifications     from './pages/Home/Notifications/Notifications';

// ── Settings / Profile ────────────────────────────────────────────────────────
import Settings          from './pages/Settings/Settings';
import Profile           from './pages/Settings/Profile/profile';
import Favorites         from './pages/Settings/favorites/Favorites';
import MyReviews         from './pages/Settings/myReviews/MyReviews';
import BookingHistory    from './pages/Settings/Tour/Tour';
import Scan              from './pages/Settings/Scan/Scan';
import About             from './pages/Settings/About';
import Help              from './pages/Settings/Help';


// ── Other ─────────────────────────────────────────────────────────────────────
import AIGuide           from './pages/AI/AIGuide';
import MapPage           from './pages/Map/maps';

// ── TourGuide ──────────────────────────────────────────────────────────────────
import TourGuideHome         from './pages/tourGuide/Home';
import TourGuideProfile      from './pages/tourGuide/Profile';
import TourGuideHistory      from './pages/tourGuide/History';
import TourGuideList         from './pages/tourGuide/TouristList';
import GenerateQR            from './pages/tourGuide/GenerateQR';
import TouristChangepass     from './pages/tourGuide/ChangePassword';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Dark mode */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <AuthProvider>
    <SignupProvider>
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>

            {/* ── Auth ──────────────────────────────────────────────────────── */}
            <Route exact path="/login"          component={Login}             />
            <Route exact path="/reset-password" component={ResetPassword}     />
            <Route exact path="/signUp1"        component={SignUP1}           />
            <Route exact path="/signup2"        component={SignUP2}           />
            <Route exact path="/signup3"        component={SignUP3}           />
            <Route exact path="/googleUser"     component={GoogleUserProfile} />

            {/* ── Tourguide ─────────────────────────────────────────────────── */}
            <Route exact path="/tourguide/home"         component={TourGuideHome}     />
            <Route exact path="/tourguide/profile"      component={TourGuideProfile}  />
            <Route exact path="/tourguide/history"      component={TourGuideHistory}  />
            <Route exact path="/tourguide/list"         component={TourGuideList}     />
            <Route exact path="/tourguide/generateQR"   component={GenerateQR}        />
            <Route exact path="/tourguide/changepass"   component={TouristChangepass} />


            {/* ── Main app ──────────────────────────────────────────────────── */}
            <Route exact path="/home"           component={Home}              />
            <Route exact path="/notifications"  component={Notifications}     />
            <Route exact path="/ai-guide"       component={AIGuide}           />
            <Route exact path="/maps"            component={MapPage}           />

            {/* ── Settings ──────────────────────────────────────────────────── */}
            <Route exact path="/settings"       component={Settings}          />
            <Route exact path="/profile"        component={Profile}           />
            <Route exact path="/favorites"      component={Favorites}         />
            <Route exact path="/my-reviews"     component={MyReviews}         />
            <Route exact path="/tour"           component={BookingHistory}    />
            <Route exact path="/scan"           component={Scan}              />
            <Route exact path="/settings/about" component={About}             />
            <Route exact path="/settings/help"  component={Help}              />

            {/* ── QR scan ───────────────────────────────────────────────────── */}
            {/* Also catches /destination?id= when matched here first            */}

            {/* ── Destination detail ────────────────────────────────────────── */}
            <Route        path="/destination/:id" component={DestinationDetail} />

            {/* ── Default ───────────────────────────────────────────────────── */}
            <Redirect exact from="/" to="/login" />

          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    </SignupProvider>
  </AuthProvider>
);

export default App;