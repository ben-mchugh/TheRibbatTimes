import { useParams } from 'wouter';
import GoogleDocsPostView from '@/components/GoogleDocsPostView';
import { useEffect } from 'react';

export default function ViewPost() {
  const { id } = useParams();
  
  // Scroll to top of the page when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  if (!id) {
    return <div>Post not found</div>;
  }
  
  return <GoogleDocsPostView postId={parseInt(id)} />;
}
