import { useParams } from 'wouter';
import PostView from '@/components/PostView';

export default function ViewPost() {
  const { id } = useParams();
  
  if (!id) {
    return <div>Post not found</div>;
  }
  
  return <PostView postId={parseInt(id)} />;
}
