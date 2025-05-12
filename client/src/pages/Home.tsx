import { useEffect } from 'react';
import PostList from '@/components/PostList';

export default function Home() {
  // Set page title
  useEffect(() => {
    document.title = 'EcoConnect - Sustainable Community Blog';
  }, []);

  return (
    <div className="py-6">
      <div className="space-y-8">
        <div className="px-4 sm:px-0">
          <h1 className="text-3xl font-heading font-bold text-neutral-900">Latest Posts</h1>
          <p className="mt-2 text-lg text-neutral-700">
            Join the conversation about sustainable community building and resource management.
          </p>
        </div>
        
        <PostList />
      </div>
    </div>
  );
}
