import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { signInWithGoogle, signOutUser } from '@/lib/firebase';
import { PlusIcon, UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Header() {
  const [location] = useLocation();
  const { currentUser, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast({
        title: 'Signed in successfully',
        description: 'Welcome to The Ribbat Times!',
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      if (error?.code === 'auth/unauthorized-domain') {
        // Show more helpful message for unauthorized domain error
        const domain = error?.domain || window.location.origin;
        toast({
          title: 'Firebase Domain Error',
          description: `${domain} needs to be added to Firebase authorized domains. Please check the Firebase console.`,
          variant: 'destructive',
          duration: 10000, // Show longer to give user time to read
        });
      } else {
        toast({
          title: 'Sign in failed',
          description: 'Unable to sign in with Google. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully.',
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: 'Sign out failed',
        description: 'Unable to sign out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <header className="shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <img 
                  src="/images/ribbat_times_logo.png" 
                  alt="The Ribbat Times" 
                  className="h-14 cursor-pointer"
                />
              </Link>
            </div>
            <nav className="hidden sm:ml-8 sm:flex sm:space-x-5 sm:items-center">
              <Link href="/">
                <a className={`nav-link inline-flex items-center px-1 pt-1 border-b-2 ${
                  location === '/' ? 'border-[#f6dda7] text-[#f6dda7]' : 'border-transparent text-gray-300 hover:text-[#f6dda7]'
                }`}>
                  Posts
                </a>
              </Link>
              <Link href="/resources">
                <a className={`nav-link inline-flex items-center px-1 pt-1 border-b-2 ${
                  location === '/resources' ? 'border-[#f6dda7] text-[#f6dda7]' : 'border-transparent text-gray-300 hover:text-[#f6dda7]'
                }`}>
                  Notes
                </a>
              </Link>
              <Link href="/communities">
                <a className={`nav-link inline-flex items-center px-1 pt-1 border-b-2 ${
                  location === '/communities' ? 'border-[#f6dda7] text-[#f6dda7]' : 'border-transparent text-gray-300 hover:text-[#f6dda7]'
                }`}>
                  Doigs on Payroll
                </a>
              </Link>
              <Link href="/about">
                <a className={`nav-link inline-flex items-center px-1 pt-1 border-b-2 ${
                  location === '/about' ? 'border-[#f6dda7] text-[#f6dda7]' : 'border-transparent text-gray-300 hover:text-[#f6dda7]'
                }`}>
                  About
                </a>
              </Link>
            </nav>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {!loading && (
              !currentUser ? (
                <Button onClick={handleSignIn} className="flex items-center signin-button">
                  <UserIcon className="h-5 w-5 mr-2" />
                  Sign in
                </Button>
              ) : (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Avatar className="h-8 w-8 cursor-pointer">
                        <AvatarImage src={currentUser.photoURL || ''} alt={currentUser.displayName || 'User'} />
                        <AvatarFallback>{currentUser.displayName?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>{currentUser.displayName || 'User'}</DropdownMenuItem>
                      <DropdownMenuItem disabled>{currentUser.email || ''}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile">Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings">Settings</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Link href="/new">
                    <Button className="ml-3 flex items-center" style={{ backgroundColor: "#43ac78", color: "white" }}>
                      <PlusIcon className="h-5 w-5 mr-2" />
                      New Post
                    </Button>
                  </Link>
                </>
              )
            )}
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <Button 
              variant="ghost" 
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-neutral-700 hover:text-primary hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              aria-controls="mobile-menu"
              aria-expanded={menuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {!menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden" id="mobile-menu">
          <div className="pt-2 pb-3 space-y-1">
            <Link href="/">
              <a 
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location === '/' 
                    ? 'bg-primary-light text-white border-primary' 
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-primary border-transparent'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                Posts
              </a>
            </Link>
            <Link href="/resources">
              <a 
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location === '/resources' 
                    ? 'bg-primary-light text-white border-primary' 
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-primary border-transparent'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                Notes
              </a>
            </Link>
            <Link href="/communities">
              <a 
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location === '/communities' 
                    ? 'bg-primary-light text-white border-primary' 
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-primary border-transparent'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                Doigs on Payroll
              </a>
            </Link>
            <Link href="/about">
              <a 
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location === '/about' 
                    ? 'bg-primary-light text-white border-primary' 
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-primary border-transparent'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                About
              </a>
            </Link>
          </div>
          <div className="pt-4 pb-3 border-t border-neutral-200">
            {!loading && (
              !currentUser ? (
                <div className="flex items-center px-4">
                  <Button 
                    onClick={() => {
                      handleSignIn();
                      setMenuOpen(false);
                    }} 
                    className="w-full flex items-center justify-center signin-button"
                  >
                    <UserIcon className="h-5 w-5 mr-2" />
                    Sign in
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center px-4">
                    <div className="flex-shrink-0">
                      <Avatar>
                        <AvatarImage src={currentUser.photoURL || ''} alt={currentUser.displayName || 'User'} />
                        <AvatarFallback>{currentUser.displayName?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium text-neutral-800">{currentUser.displayName}</div>
                      <div className="text-sm font-medium text-neutral-500">{currentUser.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <Link href="/profile">
                      <a 
                        className="block px-4 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-100 hover:text-primary"
                        onClick={() => setMenuOpen(false)}
                      >
                        Your Profile
                      </a>
                    </Link>
                    <Link href="/settings">
                      <a 
                        className="block px-4 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-100 hover:text-primary"
                        onClick={() => setMenuOpen(false)}
                      >
                        Settings
                      </a>
                    </Link>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        handleSignOut();
                        setMenuOpen(false);
                      }}
                      className="w-full justify-start px-4 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-100 hover:text-primary"
                    >
                      Sign out
                    </Button>
                    <Link href="/new">
                      <a 
                        className="block px-4 py-2 text-base font-medium flex items-center"
                        style={{ backgroundColor: "#43ac78", color: "white", borderRadius: "0.25rem", margin: "0.5rem 1rem" }}
                        onClick={() => setMenuOpen(false)}
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        New Post
                      </a>
                    </Link>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </header>
  );
}
