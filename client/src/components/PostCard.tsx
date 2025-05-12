import { Link } from 'wouter';
import { Post } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: Post;
}

const PostCard = ({ post }: PostCardProps) => {
  const formattedDate = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <Card className="post-card shadow overflow-hidden sm:rounded-lg">
      <CardContent className="p-0">
        <div className="px-4 py-5 sm:px-6 flex justify-between">
          <div>
            <h2 className="text-xl font-heading font-bold">{post.title}</h2>
            <div className="mt-1 flex items-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={post.author.photoURL} alt={post.author.displayName} />
                <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="ml-2 text-sm text-neutral-700">{post.author.displayName}</span>
              <span className="mx-2 text-neutral-300">•</span>
              <span className="text-sm text-neutral-500">{formattedDate}</span>
            </div>
          </div>
          <Link href={`/post/${post.id}`}>
            <Button variant="ghost" className="inline-flex items-center px-3 py-1.5 text-sm text-primary bg-primary-light bg-opacity-10 hover:bg-opacity-20">
              Read More
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </Link>
        </div>
        <div className="px-4 py-4 sm:px-6 border-t border-neutral-200">
          <p className="line-clamp-3">
            {/* Display a plain text preview from the content (strip HTML) */}
            {post.content.replace(/<[^>]*>/g, '').substring(0, 250)}...
          </p>
          <div className="mt-3 flex items-center text-sm text-neutral-600">
            <MessageSquare className="h-5 w-5 mr-1 text-neutral-400" />
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
