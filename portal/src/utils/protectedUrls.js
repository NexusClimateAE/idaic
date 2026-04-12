/**
 * Utility functions for generating protected page URLs
 * 
 * These URLs force users to log in before accessing specific content pages.
 * After login, users are automatically redirected to the requested page.
 */

const BASE_URL = (import.meta.env.VITE_PORTAL_BASE_URL || window.location.origin || 'https://portal.idaic.org').replace(/\/$/, '');

/**
 * Generate a protected URL for a specific page
 * @param {string} page - The page identifier (e.g., 'uk', 'mena', 'content', 'events')
 * @param {string} baseUrl - Optional base URL (defaults to production URL)
 * @returns {string} Protected URL that requires login
 * 
 * @example
 * // UK Chapter page
 * getProtectedUrl('uk')
 * // Returns: 'https://portal.idaic.org/app?page=uk'
 * 
 * @example
 * // MENA Chapter page
 * getProtectedUrl('mena')
 * // Returns: 'https://portal.idaic.org/app?page=mena'
 * 
 * @example
 * // Content page
 * getProtectedUrl('content')
 * // Returns: 'https://portal.idaic.org/app?page=content'
 */
export function getProtectedUrl(page, baseUrl = BASE_URL) {
  if (!page) {
    throw new Error('Page parameter is required');
  }
  
  // Valid page identifiers
  const validPages = [
    'home',
    'content',
    'case-studies',
    'events',
    'members',
    'uk',
    'mena',
    'climate-solutions',
    'uae-climate',
    'feedback',
    'changelog',
    'settings',
    'projects'
  ];
  
  if (!validPages.includes(page)) {
    console.warn(`Warning: "${page}" is not a recognized page identifier. It will still work but may not be a valid page.`);
  }
  
  return `${baseUrl}/app?page=${encodeURIComponent(page)}`;
}

/**
 * Generate protected URLs for common pages
 */
export const ProtectedUrls = {
  uk: () => getProtectedUrl('uk'),
  mena: () => getProtectedUrl('mena'),
  content: () => getProtectedUrl('content'),
  events: () => getProtectedUrl('events'),
  members: () => getProtectedUrl('members'),
  caseStudies: () => getProtectedUrl('case-studies'),
  climateSolutions: () => getProtectedUrl('climate-solutions'),
  uaeClimate: () => getProtectedUrl('uae-climate'),
  feedback: () => getProtectedUrl('feedback'),
  changelog: () => getProtectedUrl('changelog'),
  settings: () => getProtectedUrl('settings'),
  projects: () => getProtectedUrl('projects'),
};

/**
 * Example usage:
 * 
 * // In an email or external link:
 * <a href="https://portal.idaic.org/app?page=uk">View UK Chapter</a>
 * 
 * // Or using the utility:
 * import { getProtectedUrl } from './utils/protectedUrls';
 * const ukUrl = getProtectedUrl('uk');
 * 
 * // After clicking the link:
 * // 1. User is redirected to login page if not authenticated
 * // 2. After successful login, user is redirected to /app?page=uk
 * // 3. App.jsx reads the page parameter and displays the UK Chapter page
 */

