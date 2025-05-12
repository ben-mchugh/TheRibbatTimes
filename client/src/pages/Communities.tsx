import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const communities = [
  {
    id: 1,
    name: 'Politics & Current Events',
    description: 'Discussing global politics, policy analysis, and current events.',
    members: 372,
    image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400'
  },
  {
    id: 2,
    name: 'Arts & Culture',
    description: 'Exploring literature, film, music, and the evolving cultural landscape.',
    members: 215,
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400'
  },
  {
    id: 3,
    name: 'Technology & Innovation',
    description: 'Covering tech trends, digital transformation, and the future of work.',
    members: 289,
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400'
  }
];

export default function Communities() {
  // Set page title
  useEffect(() => {
    document.title = 'Topic Groups - The Ribbat Times';
  }, []);

  return (
    <div className="py-6 px-4 sm:px-0">
      <h1 className="text-3xl font-heading font-bold text-neutral-900 mb-4">Topic Groups</h1>
      <p className="text-lg text-neutral-700 mb-8">Join discussion groups focused on your interests and engage with like-minded readers.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {communities.map((community) => (
          <Card key={community.id} className="overflow-hidden">
            <div className="h-48 bg-primary-light bg-opacity-20">
              <img 
                src={community.image} 
                alt={community.name} 
                className="object-cover w-full h-full"
              />
            </div>
            <CardContent className="p-5">
              <h3 className="text-lg font-heading font-semibold">{community.name}</h3>
              <p className="text-neutral-600 mt-2">{community.description}</p>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-neutral-500">{community.members} members</span>
                <Button 
                  variant="outline" 
                  className="text-primary bg-primary-light bg-opacity-10 hover:bg-opacity-20"
                >
                  Join
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
