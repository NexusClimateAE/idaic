import { useState } from 'react';
import { colors } from '../config/colors';
import { getProtectedUrl } from '../utils/protectedUrls';

export default function ProtectedUrls() {
  const [copiedUrl, setCopiedUrl] = useState(null);
  const baseUrl = (import.meta.env.VITE_PORTAL_BASE_URL || window.location.origin || 'https://portal.idaic.org').replace(/\/$/, '');

  const protectedPages = [
    { key: 'uk', name: 'UK Chapter', description: 'UK Chapter page with updates and member information' },
    { key: 'mena', name: 'MENA Chapter', description: 'MENA Chapter page with updates and member information' },
    { key: 'content', name: 'Content', description: 'Main content page with articles and resources' },
    { key: 'case-studies', name: 'Case Studies', description: 'Case studies and success stories' },
    { key: 'events', name: 'Events', description: 'Upcoming and past events' },
    { key: 'members', name: 'Members', description: 'Member directory and profiles' },
    { key: 'climate-solutions', name: 'Climate Solutions', description: 'Climate solutions and initiatives' },
    { key: 'uae-climate', name: 'UAE Climate', description: 'UAE-specific climate content' },
    { key: 'feedback', name: 'Feedback', description: 'Submit feedback and suggestions' },
    { key: 'changelog', name: 'Changelog', description: 'Recent updates and changes' },
    { key: 'settings', name: 'Settings', description: 'User settings and preferences' },
    { key: 'projects', name: 'Projects', description: 'Project listings and details' },
  ];

  const copyToClipboard = async (url, pageKey) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(pageKey);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedUrl(pageKey);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Protected Page URLs</h1>
            <p className="mt-2 text-sm text-gray-600">
              These URLs require users to log in before accessing the content. After login, users are automatically redirected to the requested page.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">How to use:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Copy any URL below to share with users</li>
          <li>Users will be prompted to log in if not already authenticated</li>
          <li>After login, they'll be automatically redirected to the requested page</li>
          <li>Perfect for email newsletters, social media, or direct links</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {protectedPages.map((page) => {
          const url = getProtectedUrl(page.key, baseUrl);
          const isCopied = copiedUrl === page.key;

          return (
            <div
              key={page.key}
              className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{page.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{page.description}</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 break-all">
                    <code className="text-sm text-gray-800 font-mono">{url}</code>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => copyToClipboard(url, page.key)}
                    className={`
                      px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
                      ${isCopied
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                      }
                    `}
                    style={!isCopied ? { backgroundColor: colors.primary.orange } : {}}
                  >
                    {isCopied ? '✓ Copied!' : 'Copy URL'}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 whitespace-nowrap"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong className="text-gray-700">URL Format:</strong>
            <code className="block mt-1 text-gray-600 font-mono bg-white p-2 rounded border">
              {baseUrl}/app?page=&lt;page-key&gt;
            </code>
          </div>
          <div>
            <strong className="text-gray-700">Example:</strong>
            <code className="block mt-1 text-gray-600 font-mono bg-white p-2 rounded border">
              {baseUrl}/app?page=uk
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

