import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const communities = [
  {
    id: 1,
    name: 'Urban Garden Network',
    description: 'A coalition of 15 urban gardens sharing resources and knowledge.',
    members: 48,
    image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400'
  },
  {
    id: 2,
    name: 'Sustainable Eco Villages',
    description: 'Connecting off-grid communities focused on regenerative living.',
    members: 87,
    image: 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400'
  },
  {
    id: 3,
    name: 'City Sustainability Alliance',
    description: 'Working with local government to implement green policies.',
    members: 124,
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400'
  }
];

export default function Communities() {
  // Set page title
  useEffect(() => {
    document.title = 'Communities - EcoConnect';
  }, []);

  return (
    <div className="py-6 px-4 sm:px-0">
      <h1 className="text-3xl font-heading font-bold text-neutral-900 mb-4">Communities</h1>
      <p className="text-lg text-neutral-700 mb-8">Connect with sustainable communities around the world.</p>
      
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
