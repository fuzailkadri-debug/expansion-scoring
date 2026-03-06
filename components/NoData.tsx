import Link from 'next/link';
import { Upload } from 'lucide-react';

export default function NoData() {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <Upload className="w-10 h-10 text-gray-300 mb-3" />
      <h3 className="text-lg font-semibold text-gray-700">No data loaded</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Upload your Salesforce export on the home page to get started.
      </p>
      <Link
        href="/"
        className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-light transition-colors"
      >
        Go to Data Upload
      </Link>
    </div>
  );
}
