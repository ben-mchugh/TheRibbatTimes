import { useParams, useLocation } from 'wouter';
import GoogleDocsPostView from '@/components/GoogleDocsPostView';
import { useEffect } from 'react';

export default function ViewPost() {
  const { id } = useParams();
  const [location] = useLocation();
  
  // Scroll to top of the page when component mounts
  useEffect(() => {
    // This ensures posts always start at the top
    window.scrollTo(0, 0);
    
    // Save the current view in session storage to help with the back button experience
    if (id) {
      sessionStorage.setItem('lastViewedPost', id);
    }
  }, [id, location]);
  
  if (!id) {
    return <div>Post not found</div>;
  }
  
  return <GoogleDocsPostView postId={parseInt(id)} />;
}
