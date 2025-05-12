import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { auth, checkRedirectResult } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

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
        }
      } catch (error) {
        console.error('Redirect result error:', error);
      }
    };
    
    checkForRedirect();
  }, [toast]);

  // Setup auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        setCurrentUser(user);
        setLoading(false);
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
  }, [toast]);

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