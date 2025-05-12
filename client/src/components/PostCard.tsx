import { Link } from 'wouter';
import { Post } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

interface PostCardProps {
  post: Post;
}

const PostCard = ({ post }: PostCardProps) => {
  const formattedDate = formatDate(post.createdAt);

  return (
    <Card className="post-card shadow overflow-hidden sm:rounded-lg">
      <CardContent className="p-0">
        <div className="px-4 py-5 sm:px-6 flex justify-between">
          <div>
            <h2 className="text-xl font-heading font-bold" style={{ color: "#161718" }}>{post.title}</h2>
            <div className="mt-1 flex items-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={post.author.photoURL} alt={post.author.displayName} />
                <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="ml-2 text-sm" style={{ color: "#161718" }}>{post.author.displayName}</span>
              <span className="mx-2" style={{ color: "#a67a48" }}>•</span>
              <span className="text-sm" style={{ color: "#161718" }}>{formattedDate}</span>
            </div>
          </div>
          <Link href={`/post/${post.id}`}>
            <Button variant="ghost" className="inline-flex items-center px-3 py-1.5 text-sm bg-opacity-10 hover:bg-opacity-20" style={{ color: "#a67a48" }}>
              Read More
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </Link>
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
  );
};

export default PostCard;
