import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  threshold?: number; // Scroll threshold in pixels when button appears
  label?: string;
}

const ScrollToTopButton = ({
  threshold = 300,
  label = 'Scroll to Latest'
}: ScrollToTopButtonProps) => {
  const [isVisible, setIsVisible] = useState(false);

  // Toggle button visibility based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Listen to scroll events
    window.addEventListener('scroll', handleScroll);
    
    // Check initial scroll position
    handleScroll();
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  // Scroll to top with smooth animation
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const [isHovered, setIsHovered] = useState(false);

  return isVisible ? (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 transition-all duration-300 animate-fade-in"
      style={{ 
        backgroundColor: isHovered ? '#8a5a28' : '#a67a48', 
        color: 'white',
        border: 'none',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 10px 25px -5px rgba(53,42,30,0.6)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Scroll to the top of the page"
    >
      <ArrowUp className="h-4 w-4" />
      {label}
    </Button>
  ) : null;
};

export default ScrollToTopButton;