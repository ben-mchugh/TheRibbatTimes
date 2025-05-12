import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileTextIcon, Calculator } from 'lucide-react';

export default function Resources() {
  // Set page title
  useEffect(() => {
    document.title = 'Resources - EcoConnect';
  }, []);

  return (
    <div className="py-6 px-4 sm:px-0">
      <h1 className="text-3xl font-heading font-bold text-neutral-900 mb-4">Resources</h1>
      <p className="text-lg text-neutral-700 mb-8">
        Access guides, tools, and educational materials to support your sustainability journey.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xl font-heading font-semibold">Guides & Tutorials</h3>
            <ul className="mt-4 space-y-3">
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Beginner's Guide to Community Composting
                </a>
              </li>
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  DIY Rainwater Harvesting Systems
                </a>
              </li>
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Urban Gardening in Small Spaces
                </a>
              </li>
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Community Resource Sharing Systems
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xl font-heading font-semibold">Tools & Calculators</h3>
            <ul className="mt-4 space-y-3">
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Carbon Footprint Calculator
                </a>
              </li>
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Garden Planting Calendar
                </a>
              </li>
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Water Usage Tracker
                </a>
              </li>
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Community Project Budget Template
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
