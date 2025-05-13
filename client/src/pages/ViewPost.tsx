import { useParams } from 'wouter';
import GoogleDocsPostView from '@/components/GoogleDocsPostView';

export default function ViewPost() {
  const { id } = useParams();
  
  if (!id) {
    return <div>Post not found</div>;
  }
  
  return <GoogleDocsPostView postId={parseInt(id)} />;
}
