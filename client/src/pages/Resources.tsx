import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileTextIcon, Calculator } from 'lucide-react';

export default function Resources() {
  // Set page title
  useEffect(() => {
    document.title = 'Resources - The Ribbat Times';
  }, []);

  return (
    <div className="py-6 px-4 sm:px-0">
      <h1 className="text-3xl font-heading font-bold text-neutral-900 mb-4">Resources</h1>
      <p className="text-lg text-neutral-700 mb-8">
        Access guides, research materials, and tools to enhance your reading and discussion experience.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xl font-heading font-semibold">Guides & References</h3>
            <ul className="mt-4 space-y-3">
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Guide to Margin Commenting
                </a>
              </li>
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Research Methodology Guidelines
                </a>
              </li>
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Citation and Sourcing Standards
                </a>
              </li>
              <li className="flex">
                <FileTextIcon className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Community Discussion Guidelines
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xl font-heading font-semibold">Tools & Resources</h3>
            <ul className="mt-4 space-y-3">
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Topic Research Database
                </a>
              </li>
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Source Fact-Checking Tool
                </a>
              </li>
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Article Readability Analyzer
                </a>
              </li>
              <li className="flex">
                <Calculator className="h-6 w-6 text-primary" />
                <a href="#" className="ml-2 text-neutral-700 hover:text-primary">
                  Community Discussion Templates
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
