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
          <p className="mt-2 text-lg">
            The Official Ribbat Meat CO. Website
          </p>
        </div>
        
        <PostList />
      </div>
    </div>
  );
}
