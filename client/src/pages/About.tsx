import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function About() {
  // Set page title
  useEffect(() => {
    document.title = 'About - The Ribbat Times';
  }, []);

  return (
    <div className="py-6 px-4 sm:px-0">
      <h1 className="text-3xl font-heading font-bold text-neutral-900 mb-4">About The Ribbat Times</h1>
      <Card>
        <CardContent className="px-4 py-5 sm:p-6">
          <p className="text-neutral-700 mb-4">
            The Ribbat Times is a modern news and opinion platform that encourages thoughtful discussions and diverse perspectives. Our unique approach allows readers to comment directly on specific segments of articles, creating meaningful conversations in the margins.
          </p>
          <p className="text-neutral-700 mb-4">
            Founded in 2023 by a group of journalists and technologists, The Ribbat Times has grown into a vibrant community focused on quality journalism and reader engagement.
          </p>
          <h2 className="text-xl font-heading font-semibold mt-6 mb-4">Our Values</h2>
          <ul className="list-disc pl-5 space-y-2 text-neutral-700">
            <li>Quality journalism with integrity and depth</li>
            <li>Reader engagement through meaningful discussion</li>
            <li>Diverse perspectives and thoughtful debate</li>
            <li>Innovation in digital publishing and reader interaction</li>
            <li>Transparency and accountability in reporting</li>
          </ul>
          <h2 className="text-xl font-heading font-semibold mt-6 mb-4">Contact Us</h2>
          <p className="text-neutral-700">
            Have questions or suggestions? Reach out to us at <a href="mailto:editors@ribbattimes.com" className="text-primary hover:underline">editors@ribbattimes.com</a> or join our weekly reader forum on Wednesdays at 6 PM EST.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
