import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import { User } from '@/lib/types';
import { formatDate } from '@/lib/dateUtils';
import { CalendarIcon, MailIcon, UserIcon, NewspaperIcon } from 'lucide-react';
import { getQueryFn } from '@/lib/queryClient';

export default function DoigsOnPayroll() {
  // Set page title
  useEffect(() => {
    document.title = 'Doigs on Payroll - The Ribbat Times';
  }, []);

  // Fetch all users
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-heading font-bold text-[#f6dda7] mb-4">Doigs on Payroll</h1>
      <p className="text-xl text-gray-300 mb-10">Meet the writers, editors, and contributors who make The Ribbat Times possible.</p>
      
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="overflow-hidden bg-[#e0d3af] text-[#161718]">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[60%]" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-10">
          <p className="text-xl text-red-500">Failed to load team members</p>
          <p className="text-gray-400">Please try again later</p>
        </div>
      )}
      
      {users && users.length === 0 && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-400">No team members found</p>
          <p className="text-gray-500">Check back soon as our team grows!</p>
        </div>
      )}

      {users && users.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user: User) => (
            <Card key={user.id} className="overflow-hidden bg-[#e0d3af] text-[#161718] hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16 border-2 border-[#f6dda7]">
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
                    <AvatarFallback className="bg-[#161718] text-white text-xl">
                      {user.displayName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-heading font-bold">{user.displayName}</h3>
                    <p className="text-gray-700 text-sm">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center text-sm text-gray-700">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>Joined {formatDate(user.createdAt)}</span>
                  </div>
                  
                  <Link href={`/profile/${user.id}`}>
                    <div className="flex items-center mt-4 text-[#b36226] hover:text-[#954908] cursor-pointer">
                      <NewspaperIcon className="h-4 w-4 mr-2" />
                      <span>See all articles</span>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
