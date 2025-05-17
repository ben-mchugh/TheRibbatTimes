import { useEffect, useState } from 'react';
import PostList from '@/components/PostList';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { Post } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Link } from 'wouter';

export default function Home() {
  const [isReturnedFromPost, setIsReturnedFromPost] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);

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
        return new Date(b).getTime() - new Date(a).getTime();
      });
      
      setMonthOptions(sortedMonths);
    }
  }, [posts]);

  // Set page title and handle scroll restoration
  useEffect(() => {
    document.title = 'The Ribbat Times - News and Opinions';
    
    // Check if we have a lastViewedPost in sessionStorage
    // This means we're returning from a post view
    const lastViewedPost = sessionStorage.getItem('lastViewedPost');
    
    if (lastViewedPost) {
      // Set a flag to indicate we've returned from a post
      setIsReturnedFromPost(true);
      // Clear the lastViewedPost from sessionStorage
      sessionStorage.removeItem('lastViewedPost');
    }
  }, []);

  // Scroll to the selected month section
  const scrollToMonth = (monthYear: string) => {
    // Create ID from the month year (same logic as in PostList)
    const monthYearId = monthYear.toLowerCase().replace(/\s+/g, '-');
    
    // Try to find the element by ID first (more reliable)
    const targetElement = document.getElementById(monthYearId);
    
    if (targetElement) {
      // Scroll to the element
      window.scrollTo({
        top: targetElement.getBoundingClientRect().top + window.scrollY - 20,
        behavior: 'smooth'
      });
    } else {
      // Fallback: try to find by heading text
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
        }
      }, 50);
    }
  };

  return (
    <div className="py-6">
      <div className="space-y-8">
        <div className="px-4 sm:px-0 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <p className="mt-2 text-lg">
            The Official Ribbat Meat CO. Website
          </p>
          
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            {monthOptions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    className="rounded-lg shadow-lg px-4 py-2 flex items-center gap-2"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{ 
                      backgroundColor: isHovered ? '#8a5a28' : '#a67a48', 
                      color: 'white',
                      border: 'none',
                      boxShadow: isHovered 
                        ? '0 10px 25px -5px rgba(53,42,30,0.6)' 
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease'
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
            )}
          </div>
        </div>
        
        <PostList isReturnedFromPost={isReturnedFromPost} />
        
        {/* Scroll to top button - appears after scrolling down 300px */}
        <ScrollToTopButton threshold={300} label="Scroll to Latest" />
      </div>
    </div>
  );
}
