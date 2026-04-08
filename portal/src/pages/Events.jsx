import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import EventForm from './EventForm';
import PortalAssets from '../components/MainEventImage';
import Favicon from '../components/Favicon';
import { colors } from '../config/colors';

// Custom hook to fetch events
function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/events');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError('Failed to load events');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return { events, loading, error, refetch: fetchEvents };
}

// Function to determine if an event is organized by IDAIC
function isIdaicEvent(event) {
  // First check if manually marked as IDAIC event
  if (event.is_idaic_event === true) {
    return true;
  }
  
  if (!event.registration_link) return false;
  
  try {
    const url = new URL(event.registration_link);
    const hostname = url.hostname.toLowerCase();
    
    // Check for IDAIC-related domains or Teams meeting indicators
    const idaicIndicators = [
      'idaic.org',
      'idaic.com',
      'teams.microsoft.com',
      'teams.live.com',
      'microsoft.com'
    ];
    
    // Check if the hostname contains any IDAIC indicators
    return idaicIndicators.some(indicator => hostname.includes(indicator));
  } catch (error) {
    // If URL parsing fails, check if the link contains IDAIC-related text
    const linkText = event.registration_link.toLowerCase();
    return linkText.includes('idaic') || linkText.includes('teams.microsoft');
  }
}

