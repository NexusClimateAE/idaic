import React from 'react';
import App from '../App';
import Events from '../pages/Events';
import EventsAdmin from '../pages/EventsAdmin';
import Settings from '../pages/Settings';
import Organizations from '../pages/Organizations';
import Projects from '../pages/projects';
import UserAdmin from '../pages/UserAdmin';
import Home from '../pages/Home';
import Members from '../pages/Members';
import UKChapter from '../pages/UKChapter';
import MENAChapter from '../pages/MENAChapter';
import Feedback from '../pages/Feedback';
import Admin from '../pages/Admin';
import NewUserForm from '../pages/NewUserForm';
import PersonalInfo from '../pages/PersonalInfo';
import LogoManager from '../pages/LogoManager';
import ProtectedUrls from '../pages/ProtectedUrls';

/**
 * A generic page component that renders an iframe.
 * Used for legacy pages and external content during migration.
 */
const IframePage = ({ src, title }) => (
  <div className="w-full h-full min-h-0 flex" style={{ margin: 0, padding: 0, background: 'none', border: 'none' }}>
    <iframe
      src={src}
      title={title}
      style={{ width: '100%', height: '100%', border: 'none', margin: 0, padding: 0, background: 'none', flex: 1 }}
      allowFullScreen
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
    />
  </div>
);

/**
 * Route registry mapping component keys from routes.json 
 * to real page components.
 */
export const routeRegistry = {
  'App': App,
  'Events': Events,
  'EventsAdmin': EventsAdmin,
  'Settings': Settings,
  'Organizations': Organizations,
  'Projects': Projects,
  'UserAdmin': UserAdmin,
  'Home': Home,
  'Members': Members,
  'UKChapter': UKChapter,
  'MENAChapter': MENAChapter,
  'Feedback': Feedback,
  'Admin': Admin,
  'NewUserForm': NewUserForm,
  'PersonalInfo': PersonalInfo,
  'LogoManager': LogoManager,
  'ProtectedUrls': ProtectedUrls,
  
  // Iframe-based pages
  'ContentIframe': () => <IframePage src="https://members.nexusclimate.co/" title="IDAIC Content" />,
  'CaseStudiesIframe': () => <IframePage src="https://members.nexusclimate.co/tag/case-study/" title="IDAIC Case Studies" />,
  'ClimateSolutionsIframe': () => <IframePage src="https://climatesolutions.news/" title="Climate Solutions News" />,
  'DecarbonisationIframe': () => <IframePage src="https://decarbonisation.news/" title="Decarbonisation News" />,
  'UAEClimateIframe': () => <IframePage src="https://uaenews.nexusclimate.vc/" title="UAE Climate News" />,
  'ChangelogIframe': () => <IframePage src="https://members.nexusclimate.co/tag/portal/" title="IDAIC Changelog" />,
};

/**
 * Returns a component for a given key, with fallback error handling.
 */
export const getComponent = (key) => {
  const Component = routeRegistry[key];
  if (!Component) {
    console.error(`Unknown component key: ${key}`);
    return () => (
      <div className="p-10 text-red-600 bg-red-50 border border-red-200 rounded-lg">
        <h1 className="text-xl font-bold">Error: Unknown Component</h1>
        <p>The component key "{key}" is not registered in routeRegistry.jsx</p>
      </div>
    );
  }
  return Component;
};
