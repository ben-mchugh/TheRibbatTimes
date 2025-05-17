import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, X, MessageSquare } from 'lucide-react';

interface PostScrollControlsProps {
  showComments: boolean;
  setShowComments: (show: boolean) => void;
}

const PostScrollControls: React.FC<PostScrollControlsProps> = ({ 
  showComments, 
  setShowComments 
}) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrollButtonHovered, setIsScrollButtonHovered] = useState(false);
  
  // Track scroll position for buttons that appear when scrolling
  useEffect(() => {
    const handleScrollPosition = () => {
      setScrollPosition(window.scrollY);
    };
    
    // Check initial position
    handleScrollPosition();
    
    // Add scroll listener
    window.addEventListener('scroll', handleScrollPosition);
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScrollPosition);
    };
  }, []);

  return (
    <div>
      {scrollPosition > 300 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 animate-fade-in">
          {/* Scroll to Top button */}
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 transition-all duration-300"
            style={{ 
              backgroundColor: isScrollButtonHovered ? '#8a5a28' : '#a67a48', 
              color: 'white',
              border: 'none',
              transform: isScrollButtonHovered ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: isScrollButtonHovered 
                ? '0 10px 25px -5px rgba(53,42,30,0.6)' 
                : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={() => setIsScrollButtonHovered(true)}
            onMouseLeave={() => setIsScrollButtonHovered(false)}
            aria-label="Scroll to the top of the page"
          >
            <ChevronUp className="h-4 w-4" />
            Scroll to Top
          </Button>
          
          {/* Button controls as a row below the scroll button */}
          <div className="flex items-center gap-2">
            {/* Comments toggle button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className={`bg-[#e8e8e8]/80 hover:bg-[#e8e8e8] text-[#444444] hover:text-[#222222] rounded-full w-10 h-10 flex items-center justify-center p-0 shadow-md ${showComments ? 'opacity-100' : 'opacity-80'}`}
              title={showComments ? "Hide comments" : "Show comments"}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            
            {/* Close button */}
            <a href="/">
              <Button
                variant="ghost"
                size="sm"
                className="bg-[#e8e8e8]/80 hover:bg-[#e8e8e8] text-[#444444] hover:text-[#222222] rounded-full w-10 h-10 flex items-center justify-center p-0 shadow-md"
                title="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostScrollControls;