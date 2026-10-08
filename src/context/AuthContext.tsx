import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  isAdminEmail,
  testConnection,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { AppUser, AuthContextType, UserRole } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initial connection health check
  useEffect(() => {
    testConnection();
  }, []);

  // Helper to sync Firebase Auth user to Firestore collection 'users'
  const syncUserWithFirestore = async (fbUser: FirebaseUser): Promise<AppUser> => {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const isAdminCandidate = isAdminEmail(fbUser.email);
    const assignedRole: UserRole = isAdminCandidate ? 'admin' : 'user';

    try {
      const snap = await getDoc(userDocRef);

      if (!snap.exists()) {
        // User does not exist in 'users' collection -> Create new record
        const newUser: AppUser = {
          uid: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || '',
          role: assignedRole,
          createdAt: fbUser.metadata?.creationTime ? new Date(fbUser.metadata.creationTime).toISOString() : new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        try {
          await setDoc(userDocRef, newUser);
        } catch (err) {
          // If we fail to write because we are offline, it's non-fatal for the session
          console.warn('Failed to create user record (offline?):', err);
        }

        return newUser;
      } else {
        // User already exists in Firestore -> check role elevation & lastLogin update
        const existingData = snap.data() as AppUser;
        const nowIso = new Date().toISOString();

        // Auto-detect admin: If the hardcoded admin email logs in, automatically elevate role to 'admin'
        if (isAdminCandidate && existingData.role !== 'admin') {
          try {
            await updateDoc(userDocRef, {
              role: 'admin',
              lastLoginAt: nowIso,
            });
          } catch (err) {
            console.warn('Failed to elevate user to admin (offline?):', err);
          }

          return {
            ...existingData,
            name: existingData.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
            role: 'admin',
            lastLoginAt: nowIso,
            createdAt: existingData.createdAt || nowIso,
          };
        } else {
          // Regular existing user update lastLoginAt
          try {
            await updateDoc(userDocRef, {
              lastLoginAt: nowIso,
            });
          } catch {
            // Non-critical if update timestamp fails due to network
          }

          return {
            ...existingData,
            name: existingData.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
            role: existingData.role || (isAdminCandidate ? 'admin' : 'user'),
            lastLoginAt: nowIso,
            createdAt: existingData.createdAt || nowIso,
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('offline') || message.includes('unavailable')) {
        console.warn('Firestore is offline, using fallback user profile.');
        return {
          uid: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || '',
          role: assignedRole,
          createdAt: fbUser.metadata?.creationTime ? new Date(fbUser.metadata.creationTime).toISOString() : new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
      }
      handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
    }
  };

  // Listen to auth state changes and process redirect results
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          const appUserData = await syncUserWithFirestore(result.user);
          setFirebaseUser(result.user);
          setUser(appUserData);
        }
      })
      .catch((err: any) => {
        console.error('Google Redirect Sign-In Error:', err);
        if (
          err?.code !== 'auth/popup-blocked' &&
          err?.code !== 'auth/cancelled-popup-request' &&
          err?.code !== 'auth/popup-closed-by-user'
        ) {
          setAuthError(err instanceof Error ? err.message : 'Failed to complete Google Sign-In.');
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const appUserData = await syncUserWithFirestore(fbUser);
          setUser(appUserData);
        } catch (error) {
          console.error('Failed to sync user with Firestore:', error);
          // Fallback user state so app remains accessible
          setUser({
            uid: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || '',
            role: isAdminEmail(fbUser.email) ? 'admin' : 'user',
            createdAt: fbUser.metadata?.creationTime ? new Date(fbUser.metadata.creationTime).toISOString() : new Date().toISOString(),
          });
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google Sign-In with popup & redirect fallback
  const signInWithGoogle = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const appUserData = await syncUserWithFirestore(result.user);
      setFirebaseUser(result.user);
      setUser(appUserData);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      // Fallback to Redirect if popup-blocked occurs
      if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        console.log('Popup was blocked. Attempting Redirect Sign-In fallback...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          console.error('Redirect Fallback Error:', redirectErr);
          setAuthError('Sign-in popup was blocked, and redirect fallback failed. Please enable popups in your browser.');
        }
      } else if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('User closed the Google Sign-In popup before completing login.');
        setAuthError('Sign-in cancelled. Please try again when ready.');
      } else {
        const message =
          err instanceof Error ? err.message : 'Failed to complete Google Sign-In.';
        setAuthError(message);
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setUser(null);
    } catch (err: unknown) {
      console.error('Sign Out Error:', err);
      const message = err instanceof Error ? err.message : 'Failed to log out.';
      setAuthError(message);
    }
  };

  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || isAdminEmail(user?.email);
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      loading,
      isAdmin,
      signInWithGoogle,
      logout,
      authError,
      clearAuthError: () => setAuthError(null),
    }),
    [user, firebaseUser, loading, isAdmin, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
