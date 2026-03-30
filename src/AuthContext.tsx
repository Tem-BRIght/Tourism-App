import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { signInWithEmailAndPassword, signOut, UserCredential } from 'firebase/auth';
import { auth as firebaseAuth } from './firebase'; // adjust path if needed

export const auth = {
    signIn: async (email: string, password: string): Promise<UserCredential> => {
        try {
            const user = await signInWithEmailAndPassword(firebaseAuth, email, password);
            return user;
        } catch (error) {
            console.error(error);
            throw error;
        }
    },
    signOut: async (): Promise<void> => {
        try {
            await signOut(firebaseAuth);
        } catch (error) {
            console.error(error);
            throw error;
        }
    },
    signInWithGoogle: async () => {
        try {
            const user = await GoogleAuth.signIn();
            return user;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
};

export const googleAuth = {
    signIn: async () => {
        try {
            const user = await GoogleAuth.signIn();
            return user;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
};