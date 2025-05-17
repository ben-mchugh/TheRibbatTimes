/**
 * Authentication Context and Hook
 * 
 * This module provides authentication functionality throughout the app.
 * It includes:
 * - Context provider that wraps the entire application
 * - User authentication state management
 * - Firebase auth integration with Google sign-in
 * - User persistence in both Firebase and our backend
 * - Loading states during authentication operations
 * - Automatic user synchronization with backend
 */

import { createContext, useState, useContext, useEffect, ReactNode, useMemo } from 'react';
import { auth, checkRedirectResult, sendUserToBackend } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Synchronize Firebase user with backend
  const syncUserWithBackend = useMemo(() => {
    return async (user: User) => {
      try {
        if (user) {
          // Send user to backend and update TanStack Query cache
          const backendUser = await sendUserToBackend(user);
          
          // If we got a valid response, update the query cache
          if (backendUser) {
            queryClient.setQueryData(['/api/profile'], backendUser);
            
            // Pre-fetch user posts to improve profile page load time
            if (backendUser.id) {
              queryClient.prefetchQuery({
                queryKey: [`/api/users/${backendUser.id}/posts`],
                staleTime: 1000 * 60 * 5, // 5 minutes
              });
            }
          }
        }
      } catch (error) {
        console.error('Error syncing user with backend:', error);
      }
    };
  }, [queryClient]);

  // Check for redirect result when component mounts
  useEffect(() => {
    const checkForRedirect = async () => {
      try {
        const redirectUser = await checkRedirectResult();
        if (redirectUser) {
          setCurrentUser(redirectUser);
          toast({
            title: 'Sign in successful',
            description: `Welcome ${redirectUser.displayName || 'back'}!`,
          });
          
          // Sync with backend after successful redirect
          await syncUserWithBackend(redirectUser);
        }
      } catch (error) {
        console.error('Redirect result error:', error);
      }
    };
    
    checkForRedirect();
  }, [toast, syncUserWithBackend]);

  // Setup auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        setCurrentUser(user);
        setLoading(false);
        
        // Sync existing user when auth state changes
        if (user) {
          syncUserWithBackend(user);
        } else {
          // If logged out, invalidate user-related queries
          queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
        }
      },
      (error) => {
        console.error('Auth state change error:', error);
        toast({
          title: 'Authentication Error',
          description: 'There was a problem with authentication. Please try again later.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [toast, syncUserWithBackend, queryClient]);

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Use named function declaration for better HMR compatibility
export function useAuth() {
  return useContext(AuthContext);
}