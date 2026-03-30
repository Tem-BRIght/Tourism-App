// src/context/AuthContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Wraps Firebase Auth and provides a useAuth() hook consumed by:
//   home.tsx, profile.tsx, Favorites.tsx, DestinationDetail.tsx
//
// Exported shape: { user, isAuthenticated, loading, login, register,
//                   loginWithGoogle, logout, resetPassword }
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext, useContext, useEffect, useState, ReactNode,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { auth } from '../firebase';

// ── Context value shape ───────────────────────────────────────────────────────

interface GoogleAuthUser {
  authentication: { access_token: string; id_token: string; serverAuthCode?: string; };
  email: string; familyName: string; givenName: string; imageUrl: string; name: string; 
}

interface AuthContextValue {
  /** Authenticated Firebase user — null while loading or signed out */
  user:            User | null;
  /** True once a user is signed in */
  isAuthenticated: boolean;
  /** True while Firebase resolves the initial auth state (prevents redirect flicker) */
  loading:         boolean;
  login:           (email: string, password: string) => Promise<void>;
  register:        (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout:          () => Promise<void>;
  resetPassword:   (email: string) => Promise<void>;
}


// ── Context + Provider ────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);   // stays true until Firebase resolves

  useEffect(() => {
    // onAuthStateChanged fires immediately with the cached user (or null),
    // so `loading` drops to false on the very first render after mount.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;   // clean up listener on unmount
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
  };

  const loginWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      await loginWithGoogleNative();
    } else {
      await signInWithPopup(auth, new GoogleAuthProvider());
    }
  };

  const loginWithGoogleNative = async () => {
    try {
      await GoogleAuth.initialize();
      const { authentication: { idToken: id_token, accessToken: access_token } } = await GoogleAuth.signIn();
      
      const credential = GoogleAuthProvider.credential(id_token, access_token);
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      console.error('Google Native Auth error:', error);
      throw error; // Re-throw for caller to handle
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // ── Provide ───────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      login,
      register,
      loginWithGoogle,
      logout,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;