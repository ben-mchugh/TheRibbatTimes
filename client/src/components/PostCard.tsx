import { Link } from 'wouter';
import { Post } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import '../styles/postcard.css';

interface PostCardProps {
  post: Post;
  profile?: any; // Optional profile to use if post.author is missing
}

const PostCard = ({ post, profile }: PostCardProps) => {
  const formattedDate = formatDate(post.createdAt);

  return (
    <Link href={`/post/${post.id}`} className="block">
      <Card className="post-card shadow overflow-hidden sm:rounded-lg cursor-pointer transform transition-all duration-300 ease-out hover:shadow-2xl hover:scale-[1.01] hover:shadow-[0_15px_30px_-8px_rgba(53,42,30,0.4)]" 
        style={{ backgroundColor: "#e0d3af" }}>
        <CardContent className="p-0">
          <div className="px-4 py-5 sm:px-6 flex justify-between">
            <div>
              <h2 className="text-xl font-heading font-bold" style={{ color: "#161718" }}>{post.title}</h2>
              <div className="mt-1 flex items-center">
                <Avatar className="h-8 w-8">
                  <AvatarImage 
                    src={post.author?.photoURL || profile?.photoURL || ''} 
                    alt={post.author?.displayName || profile?.displayName || 'User'} 
                  />
                  <AvatarFallback>
                    {(post.author?.displayName || profile?.displayName || 'U').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="ml-2 text-sm" style={{ color: "#161718" }}>
                  {post.author?.displayName || profile?.displayName || 'User'}
                </span>
                <span className="mx-2" style={{ color: "#444444" }}>•</span>
                <span className="text-sm" style={{ color: "#161718" }}>{formattedDate}</span>
              </div>
            </div>
          </div>
          <div className="px-4 py-4 sm:px-6 border-t" style={{ borderColor: "#a67a48" }}>
            <p className="line-clamp-3" style={{ color: "#161718" }}>
              {/* Display a plain text preview from the content (strip HTML) */}
              {post.content.replace(/<[^>]*>/g, '').substring(0, 250)}...
            </p>
            <div className="mt-3 flex items-center text-sm" style={{ color: "#a67a48" }}>
              <MessageSquare className="h-5 w-5 mr-1" style={{ color: "#a67a48" }} />
              <span>{post.commentCount} comments</span>
              {post.tags && post.tags.length > 0 && (
                <>
                  <span className="mx-2">•</span>
                  <span>{post.tags.join(', ')}</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default PostCard;