export default function Events() {
  const { isAdminAuthenticated } = useOutletContext();
  const { events, loading, error, refetch } = useEvents();
  const [formError, setFormError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [idaicOrg, setIdaicOrg] = useState(null);

  // Fetch IDAIC organization from database
  useEffect(() => {
    const fetchIdaicOrg = async () => {
      try {
        const response = await fetch('/.netlify/functions/orgs');
        if (response.ok) {
          const orgs = await response.json();
          // Find IDAIC organization - check for various possible names
          const idaic = orgs.find(org => 
            org.name && (
              org.name.toLowerCase().includes('idaic') ||
              org.name.toLowerCase() === 'idaic'
            ) && org.logo_url
          );
          if (idaic) {
            setIdaicOrg(idaic);
          }
        }
      } catch (err) {
        console.error('Error fetching IDAIC organization:', err);
      }
    };
    fetchIdaicOrg();
  }, []);

  // Compute unique locations for filter dropdown
  const uniqueLocations = Array.from(new Set(events.map(e => e.location).filter(Boolean)));
  // Always include "UK" as a filter option
  const allLocations = Array.from(new Set([...uniqueLocations, 'UK'])).sort();
  const filteredEvents = locationFilter ? events.filter(e => e.location === locationFilter) : events;

  const handleAdd = async (event) => {
    try {
      const eventData = {
        title: event.title,
        event_date: event.event_date,
        location: event.location,
        description: event.description, // add description
        registration_link: event.registration_link, // keep as optional
        is_idaic_event: event.is_idaic_event || false
      };
      const response = await fetch('/.netlify/functions/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add event');
      }
      setDrawerOpen(false);
      setFormError('');
      await refetch();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleUpdate = async (id, updates) => {
    try {
      const updateData = {
        title: updates.title,
        event_date: updates.event_date,
        location: updates.location,
        description: updates.description, // add description
        registration_link: updates.registration_link, // keep as optional
        is_idaic_event: updates.is_idaic_event || false
      };
      const response = await fetch(`/.netlify/functions/events?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event');
      }
      setDrawerOpen(false);
      setFormError('');
      await refetch();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/.netlify/functions/events?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete event');
      }
      setDrawerOpen(false);
      setFormError('');
      await refetch();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const openDrawer = (event) => {
    setSelectedEvent(event);
    setIsAdding(false);
    setDrawerOpen(true);
  };

  const openAddDrawer = () => {
    setSelectedEvent({ title: '', event_date: '', location: '', description: '', registration_link: '', is_idaic_event: false });
    setIsAdding(true);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedEvent(null);
    setIsAdding(false);
    setFormError('');
  };

  const handleFormSubmit = async (event) => {
    if (!event.title || !event.event_date || !event.location) {
      setFormError('Title, date, and location are required.');
      return false;
    }
    if (isAdding) {
      await handleAdd(event);
    } else {
      await handleUpdate(event.id, event);
    }
    setFormError('');
    return true;
  };

  const handleEventUpdate = (updatedEvent) => {
    setSelectedEvent(updatedEvent);
  };

  return (
    <div className="py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Events</h1>
          <nav className="mt-4 sm:mt-0">
            <ul className="flex space-x-4" role="tablist">
              <li>
                <button
                  type="button"
                  className="px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-150 focus:outline-none border-transparent text-orange-600 hover:text-orange-700 hover:border-orange-300 bg-transparent"
                  style={{ color: colors.primary.orange, borderColor: colors.primary.orange }}
                  onClick={openAddDrawer}
                  role="tab"
                  aria-selected="false"
                >
                  Add event
                </button>
              </li>
            </ul>
          </nav>
        </div>
        {/* Location Filter Dropdown */}
        {allLocations.length > 0 && (
          <div className="mt-4">
            <label htmlFor="location-filter" className="mr-2 text-sm font-medium text-gray-700">Filter by location:</label>
            <select
              id="location-filter"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {allLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* Events Grid Section */}
      <div className="bg-white border rounded-lg p-4 sm:p-6 mb-6">
        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading events...</div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredEvents.map((event, idx) => (
              <button
                key={event.id || idx}
                type="button"
                onClick={() => openDrawer(event)}
                className="relative bg-gray-100 p-0 flex flex-col rounded-lg transition border-2 focus:outline-none hover:border-orange-200 border-transparent"
                style={{ color: colors.text.primary, fontFamily: 'Inter, sans-serif' }}
              >
                {/* Favicon/Logo in bottom-right corner */}
                {(event.id || event.registration_link || isIdaicEvent(event)) && (
                  <div className="absolute bottom-2 right-2 z-10">
                    {(event.id || isIdaicEvent(event)) ? (
                      <div 
                        className="bg-white rounded-full p-1.5 shadow-sm border border-gray-200 flex items-center justify-center overflow-hidden"
                        style={{ width: 40, height: 40 }}
                        title="IDAIC Event"
                      >
                        {idaicOrg && idaicOrg.logo_url ? (
                          <img 
                            src={idaicOrg.logo_url} 
                            alt="IDAIC Logo" 
                            className="w-full h-full object-contain"
                            style={{ maxWidth: '36px', maxHeight: '36px' }}
                          />
                        ) : (
                          <Favicon url="https://www.idaic.org/" size={36} />
                        )}
                      </div>
                    ) : (
                      <Favicon url={event.registration_link?.trim()} size={40} />
                    )}
                  </div>
                )}
                <div className="flex flex-row items-stretch h-full w-full">
                  <div className="flex flex-col items-start px-6 pt-6 pb-2 min-w-[180px] max-w-[240px] flex-shrink-0 w-full">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-0 text-left w-full truncate" title={event.title}>{event.title}</h2>
                    <div className="text-xs sm:text-sm text-gray-500 text-left mt-1 w-full">{event.location}</div>
                    <div className="flex justify-start w-full">
                      <div className="h-1 bg-orange-500 rounded-full my-2" style={{ width: '90%' }} />
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-0 text-left w-full">
                  {/* Description */}
                  {event.description && (
                    <div className="text-xs sm:text-sm text-gray-700 w-full mt-0 mb-2">{event.description}</div>
                  )}
                  {/* Horizontal line after description */}
                  <hr className="my-2 border-gray-300" />
                  {/* Registration Link below the line */}
                  <div className="text-xs sm:text-sm text-gray-700 w-full mt-0">
                    {event.id ? (
                      <a 
                        href={`/events-${event.id}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="underline text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Register for Event
                      </a>
                    ) : event.registration_link ? (
                      <a 
                        href={event.registration_link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="underline text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Registration Link
                      </a>
                    ) : (
                      <span className="text-gray-400">No registration link</span>
                    )}
                  </div>
                </div>
                <div className="absolute top-2 sm:top-3 right-2 sm:right-4 text-xs font-medium" style={{ color: colors.primary.orange }}>
                  {event.event_date ? new Date(event.event_date).toLocaleDateString() : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Main Upcoming Event Section */}
      <PortalAssets isAdmin={isAdminAuthenticated} />
      
      <EventForm
        drawerOpen={drawerOpen}
        selectedEvent={selectedEvent}
        isAdding={isAdding}
        formError={formError}
        onClose={closeDrawer}
        onSubmit={handleFormSubmit}
        onDelete={handleDelete}
        onEventUpdate={handleEventUpdate}
      />
    </div>
  );
} 