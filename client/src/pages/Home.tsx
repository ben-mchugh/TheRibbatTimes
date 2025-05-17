import { useEffect, useState } from 'react';
import PostList from '@/components/PostList';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import MonthNavigator from '@/components/MonthNavigator';

export default function Home() {
  const [isReturnedFromPost, setIsReturnedFromPost] = useState(false);

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

  return (
    <div className="py-6">
      <div className="space-y-8">
        <div className="px-4 sm:px-0">
          <p className="mt-2 text-lg">
            The Official Ribbat Meat CO. Website
          </p>
        </div>
        
        <PostList isReturnedFromPost={isReturnedFromPost} />
        
        {/* Navigation buttons */}
        <ScrollToTopButton threshold={300} label="Scroll to Latest" />
        <MonthNavigator threshold={300} />
      </div>
    </div>
  );
}
