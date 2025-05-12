import { useEffect } from 'react';
import PostList from '@/components/PostList';

export default function Home() {
  // Set page title
  useEffect(() => {
    document.title = 'The Ribbat Times - News and Opinions';
  }, []);

  return (
    <div className="py-6">
      <div className="space-y-8">
        <div className="px-4 sm:px-0">
          <h1 className="text-3xl site-title">The Ribbat Times</h1>
          <p className="mt-2 text-lg">
            A monthly newsletter of thoughts, opinions, and news from our community.
          </p>
        </div>
        
        <PostList />
      </div>
    </div>
  );
}
