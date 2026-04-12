import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Favicon from '../components/Favicon';

export default function EventForm({ 
  drawerOpen, 
  selectedEvent, 
  isAdding, 
  formError, 
  onClose, 
  onSubmit, 
  onDelete,
  onEventUpdate 
}) {
  const portalBaseUrl = (import.meta.env.VITE_PORTAL_BASE_URL || window.location.origin || 'https://portal.idaic.org').replace(/\/$/, '');
  const [readOnly, setReadOnly] = useState(true);
  const [localEvent, setLocalEvent] = useState(selectedEvent);
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

  useEffect(() => {
    if (isAdding) {
      setReadOnly(false);
    } else {
      setReadOnly(true);
    }
    setLocalEvent(selectedEvent);
  }, [drawerOpen, selectedEvent, isAdding]);

  const handleFieldChange = (field, value) => {
    const updated = { ...localEvent, [field]: value };
    setLocalEvent(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    const result = await onSubmit(localEvent);
    if (!result || result !== false) {
      setReadOnly(true);
      onEventUpdate(localEvent);
    }
  };

  const handleEdit = () => {
    setReadOnly(false);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteClick = () => {
    if (readOnly) return;
    setShowDeleteConfirm(true);
    setDeleteInput('');
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (deleteInput !== String(localEvent.id)) {
      setDeleteError('Record ID does not match.');
      return;
    }
    setDeleteLoading(true);
    try {
      await onDelete(localEvent.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setDeleteError('Failed to delete. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Dialog open={drawerOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/20 transition-opacity duration-500" aria-hidden="true" onClick={onClose}></div>
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-4 sm:pl-10 lg:pl-16">
            <DialogPanel className="pointer-events-auto w-screen max-w-sm sm:max-w-md transform transition duration-500 ease-in-out bg-white shadow-xl flex flex-col h-full">
              <div className="px-4 py-4 sm:py-6 sm:px-6 flex items-start justify-between border-b border-gray-200">
                <DialogTitle className="text-sm sm:text-base font-semibold text-gray-900">
                  {isAdding ? 'Add Event' : 'Event Details'}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {/* IDAIC Icon in right corner when event is IDAIC organized */}
                  {localEvent && (localEvent.is_idaic_event === true || 
                    localEvent.id || 
                    (localEvent.registration_link && (
                      localEvent.registration_link.toLowerCase().includes('idaic') ||
                      localEvent.registration_link.toLowerCase().includes('teams.microsoft')
                    ))) && (
                    <div 
                      className="bg-white rounded-full p-1 shadow-sm border border-gray-200 flex items-center justify-center overflow-hidden"
                      style={{ width: 28, height: 28 }}
                      title="IDAIC Event"
                    >
                      {idaicOrg && idaicOrg.logo_url ? (
                        <img 
                          src={idaicOrg.logo_url} 
                          alt="IDAIC Logo" 
                          className="w-full h-full object-contain"
                          style={{ maxWidth: '24px', maxHeight: '24px' }}
                        />
                      ) : (
                        <Favicon url="https://www.idaic.org/" size={24} />
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="relative rounded-md bg-white text-gray-400 hover:text-gray-500 focus-visible:ring-2 focus-visible:ring-orange-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close panel</span>
                    <XMarkIcon className="size-6" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {localEvent && (
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="event-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        id="event-title"
                        type="text"
                        name="title"
                        value={localEvent.title}
                        onChange={e => handleFieldChange('title', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        required
                        readOnly={readOnly}
                      />
                    </div>
                    <div>
                      <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
                      <input
                        id="event-date"
                        type="date"
                        name="event_date"
                        value={localEvent.event_date}
                        onChange={e => handleFieldChange('event_date', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        required
                        readOnly={readOnly}
                      />
                    </div>
                    <div>
                      <label htmlFor="event-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <input
                        id="event-location"
                        type="text"
                        name="location"
                        value={localEvent.location}
                        onChange={e => handleFieldChange('location', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        required
                        readOnly={readOnly}
                      />
                    </div>
                    <div>
                      <label htmlFor="event-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        id="event-description"
                        name="description"
                        value={localEvent.description || ''}
                        onChange={e => handleFieldChange('description', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        rows={3}
                        readOnly={readOnly}
                        placeholder="Enter event description"
                      />
                    </div>
                    {localEvent.id ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration URL</label>
                        <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-700">
                          <a 
                            href={`/events-${localEvent.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {`${portalBaseUrl}/events-${localEvent.id}`}
                          </a>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">This event has an automatic registration page</p>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="registration-link" className="block text-sm font-medium text-gray-700 mb-1">Online Event Link</label>
                        <input
                          id="registration-link"
                          type="url"
                          name="registration_link"
                          value={localEvent.registration_link || ''}
                          onChange={e => handleFieldChange('registration_link', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                          readOnly={readOnly}
                          placeholder="Paste online event link here (e.g., Teams meeting link)"
                        />
                      </div>
                    )}
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={localEvent.is_idaic_event || false}
                          onChange={e => handleFieldChange('is_idaic_event', e.target.checked)}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          disabled={readOnly}
                        />
                        <span className="text-sm font-medium text-gray-700">IDAIC Organized Event</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Check this if this event is organized by IDAIC (will show IDAIC logo instead of external favicon)</p>
                    </div>
                    {localEvent.updated_at && (
                      <div className="text-xs text-gray-400 mb-0">
                        Updated at: {new Date(localEvent.updated_at).toUTCString()}
                      </div>
                    )}
                    {localEvent.created_at && (
                      <div className="text-xs text-gray-400 mt-0 mb-0">
                        Created at: {new Date(localEvent.created_at).toUTCString()}
                      </div>
                    )}
                    {localEvent.id && localEvent.created_at && (
                      <div className="text-xs text-gray-400 mt-0 mb-0">
                        Record ID: {localEvent.id}
                      </div>
                    )}
                    {formError && <div className="text-red-500 text-sm">{formError}</div>}
                    <div className="flex justify-end gap-2 pt-2">
                      {isAdding ? (
                        <button
                          type="submit"
                          className="px-3 sm:px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 text-sm"
                        >
                          Save
                        </button>
                      ) : !readOnly && (
                        <button
                          type="submit"
                          className="px-3 sm:px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 text-sm"
                        >
                          Update
                        </button>
                      )}
                    </div>
                  </form>
                  {/* Edit and Delete buttons */}
                  {!isAdding && readOnly && (
                    <div className="flex flex-col items-end gap-2 pt-2">
                      <button
                        type="button"
                        className="px-3 sm:px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 text-sm"
                        onClick={handleEdit}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  {!isAdding && !readOnly && (
                    <div className="flex flex-col items-end gap-2 pt-2 relative">
                      <button
                        type="button"
                        className="px-3 sm:px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 text-sm"
                        onClick={handleEdit}
                        disabled
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-3 sm:px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 text-sm mt-2"
                        onClick={handleDeleteClick}
                        id="delete-btn"
                      >
                        Delete
                      </button>
                      {showDeleteConfirm && (
                        <div className="absolute right-0 mt-2 z-50 bg-white rounded-lg shadow-lg p-4 w-64 flex flex-col items-center border border-gray-200">
                          <div className="text-base font-semibold mb-2 text-gray-900">Confirm Deletion</div>
                          <div className="text-xs text-gray-600 mb-2 text-center">To delete this record, type the ID <span className="font-mono font-bold">{localEvent.id}</span> below and click Confirm.</div>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
                            value={deleteInput}
                            onChange={e => setDeleteInput(e.target.value)}
                            placeholder="Enter record ID"
                            disabled={deleteLoading}
                          />
                          {deleteError && <div className="text-xs text-red-500 mb-2">{deleteError}</div>}
                          <div className="flex gap-2 w-full justify-end">
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                              onClick={handleDeleteConfirm}
                              disabled={deleteLoading}
                            >
                              {deleteLoading ? 'Deleting...' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </DialogPanel>
          </div>
        </div>
      </div>
    </Dialog>
  );
} 