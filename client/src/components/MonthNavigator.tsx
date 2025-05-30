/**
 * MonthNavigator Component
 * 
 * This component provides a dropdown menu for navigating to specific months in the post timeline.
 * Features include:
 * - Automatically generates a list of months from available posts
 * - Formats month/year options in a user-friendly way
 * - Scrolls the page to the selected month's section
 * - Appears with a smooth animation effect
 * - Positioned fixed at the bottom of the viewport for easy access
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Post } from '@/lib/types';
import { format, parseISO } from 'date-fns';

interface MonthNavigatorProps {
  threshold?: number; // Not used but kept for API compatibility
}

const MonthNavigator = ({ threshold = 300 }: MonthNavigatorProps) => {
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  // Fetch posts to extract month options
  const { data: posts } = useQuery<Post[]>({
    queryKey: ['/api/posts'],
  });

  // Extract unique month-year combinations from posts
  useEffect(() => {
    if (posts && posts.length > 0) {
      const monthYearSet = new Set<string>();
      
      posts.forEach(post => {
        const date = parseISO(post.createdAt);
        const monthYear = format(date, 'MMMM yyyy');
        monthYearSet.add(monthYear);
      });
      
      // Sort in reverse chronological order (newest first)
      const sortedMonths = Array.from(monthYearSet).sort((a, b) => {
        // Convert month names to date objects for sorting
        return new Date(b).getTime() - new Date(a).getTime();
      });
      
      setMonthOptions(sortedMonths);
    }
  }, [posts]);

  // Scroll to the selected month section
  const scrollToMonth = (monthYear: string) => {
    // Create ID from the month year (same logic as in PostList)
    const monthYearId = monthYear.toLowerCase().replace(/\s+/g, '-');
    
    // Try to find the element by ID first (more reliable)
    const targetElement = document.getElementById(monthYearId);
    
    if (targetElement) {
      // Scroll to the element
      window.scrollTo({
        top: targetElement.getBoundingClientRect().top + window.scrollY - 20, // 20px offset for better viewing
        behavior: 'smooth'
      });
    } else {
      // Fallback: try to find by heading text if ID approach fails
      setTimeout(() => {
        const headings = Array.from(document.querySelectorAll('h2.monthly-header'));
        const targetHeading = headings.find(heading => 
          heading.textContent && heading.textContent.includes(monthYear)
        );
        
        if (targetHeading) {
          window.scrollTo({
            top: targetHeading.getBoundingClientRect().top + window.scrollY - 20,
            behavior: 'smooth'
          });
        } else {
          console.log(`Could not find heading for ${monthYear}`);
        }
      }, 50);
    }
  };

  if (monthOptions.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed top-4 right-4 z-50 animate-fade-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.3s ease'
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            className="rounded-lg shadow-lg px-4 py-2 flex items-center gap-2"
            style={{ 
              backgroundColor: isHovered ? '#8a5a28' : '#a67a48', 
              color: 'white',
              border: 'none',
              boxShadow: isHovered 
                ? '0 10px 25px -5px rgba(53,42,30,0.6)' 
                : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            Go To Month
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end"
          className="bg-white border border-neutral-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {monthOptions.map((monthYear) => (
            <DropdownMenuItem 
              key={monthYear}
              onClick={() => scrollToMonth(monthYear)}
              className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100 text-neutral-800"
            >
              {monthYear}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default MonthNavigator;