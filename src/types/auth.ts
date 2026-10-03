export type UserRole = 'admin' | 'user';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthContextType {
  user: AppUser | null;
  firebaseUser: import('firebase/auth').User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}
