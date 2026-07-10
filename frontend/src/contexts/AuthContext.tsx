import React, { createContext, useContext, useState, useEffect } from 'react'
import { auth, googleProvider } from '../firebase'
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider } from 'firebase/auth'
import { useNotifications } from './NotificationContext'

interface User {
  uid: string
  displayName: string
  email: string
  photoURL: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { addNotification } = useNotifications()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const [isSigningIn, setIsSigningIn] = useState(false)

  const signInWithGoogle = () => {
    if (isSigningIn) return Promise.reject(new Error("Sign-in already in progress"));
    setIsSigningIn(true);
    
    return signInWithPopup(auth, googleProvider)
      .then((result) => {
        // Retrieve the Google OAuth Access Token if you need to call Google APIs
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        
        // The signed-in user information
        const user = result.user;
        console.log("Successfully signed in user:", user.displayName);
        addNotification('success', 'Successfully signed in with Google!');
      })
      .catch((error) => {
        console.error("Sign-in failed:", error.code, error.message);
        if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
          addNotification('error', error.message || 'Failed to sign in with Google.');
        }
        throw error;
      })
      .finally(() => {
        setIsSigningIn(false);
      });
  }

  const logout = async () => {
    try {
      await signOut(auth)
      addNotification('info', 'Logged out successfully.')
    } catch (error: any) {
      console.error(error)
      addNotification('error', 'Failed to log out.')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
