import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function About() {
  // Set page title
  useEffect(() => {
    document.title = 'About - EcoConnect';
  }, []);

  return (
    <div className="py-6 px-4 sm:px-0">
      <h1 className="text-3xl font-heading font-bold text-neutral-900 mb-4">About EcoConnect</h1>
      <Card>
        <CardContent className="px-4 py-5 sm:p-6">
          <p className="text-neutral-700 mb-4">
            EcoConnect is a platform dedicated to helping individuals and communities implement sustainable practices through knowledge sharing and collaboration. Our mission is to make sustainable living accessible to everyone.
          </p>
          <p className="text-neutral-700 mb-4">
            Founded in 2020 by a group of environmental activists and community organizers, EcoConnect has grown into a vibrant community of over 5,000 members across the globe.
          </p>
          <h2 className="text-xl font-heading font-semibold mt-6 mb-4">Our Values</h2>
          <ul className="list-disc pl-5 space-y-2 text-neutral-700">
            <li>Knowledge should be freely accessible to all</li>
            <li>Small local actions create global impact</li>
            <li>Community-driven solutions are more sustainable</li>
            <li>Environmental justice and social equity are interconnected</li>
            <li>Practical implementation trumps perfect theory</li>
          </ul>
          <h2 className="text-xl font-heading font-semibold mt-6 mb-4">Contact Us</h2>
          <p className="text-neutral-700">
            Have questions or suggestions? Reach out to us at <a href="mailto:info@ecoconnect.org" className="text-primary hover:underline">info@ecoconnect.org</a> or join our weekly community call on Thursdays at 7 PM EST.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
