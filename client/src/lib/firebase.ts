import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  signOut,
  User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || ""}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || ""}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

console.log("Firebase config:", {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? "Set" : "Not set",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? "Set" : "Not set",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ? "Set" : "Not set"
});

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.error("Firebase configuration is incomplete. Please check environment variables.");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Add additional scopes if needed
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

// Check for redirect result on page load
export const checkRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const user = result.user;
      await sendUserToBackend(user);
      return user;
    }
    return null;
  } catch (error) {
    console.error("Error checking redirect result", error);
    return null;
  }
};

// Helper to send user info to backend
const sendUserToBackend = async (user: User) => {
  try {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }),
      credentials: 'include',
    });
  } catch (error) {
    console.error("Error sending user to backend", error);
  }
};

// Try popup first, fall back to redirect
export const signInWithGoogle = async () => {
  try {
    // For demo purposes, check for development or test environment to use mock user
    if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
      console.log("Using mock user for development");
      
      // Create a mock user for demo purposes
      const mockUser = {
        uid: "demo-user-123",
        email: "demo@example.com",
        displayName: "Demo User",
        photoURL: "https://randomuser.me/api/portraits/men/42.jpg",
        getIdToken: () => Promise.resolve("mock-id-token")
      } as unknown as User;
      
      // Send mock user to backend
      await sendUserToBackend(mockUser);
      
      // Use a timeout to simulate network request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Manually trigger the onAuthStateChanged listener
      setTimeout(() => {
        const authStateObservers = (auth as any)._authStateObservers;
        if (authStateObservers && authStateObservers.length > 0) {
          authStateObservers.forEach((observer: any) => {
            if (typeof observer === 'function') {
              observer(mockUser);
            }
          });
        }
      }, 100);
      
      return mockUser;
    }
    
    // Normal Firebase authentication flow for production
    try {
      // Try popup first (works better in most browsers)
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await sendUserToBackend(user);
      return user;
    } catch (popupError: any) {
      console.log("Popup signin failed, trying redirect...", popupError);
      
      // Check for unauthorized domain error
      if (popupError?.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.origin;
        throw {
          code: 'auth/unauthorized-domain',
          message: `Your Replit domain "${currentDomain}" needs to be added to Firebase authorized domains. Please go to the Firebase console > Authentication > Sign-in methods > Authorized domains and add this domain.`,
          domain: currentDomain
        };
      }
      
      // If popup fails for other reasons (e.g., on mobile or blocked), try redirect
      await signInWithRedirect(auth, googleProvider);
      // User will be redirected away, result handled in checkRedirectResult
      return null;
    }
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    // For demo purposes, check for development or test environment
    if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
      console.log("Using mock signout for development");
      
      // Manually trigger the onAuthStateChanged listener with null to simulate logout
      setTimeout(() => {
        const authStateObservers = (auth as any)._authStateObservers;
        if (authStateObservers && authStateObservers.length > 0) {
          authStateObservers.forEach((observer: any) => {
            if (typeof observer === 'function') {
              observer(null);
            }
          });
        }
      }, 100);
      
      // Use a timeout to simulate network request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return;
    }
    
    // Normal signout flow for production
    await signOut(auth);
    // Clear session on backend
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export { auth };
