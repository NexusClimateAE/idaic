import { useState, useEffect, useRef } from 'react';
import { colors, font } from '../config/colors';
import { ErrorMessage, SuccessMessage } from '../components/ErrorMessage';

export default function EventsAdmin() {
  const portalBaseUrl = (import.meta.env.VITE_PORTAL_BASE_URL || window.location.origin || 'https://portal.idaic.org').replace(/\/$/, '');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registrations, setRegistrations] = useState({}); // event_id -> registrations array
  const [polls, setPolls] = useState({}); // event_id -> poll data with votes
  const [collapsedSections, setCollapsedSections] = useState({}); // event_id -> boolean
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-dismiss error messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data);
      setError(null);
      
      // Fetch registrations and polls for each event
      for (const event of data) {
        await fetchRegistrations(event.id);
        if (event.poll_id) {
          await fetchPollData(event.id);
        }
      }
    } catch (err) {
      setError('Failed to load events: ' + err.message);
    }
    setLoading(false);
  };

  const fetchRegistrations = async (eventId) => {
    try {
      const response = await fetch(`/.netlify/functions/eventRegistrations?event_id=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setRegistrations(prev => ({ ...prev, [eventId]: data }));
      }
    } catch (err) {
      console.error('Error fetching registrations:', err);
    }
  };

  const fetchPollData = async (eventId) => {
    try {
      const response = await fetch(`/.netlify/functions/polls?event_id=${eventId}`);
      if (response.ok) {
        const pollData = await response.json();
        setPolls(prev => ({ ...prev, [eventId]: pollData }));
      }
    } catch (err) {
      console.error('Error fetching poll data:', err);
    }
  };

  const toggleSection = (eventId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  // Helper to convert datetime-local string to ISO string
  const datetimeLocalToISO = (datetimeLocal) => {
    if (!datetimeLocal) return null;
    // datetime-local gives us "YYYY-MM-DDTHH:mm" in local time
    // We create a Date object which interprets it as local time, then convert to ISO (UTC)
    const isoString = new Date(datetimeLocal).toISOString();
    console.log('🕐 Converting datetime-local to ISO:', { input: datetimeLocal, output: isoString });
    return isoString;
  };

  const handleCreateEvent = async (eventData) => {
    try {
      // Generate UUID for the event (backend will also generate if not provided)
      const eventId = crypto.randomUUID();
      // Exclude poll fields from event data, but keep reminder fields
      const { create_poll, poll_slot_1_date, poll_slot_1_start, poll_slot_1_end, poll_slot_2_date, poll_slot_2_start, poll_slot_2_end, poll_slot_3_date, poll_slot_3_start, poll_slot_3_end, poll_deadline_date, ...eventFields } = eventData;
      
      // Convert event_date from datetime-local format to ISO string
      const cleanedEventFields = { ...eventFields };
      if (cleanedEventFields.event_date) {
        cleanedEventFields.event_date = datetimeLocalToISO(cleanedEventFields.event_date);
      } else if (cleanedEventFields.event_date === '' || cleanedEventFields.event_date === null || cleanedEventFields.event_date === undefined) {
        delete cleanedEventFields.event_date;
      }
      
      const newEvent = {
        ...cleanedEventFields,
        id: eventId
      };

      const response = await fetch('/.netlify/functions/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }

      const createdEvent = await response.json();
      
      // Create poll if poll data is provided
      if (eventData.create_poll && eventData.poll_slot_1_date && eventData.poll_slot_1_start && eventData.poll_slot_1_end) {
        try {
          // Build time slots from date + time ranges
          const timeSlots = [];
          for (let i = 1; i <= 3; i++) {
            const date = eventData[`poll_slot_${i}_date`];
            const start = eventData[`poll_slot_${i}_start`];
            const end = eventData[`poll_slot_${i}_end`];
            if (date && start && end) {
              // Combine date and start time
              const startDateTime = new Date(`${date}T${start}`).toISOString();
              timeSlots.push(startDateTime);
            }
          }
          
          // Build deadline (date + 23:59:59)
          let deadline = null;
          if (eventData.poll_deadline_date) {
            deadline = new Date(`${eventData.poll_deadline_date}T23:59:59`).toISOString();
          }
          
          if (timeSlots.length === 3) {
            const pollResponse = await fetch('/.netlify/functions/polls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_id: createdEvent.id,
                time_slots: timeSlots,
                deadline: deadline
              })
            });
            
            if (pollResponse.ok) {
              const poll = await pollResponse.json();
              setSuccess(`Event and poll created successfully! Event URL: ${portalBaseUrl}/events-${createdEvent.id} | Poll URL: ${portalBaseUrl}/poll-${createdEvent.id}`);
            } else {
              setSuccess(`Event created successfully! Event URL: ${portalBaseUrl}/events-${createdEvent.id}`);
            }
          } else {
            setSuccess(`Event created successfully! Event URL: ${portalBaseUrl}/events-${createdEvent.id}`);
          }
        } catch (pollErr) {
          console.error('Error creating poll:', pollErr);
          setSuccess(`Event created successfully! Event URL: ${portalBaseUrl}/events-${createdEvent.id}`);
        }
      } else {
        setSuccess(`Event created successfully! Event URL: ${portalBaseUrl}/events-${createdEvent.id}`);
      }
      
      await fetchEvents();
      // Note: Modal will close itself via onClose in handleSubmit
    } catch (err) {
      setError('Failed to create event: ' + err.message);
    }
  };

  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      // Exclude poll fields from event data, but keep reminder fields
      const { create_poll, poll_slot_1_date, poll_slot_1_start, poll_slot_1_end, poll_slot_2_date, poll_slot_2_start, poll_slot_2_end, poll_slot_3_date, poll_slot_3_start, poll_slot_3_end, poll_deadline_date, enable_reminders, reminder_days_before, reminder_hour, ...eventFields } = eventData;
      
      // Handle reminder settings - only include if enabled
      if (enable_reminders !== undefined) {
        eventFields.enable_reminders = enable_reminders || false;
        if (enable_reminders) {
          eventFields.reminder_days_before = reminder_days_before || 1;
          eventFields.reminder_hour = reminder_hour || 9;
        } else {
          // Clear reminder settings when disabled
          eventFields.reminder_days_before = null;
          eventFields.reminder_hour = null;
        }
      }
      
      // Convert event_date from datetime-local format to ISO string
      const cleanedEventFields = { ...eventFields };
      if (cleanedEventFields.event_date) {
        cleanedEventFields.event_date = datetimeLocalToISO(cleanedEventFields.event_date);
      } else if (cleanedEventFields.event_date === '' || cleanedEventFields.event_date === null || cleanedEventFields.event_date === undefined) {
        delete cleanedEventFields.event_date;
      }
      
      // Ensure is_idaic_event is always true (all events are IDAIC events)
      cleanedEventFields.is_idaic_event = true;
      
      const response = await fetch(`/.netlify/functions/events?id=${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cleanedEventFields,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event');
      }

      setSuccess('Event updated successfully!');
      await fetchEvents();
      // Note: Modal will close itself via onClose in handleSubmit
    } catch (err) {
      setError('Failed to update event: ' + err.message);
    }
  };

  const handleCreatePoll = async (pollData) => {
    try {
      const response = await fetch('/.netlify/functions/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pollData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create poll');
      }

      const createdPoll = await response.json();
      setSuccess(`Poll created successfully! Poll URL: ${portalBaseUrl}/poll-${pollData.event_id}`);
      await fetchEvents();
      // Refresh poll data for the event
      if (pollData.event_id) {
        await fetchPollData(pollData.event_id);
      }
    } catch (err) {
      setError('Failed to create poll: ' + err.message);
    }
  };

  const handleClosePoll = async (event, poll) => {
    try {
      // Find the most voted option
      const voteCounts = poll.voteCounts || {};
      const timeSlots = poll.time_slots || [];
      
      if (timeSlots.length === 0) {
        setError('No time slots available in poll');
        return;
      }

      // Find the option with the most votes
      let maxVotes = 0;
      let mostVotedIndex = 0;
      timeSlots.forEach((_, index) => {
        const votes = voteCounts[index] || 0;
        if (votes > maxVotes) {
          maxVotes = votes;
          mostVotedIndex = index;
        }
      });

      // If no votes, default to first option
      if (maxVotes === 0) {
        console.warn('No votes found, using first time slot as default');
        mostVotedIndex = 0;
      }

      // Get the most voted time slot
      const mostVotedSlot = timeSlots[mostVotedIndex];
      
      if (!mostVotedSlot) {
        throw new Error('No valid time slot found to update event date');
      }
      
      // Ensure the date is in ISO format
      const eventDateToSet = new Date(mostVotedSlot).toISOString();
      console.log('Most voted slot:', mostVotedSlot, 'Index:', mostVotedIndex, 'Votes:', maxVotes, 'Formatted date:', eventDateToSet);
      
      // Close the poll by setting deadline to now
      const updateResponse = await fetch(`/.netlify/functions/polls?id=${poll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deadline: new Date().toISOString()
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to close poll');
      }

      // Update the event with the most voted time slot
      console.log('Updating event:', event.id, 'with date:', eventDateToSet);
      const eventUpdateResponse = await fetch(`/.netlify/functions/events?id=${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_date: eventDateToSet,
          updated_at: new Date().toISOString()
        })
      });

      if (!eventUpdateResponse.ok) {
        const errorData = await eventUpdateResponse.json();
        console.error('Failed to update event date. Response:', errorData);
        throw new Error(errorData.error || 'Failed to update event date');
      }

      const updatedEvent = await eventUpdateResponse.json();
      console.log('Event updated successfully. New event_date:', updatedEvent.event_date);
      
      // Verify the date was actually updated
      if (!updatedEvent.event_date) {
        throw new Error('Event date was not updated - event_date is still null');
      }
      
      // Verify it matches what we sent (allowing for slight time differences in formatting)
      const updatedDate = new Date(updatedEvent.event_date).toISOString();
      const expectedDate = new Date(eventDateToSet).toISOString();
      if (updatedDate !== expectedDate) {
        console.warn('Event date may have timezone differences. Expected:', expectedDate, 'Got:', updatedDate);
      }

      // Wait a moment to ensure database is fully updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send Slack notification (non-blocking)
      try {
        console.log('Sending Slack notification for poll:', poll.id, 'event:', event.id);
        const slackResponse = await fetch('/.netlify/functions/notifySlackPollClosed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poll_id: poll.id,
            event_id: event.id
          })
        });
        
        const slackResult = await slackResponse.json();
        console.log('Slack notification response:', slackResult);
        
        if (!slackResponse.ok) {
          console.error('Slack notification failed:', slackResult);
        } else {
          console.log('Slack notification sent successfully');
        }
      } catch (slackErr) {
        // Log but don't fail the operation if Slack notification fails
        console.error('Failed to send Slack notification:', slackErr);
      }

      // Format the date for display in success message
      const formattedDate = new Date(eventDateToSet).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dubai'
      }) + ' GST';
      
      setSuccess(`Poll closed successfully! Event date updated to ${formattedDate} (${maxVotes} ${maxVotes === 1 ? 'vote' : 'votes'}). Event is now active with a confirmed date and time.`);
      await fetchEvents();
      // Refresh poll data
      await fetchPollData(event.id);
    } catch (err) {
      setError('Failed to close poll: ' + err.message);
    }
  };

  const handleReopenPoll = async (event, poll) => {
    try {
      // Reopen the poll by setting deadline to 7 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const updateResponse = await fetch(`/.netlify/functions/polls?id=${poll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deadline: futureDate.toISOString()
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to reopen poll');
      }

      setSuccess('Poll reopened successfully! New deadline set to 7 days from now.');
      await fetchEvents();
      // Refresh poll data
      await fetchPollData(event.id);
    } catch (err) {
      setError('Failed to reopen poll: ' + err.message);
    }
  };

  const handleDeleteEventClick = (event) => {
    setEventToDelete(event);
    setShowDeleteConfirm(true);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/.netlify/functions/events?id=${eventToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete event');
      }

      setSuccess('Event deleted successfully!');
      setShowDeleteConfirm(false);
      setEventToDelete(null);
      await fetchEvents();
    } catch (err) {
      setError('Failed to delete event: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredEvents = events.filter(event =>
    event.title?.toLowerCase().includes(search.toLowerCase()) ||
    event.description?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-gray-500">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ fontFamily: font.primary }}>
      {error && <ErrorMessage message={error} onClose={() => setError('')} />}
      {success && <SuccessMessage message={success} onClose={() => setSuccess('')} />}

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
            Event Management
          </h2>
          <button
            onClick={() => {
              setSelectedEvent(null);
              setShowEventForm(true);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            Create New Event
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ color: colors.text.primary }}
          />
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.map((event) => {
          const eventRegistrations = registrations[event.id] || [];
          return (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2" style={{ color: colors.text.primary }}>
                    {event.title}
                  </h3>
                  <div className="space-y-1 text-sm" style={{ color: colors.text.secondary }}>
                    <div>
                      <strong>Date:</strong> {formatDate(event.event_date)}
                    </div>
                    {event.location && (
                      <div>
                        <strong>Location:</strong> {event.location}
                      </div>
                    )}
                    {event.description && (
                      <div className="mt-2">
                        <strong>Description:</strong>
                        <p className="mt-1">{event.description}</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <strong>Registration URL:</strong>{' '}
                      <a
                        href={`/events-${event.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:underline"
                      >
                        {`${portalBaseUrl}/events-${event.id}`}
                      </a>
                    </div>
                    {event.poll_id && (
                      <div className="mt-2">
                        <strong>Poll URL:</strong>{' '}
                        <a
                          href={`/poll-${event.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {`${portalBaseUrl}/poll-${event.id}`}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {!event.poll_id && (
                    <button
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowPollForm(true);
                      }}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Create Poll
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedEvent(event);
                      setShowEventForm(true);
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEventClick(event)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Poll Results Section */}
              {event.poll_id && polls[event.id] && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold" style={{ color: colors.text.primary }}>
                      Poll Results
                    </h4>
                    {(() => {
                      const poll = polls[event.id];
                      const deadline = poll.deadline ? new Date(poll.deadline) : null;
                      const now = new Date();
                      const isOpen = !deadline || now <= deadline;
                      
                      return (
                        <div className="flex gap-2 items-center">
                          <button
                            disabled
                            className={`px-3 py-1 text-sm rounded ${
                              isOpen
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                            title={deadline ? `Deadline: ${deadline.toLocaleString()}` : 'No deadline set'}
                          >
                            {isOpen ? 'Poll Open' : 'Poll Closed'}
                          </button>
                          {isOpen ? (
                            <button
                              onClick={() => handleClosePoll(event, poll)}
                              className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                              title="Close poll and set event date to most voted option"
                            >
                              Close Poll
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReopenPoll(event, poll)}
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              title="Reopen poll with new deadline"
                            >
                              Reopen Poll
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {(() => {
                    const poll = polls[event.id];
                    const voteCounts = poll.voteCounts || {};
                    const timeSlots = poll.time_slots || [];
                    
                    // Find max votes
                    const maxVotes = Math.max(...Object.values(voteCounts), 0);
                    
                    // Format date helper
                    const formatSlotDate = (slotDate) => {
                      const date = new Date(slotDate);
                      return date.toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    };
                    
                    // Get votes for each option
                    const votes = poll.votes || [];
                    const votesByOption = {};
                    timeSlots.forEach((_, index) => {
                      votesByOption[index] = votes.filter(v => 
                        (v.selected_slot_index !== undefined ? v.selected_slot_index : v.time_slot_index) === index
                      );
                    });
                    
                    return (
                      <div className="space-y-2">
                        {timeSlots.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {timeSlots.map((slot, index) => {
                              const optionVotes = votesByOption[index] || [];
                              const voteCount = voteCounts[index] || 0;
                              const isTopVoted = maxVotes > 0 && voteCount === maxVotes;
                              const voterNames = optionVotes.map(v => {
                                const name = v.name || '';
                                const email = v.email || '';
                                const company = v.company ? ` (${v.company})` : '';
                                return name ? `${name}${company}` : email || 'Anonymous';
                              }).filter(Boolean);
                              
                              return (
                                <div
                                  key={index}
                                  className={`relative group px-3 py-2 rounded-md text-sm cursor-help ${
                                    isTopVoted
                                      ? 'bg-blue-50 border-2 border-blue-300'
                                      : 'bg-gray-50 border border-gray-200'
                                  }`}
                                >
                                  <div className={`font-medium ${isTopVoted ? 'text-blue-900' : 'text-gray-900'}`}>
                                    Option {index + 1}: {formatSlotDate(slot)}
                                  </div>
                                  <div className={`text-xs mt-0.5 ${isTopVoted ? 'text-blue-700' : 'text-gray-600'}`}>
                                    {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                                    {isTopVoted && <span className="ml-1 font-semibold">(Most Voted)</span>}
                                  </div>
                                  
                                  {/* Hover tooltip */}
                                  {voterNames.length > 0 && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                                      <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg max-w-xs min-w-[200px]">
                                        <div className="font-semibold mb-1 pb-1 border-b border-gray-700">
                                          Voters ({voterNames.length}):
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                          {voterNames.map((name, idx) => (
                                            <div key={idx} className="py-0.5">
                                              {name}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                          <div className="border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No votes yet</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Registrations Section */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <button
                    onClick={() => toggleSection(event.id)}
                    className="flex items-center gap-2 font-semibold hover:text-orange-500 transition-colors"
                    style={{ color: colors.text.primary }}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${collapsedSections[event.id] ? '' : 'rotate-90'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Registrations ({eventRegistrations.length})
                  </button>
                  <button
                    onClick={() => fetchRegistrations(event.id)}
                    className="text-sm text-orange-500 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                {!collapsedSections[event.id] && (
                  <>
                    {eventRegistrations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2" style={{ color: colors.text.primary }}>Name</th>
                              <th className="text-left py-2 px-2" style={{ color: colors.text.primary }}>Email</th>
                              <th className="text-left py-2 px-2" style={{ color: colors.text.primary }}>Company</th>
                              <th className="text-left py-2 px-2" style={{ color: colors.text.primary }}>Type</th>
                              <th className="text-left py-2 px-2" style={{ color: colors.text.primary }}>Status</th>
                              <th className="text-left py-2 px-2" style={{ color: colors.text.primary }}>Registered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventRegistrations.map((reg, idx) => (
                              <tr key={reg.id || idx} className="border-b">
                                <td className="py-2 px-2" style={{ color: colors.text.primary }}>
                                  {reg.name || '—'}
                                </td>
                                <td className="py-2 px-2" style={{ color: colors.text.primary }}>
                                  {reg.email || '—'}
                                </td>
                                <td className="py-2 px-2" style={{ color: colors.text.primary }}>
                                  {reg.company || '—'}
                                </td>
                                <td className="py-2 px-2" style={{ color: colors.text.primary }}>
                                  {reg.registration_type === 'new' ? (
                                    <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800">
                                      New
                                    </span>
                                  ) : reg.user_role ? (
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      reg.user_role === 'admin' 
                                        ? 'bg-red-100 text-red-800'
                                        : reg.user_role === 'moderator'
                                        ? 'bg-purple-100 text-purple-800'
                                        : reg.user_role === 'member'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {reg.user_role.charAt(0).toUpperCase() + reg.user_role.slice(1)}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                                      External
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2" style={{ color: colors.text.primary }}>
                                  {reg.status === 'cancelled' ? (
                                    <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                                      Cancelled
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                                      Confirmed
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2" style={{ color: colors.text.secondary }}>
                                  {formatDate(reg.created_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No registrations yet</p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Form Modal */}
      {showEventForm && (
        <EventFormModal
          event={selectedEvent}
          onSave={async (eventId, eventData) => {
            if (eventId) {
              await handleUpdateEvent(eventId, eventData);
            } else {
              await handleCreateEvent(eventData);
            }
            // Don't close modal automatically - let user close it manually
          }}
          onEventCreated={(createdEvent) => {
            // Update selectedEvent when auto-save creates a new event
            setSelectedEvent(createdEvent);
          }}
          onClose={() => {
            setShowEventForm(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {/* Poll Form Modal */}
      {showPollForm && (
        <PollFormModal
          event={selectedEvent}
          onSave={async (pollData) => {
            await handleCreatePoll(pollData);
          }}
          onClose={() => {
            setShowPollForm(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="mt-2 text-center">
                <h3 className="text-lg font-medium text-gray-900">Delete Event</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete <strong>{eventToDelete?.title || 'this event'}</strong>? 
                    This action cannot be undone and will permanently remove the event and all its registrations from the database.
                  </p>
                </div>
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setEventToDelete(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteEvent}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Delete Event'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Poll Form Modal Component
function PollFormModal({ event, onSave, onClose }) {
  const [formData, setFormData] = useState({
    time_slot_1: '',
    time_slot_2: '',
    time_slot_3: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.time_slot_1 || !formData.time_slot_2 || !formData.time_slot_3) {
      setError('All three time slots are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const pollData = {
        event_id: event.id,
        time_slots: [
          formData.time_slot_1,
          formData.time_slot_2,
          formData.time_slot_3
        ]
      };
      await onSave(pollData);
      onClose();
      // Refresh events to show poll URL
      window.location.reload();
    } catch (err) {
      setError('Failed to create poll: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
            Create Poll for {event?.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Time Slot 1 *
            </label>
            <input
              type="datetime-local"
              value={formData.time_slot_1}
              onChange={(e) => setFormData({ ...formData, time_slot_1: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Time Slot 2 *
            </label>
            <input
              type="datetime-local"
              value={formData.time_slot_2}
              onChange={(e) => setFormData({ ...formData, time_slot_2: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Time Slot 3 *
            </label>
            <input
              type="datetime-local"
              value={formData.time_slot_3}
              onChange={(e) => setFormData({ ...formData, time_slot_3: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-orange-500 text-white rounded-md text-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Event Form Modal Component
function EventFormModal({ event, onSave, onClose }) {
  // Helper to convert UTC datetime to local datetime-local format
  const toLocalDateTimeString = (utcDateString) => {
    if (!utcDateString) return '';
    
    // Handle date-only strings (YYYY-MM-DD) by treating them as local dates, not UTC
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dateOnlyPattern.test(utcDateString)) {
      // Date-only string - add default time of noon to avoid timezone issues
      const result = `${utcDateString}T12:00`;
      console.log('🕐 Converting date-only to datetime-local:', { input: utcDateString, output: result, note: 'Set to 12:00 noon' });
      return result;
    }
    
    // Full datetime string - parse and convert to local timezone
    const date = new Date(utcDateString);
    // Use local time methods to get the components in user's timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    // Return in datetime-local format (YYYY-MM-DDTHH:mm)
    const result = `${year}-${month}-${day}T${hours}:${minutes}`;
    console.log('🕐 Converting UTC to datetime-local:', { input: utcDateString, output: result, userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    return result;
  };

  // Helper to convert datetime-local string to ISO string
  const datetimeLocalToISO = (datetimeLocal) => {
    if (!datetimeLocal) return null;
    // datetime-local gives us "YYYY-MM-DDTHH:mm" in local time
    // We create a Date object which interprets it as local time, then convert to ISO (UTC)
    const isoString = new Date(datetimeLocal).toISOString();
    console.log('🕐 Converting datetime-local to ISO:', { input: datetimeLocal, output: isoString });
    return isoString;
  };
  
  const [formData, setFormData] = useState({
    title: event?.title || '',
    event_date: event?.event_date ? toLocalDateTimeString(event.event_date) : '',
    location: event?.location || '',
    description: event?.description || '',
    agenda: event?.agenda || '',
    registration_link: event?.registration_link || '',
    is_idaic_event: true, // All events are IDAIC events by default
    // Email reminder settings
    enable_reminders: event?.enable_reminders || false,
    reminder_days_before: event?.reminder_days_before || 1,
    reminder_hour: event?.reminder_hour || 9,
    // Poll fields
    create_poll: event?.poll_id ? true : false,
    poll_slot_1_date: '',
    poll_slot_1_start: '',
    poll_slot_1_end: '',
    poll_slot_2_date: '',
    poll_slot_2_start: '',
    poll_slot_2_end: '',
    poll_slot_3_date: '',
    poll_slot_3_start: '',
    poll_slot_3_end: '',
    poll_deadline_date: ''
  });
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [createdEventId, setCreatedEventId] = useState(event?.id || null);
  const [lastSaved, setLastSaved] = useState(null);
  const autoSaveTimeoutRef = useRef(null);

  // Debug: Log when event prop changes (but not during save to avoid flicker)
  useEffect(() => {
    if (event && !saving) {
      console.log('📅 Event loaded:', {
        id: event.id,
        title: event.title,
        raw_event_date: event.event_date,
        converted_event_date: event.event_date ? toLocalDateTimeString(event.event_date) : 'N/A'
      });
    }
  }, [event, saving]);

  // Helper function to round time to :00 or :30
  const roundTimeToHalfHour = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const mins = parseInt(minutes);
    const roundedMins = mins < 15 ? '00' : mins < 45 ? '30' : '00';
    // If rounding to 00 and original was >= 45, increment hour
    if (mins >= 45) {
      const newHour = (parseInt(hours) + 1) % 24;
      return `${String(newHour).padStart(2, '0')}:00`;
    }
    return `${hours}:${roundedMins}`;
  };

  // Helper function to add 2 hours to a time string
  const addTwoHours = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const newHour = (parseInt(hours) + 2) % 24;
    return `${String(newHour).padStart(2, '0')}:${minutes}`;
  };

  // Load poll data when editing an event with an existing poll
  useEffect(() => {
    const loadPollData = async () => {
      if (event?.poll_id && event?.id) {
        try {
          const response = await fetch(`/.netlify/functions/polls?event_id=${event.id}`);
          if (response.ok) {
            const poll = await response.json();
            if (poll && poll.time_slots && poll.time_slots.length >= 3) {
              // Parse time slots and convert to form format
              setFormData(prevFormData => {
                const pollFormData = { ...prevFormData };
                
                poll.time_slots.forEach((slot, index) => {
                  if (index < 3) {
                    const slotDate = new Date(slot);
                    // Get local date components
                    const year = slotDate.getFullYear();
                    const month = String(slotDate.getMonth() + 1).padStart(2, '0');
                    const day = String(slotDate.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    
                    // Get local time components
                    const hours = String(slotDate.getHours()).padStart(2, '0');
                    const minutes = String(slotDate.getMinutes()).padStart(2, '0');
                    const startTime = `${hours}:${minutes}`;
                    
                    // Calculate end time (start + 2 hours)
                    const endTime = addTwoHours(startTime);
                    
                    pollFormData[`poll_slot_${index + 1}_date`] = dateStr;
                    pollFormData[`poll_slot_${index + 1}_start`] = startTime;
                    pollFormData[`poll_slot_${index + 1}_end`] = endTime;
                  }
                });
                
                // Parse deadline
                if (poll.deadline) {
                  const deadlineDate = new Date(poll.deadline);
                  const year = deadlineDate.getFullYear();
                  const month = String(deadlineDate.getMonth() + 1).padStart(2, '0');
                  const day = String(deadlineDate.getDate()).padStart(2, '0');
                  pollFormData.poll_deadline_date = `${year}-${month}-${day}`;
                }
                
                return pollFormData;
              });
            }
          }
        } catch (err) {
          console.error('Error loading poll data:', err);
        }
      }
    };
    
    loadPollData();
  }, [event?.poll_id, event?.id]); // Only run when event or poll_id changes

  // Auto-save effect - debounced
  useEffect(() => {
    // Only auto-save if we have title (and date if not creating poll)
    if (!formData.title || (!formData.create_poll && !formData.event_date)) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after user stops typing)
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (saving || autoSaving) return;
      
      setAutoSaving(true);
      try {
        if (createdEventId) {
          // Update existing event (exclude poll fields)
          const { create_poll, poll_slot_1_date, poll_slot_1_start, poll_slot_1_end, poll_slot_2_date, poll_slot_2_start, poll_slot_2_end, poll_slot_3_date, poll_slot_3_start, poll_slot_3_end, poll_deadline_date, enable_reminders, reminder_days_before, reminder_hour, ...eventData } = formData;
          
          // Add reminder settings only if reminders are enabled
          eventData.enable_reminders = enable_reminders || false;
          if (enable_reminders) {
            eventData.reminder_days_before = reminder_days_before || 1;
            eventData.reminder_hour = reminder_hour || 9;
          } else {
            // Clear reminder settings when disabled
            eventData.reminder_days_before = null;
            eventData.reminder_hour = null;
          }
          
          // Convert event_date from datetime-local format to ISO string
          const cleanedEventData = { ...eventData };
          if (cleanedEventData.event_date) {
            cleanedEventData.event_date = datetimeLocalToISO(cleanedEventData.event_date);
          } else if (cleanedEventData.event_date === '' || cleanedEventData.event_date === null || cleanedEventData.event_date === undefined) {
            delete cleanedEventData.event_date;
          }
          
          // Ensure is_idaic_event is always true (all events are IDAIC events)
          cleanedEventData.is_idaic_event = true;
          
          const response = await fetch(`/.netlify/functions/events?id=${createdEventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...cleanedEventData,
              updated_at: new Date().toISOString()
            })
          });

          if (response.ok) {
            setLastSaved(new Date());
          }
        } else {
          // Create new event if we have title (and date if not creating poll)
          if (formData.title && (formData.create_poll || formData.event_date)) {
            const eventId = crypto.randomUUID();
            const { create_poll, poll_slot_1_date, poll_slot_1_start, poll_slot_1_end, poll_slot_2_date, poll_slot_2_start, poll_slot_2_end, poll_slot_3_date, poll_slot_3_start, poll_slot_3_end, poll_deadline_date, enable_reminders, reminder_days_before, reminder_hour, ...eventData } = formData;
            
            // Add reminder settings only if reminders are enabled
            eventData.enable_reminders = enable_reminders || false;
            if (enable_reminders) {
              eventData.reminder_days_before = reminder_days_before || 1;
              eventData.reminder_hour = reminder_hour || 9;
            } else {
              // Don't include reminder settings when disabled
              delete eventData.reminder_days_before;
              delete eventData.reminder_hour;
            }
            
            // Convert event_date from datetime-local format to ISO string
            const cleanedEventData = { ...eventData };
            if (cleanedEventData.event_date) {
              cleanedEventData.event_date = datetimeLocalToISO(cleanedEventData.event_date);
            } else if (cleanedEventData.event_date === '' || cleanedEventData.event_date === null || cleanedEventData.event_date === undefined) {
              delete cleanedEventData.event_date;
            }
            
            // Ensure is_idaic_event is always true (all events are IDAIC events)
            cleanedEventData.is_idaic_event = true;
            
            const newEvent = {
              ...cleanedEventData,
              id: eventId
            };

            const response = await fetch('/.netlify/functions/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newEvent)
            });

            if (response.ok) {
              const createdEvent = await response.json();
              setCreatedEventId(createdEvent.id);
              setLastSaved(new Date());
              
              // Notify parent component about the created event
              // This prevents the modal from closing and reopening with a blank form
              if (!event && onEventCreated) {
                onEventCreated(createdEvent);
              }
              
              // Create poll if poll fields are filled
              if (formData.create_poll && formData.poll_slot_1_date && formData.poll_slot_1_start && formData.poll_slot_1_end) {
                try {
                  // Build time slots from date + time ranges
                  const timeSlots = [];
                  for (let i = 1; i <= 3; i++) {
                    const date = formData[`poll_slot_${i}_date`];
                    const start = formData[`poll_slot_${i}_start`];
                    const end = formData[`poll_slot_${i}_end`];
                    if (date && start && end) {
                      // Combine date and start time
                      const startDateTime = new Date(`${date}T${start}`).toISOString();
                      timeSlots.push(startDateTime);
                    }
                  }
                  
                  // Build deadline (date + 23:59:59)
                  let deadline = null;
                  if (formData.poll_deadline_date) {
                    deadline = new Date(`${formData.poll_deadline_date}T23:59:59`).toISOString();
                  }
                  
                  if (timeSlots.length === 3) {
                    const pollResponse = await fetch('/.netlify/functions/polls', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        event_id: createdEvent.id,
                        time_slots: timeSlots,
                        deadline: deadline
                      })
                    });
                    if (pollResponse.ok) {
                      const createdPoll = await pollResponse.json();
                      console.log('Poll created successfully in auto-save:', createdPoll);
                      // Refresh events list to show poll URL
                      if (onSave) {
                        await onSave(createdEvent.id, formData);
                      }
                    } else {
                      const errorData = await pollResponse.json().catch(() => ({ error: 'Unknown error' }));
                      console.error('Failed to create poll in auto-save:', pollResponse.status, errorData);
                    }
                  }
                } catch (pollErr) {
                  console.error('Error creating poll:', pollErr);
                }
              } else {
              // Update parent component
              await onSave(createdEvent.id, formData);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error auto-saving event:', err);
      } finally {
        setAutoSaving(false);
      }
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData.title, formData.event_date, formData.location, formData.description, formData.agenda, formData.registration_link, formData.is_idaic_event, createdEventId, saving, autoSaving, onSave]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || (!formData.create_poll && !formData.event_date)) {
      return;
    }

    // Validate poll fields if poll is being created
    // Note: deadline is optional, so we don't require poll_deadline_date
    if (formData.create_poll) {
      if (!formData.poll_slot_1_date || !formData.poll_slot_1_start || !formData.poll_slot_1_end ||
          !formData.poll_slot_2_date || !formData.poll_slot_2_start || !formData.poll_slot_2_end ||
          !formData.poll_slot_3_date || !formData.poll_slot_3_start || !formData.poll_slot_3_end) {
        return;
      }
    }

    setSaving(true);
    try {
      if (createdEventId) {
        // Create/update poll first if needed (before final save)
        if (formData.create_poll && formData.poll_slot_1_date && formData.poll_slot_1_start && formData.poll_slot_1_end) {
          try {
            // Build time slots from date + time ranges
            const timeSlots = [];
            for (let i = 1; i <= 3; i++) {
              const date = formData[`poll_slot_${i}_date`];
              const start = formData[`poll_slot_${i}_start`];
              const end = formData[`poll_slot_${i}_end`];
              if (date && start && end) {
                // Combine date and start time
                const startDateTime = new Date(`${date}T${start}`).toISOString();
                timeSlots.push(startDateTime);
              }
            }
            
            // Build deadline (date + 23:59:59)
            let deadline = null;
            if (formData.poll_deadline_date) {
              deadline = new Date(`${formData.poll_deadline_date}T23:59:59`).toISOString();
            }
            
            if (timeSlots.length === 3) {
              // Check if poll already exists
              const pollCheckResponse = await fetch(`/.netlify/functions/polls?event_id=${createdEventId}`);
              const existingPoll = pollCheckResponse.ok ? await pollCheckResponse.json() : null;
              
              if (existingPoll && existingPoll.id) {
                // Update existing poll
                const updateResponse = await fetch(`/.netlify/functions/polls?id=${existingPoll.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    time_slots: timeSlots,
                    deadline: deadline
                  })
                });
                if (!updateResponse.ok) {
                  const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }));
                  console.error('Failed to update poll:', updateResponse.status, errorData);
                  throw new Error(`Failed to update poll: ${errorData.error || 'Unknown error'}`);
                }
                console.log('Poll updated successfully');
              } else {
                // Create new poll
                const newPollResponse = await fetch('/.netlify/functions/polls', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event_id: createdEventId,
                    time_slots: timeSlots,
                    deadline: deadline
                  })
                });
                
                if (newPollResponse.ok) {
                  const createdPoll = await newPollResponse.json();
                  console.log('Poll created successfully in handleSubmit:', createdPoll);
                  // Wait a moment for database to update
                  await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                  const errorData = await newPollResponse.json().catch(() => ({ error: 'Unknown error' }));
                  console.error('Failed to create poll in handleSubmit:', newPollResponse.status, errorData);
                  throw new Error(`Failed to create poll: ${errorData.error || 'Unknown error'}`);
                }
              }
            }
          } catch (pollErr) {
            console.error('Error creating/updating poll:', pollErr);
            setError('Failed to create poll: ' + pollErr.message);
          }
        }
        
        // Final save of existing event (after poll creation/update)
        await onSave(createdEventId, formData);
        
        // Close modal immediately after save to prevent flicker from refetch
        onClose();
        setSaving(false);
        return; // Exit early to prevent further execution
        
        // Handle poll deletion if unchecked
        if (!formData.create_poll && createdEventId) {
          // If poll is unchecked, make sure it's deleted
          try {
            const pollCheckResponse = await fetch(`/.netlify/functions/polls?event_id=${createdEventId}`);
            if (pollCheckResponse.ok) {
              const existingPoll = await pollCheckResponse.json();
              if (existingPoll && existingPoll.id) {
                // Delete the poll
                await fetch(`/.netlify/functions/polls?id=${existingPoll.id}`, {
                  method: 'DELETE'
                });
                
                // Remove poll_id from event
                await fetch(`/.netlify/functions/events?id=${createdEventId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    poll_id: null,
                    updated_at: new Date().toISOString()
                  })
                });
                
                // Refresh events list
                if (onSave) {
                  await onSave(createdEventId, formData);
                }
              }
            }
          } catch (err) {
            console.error('Error removing poll:', err);
          }
        }
      } else {
        // Create new event (shouldn't happen if auto-save worked, but fallback)
        await onSave(undefined, formData);
        onClose();
        setSaving(false);
        return;
      }
    } catch (err) {
      console.error('Error saving event:', err);
      // Don't close on error - let user see the error
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
            {createdEventId ? 'Edit Event' : 'Create New Event'}
          </h3>
          <div className="flex items-center gap-3">
            {autoSaving && (
              <span className="text-xs text-gray-500">Auto-saving...</span>
            )}
            {lastSaved && !autoSaving && (
              <span className="text-xs text-gray-500">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Event Date & Time {!formData.create_poll && '*'}
            </label>
            <input
              type="datetime-local"
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              required={!formData.create_poll}
              step="60"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter time in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). 
              Viewers will see it in their local time.
            </p>
            {formData.create_poll && (
              <p className="text-xs text-gray-500 mt-1">Optional when creating a poll - can be set later</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Online, London, UK"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Event description and details..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Agenda / Outline
            </label>
            <textarea
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Event agenda, schedule, or outline..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              Online Event Link (Optional)
            </label>
            <input
              type="url"
              value={formData.registration_link}
              onChange={(e) => setFormData({ ...formData, registration_link: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Teams, Google Meet, or other online event link"
            />
            <p className="text-xs text-gray-500 mt-1">
              Add a link to join the event online (e.g., Microsoft Teams, Google Meet)
            </p>
          </div>


          {/* Poll Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="create_poll"
                checked={formData.create_poll}
                onChange={async (e) => {
                  const wasChecked = formData.create_poll;
                  const isChecked = e.target.checked;
                  
                  // If unchecking and we have a poll, delete it
                  if (wasChecked && !isChecked && createdEventId) {
                    try {
                      // Get existing poll
                      const pollCheckResponse = await fetch(`/.netlify/functions/polls?event_id=${createdEventId}`);
                      if (pollCheckResponse.ok) {
                        const existingPoll = await pollCheckResponse.json();
                        if (existingPoll && existingPoll.id) {
                          // Delete the poll
                          await fetch(`/.netlify/functions/polls?id=${existingPoll.id}`, {
                            method: 'DELETE'
                          });
                          
                          // Remove poll_id from event
                          await fetch(`/.netlify/functions/events?id=${createdEventId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              poll_id: null,
                              updated_at: new Date().toISOString()
                            })
                          });
                        }
                      }
                    } catch (err) {
                      console.error('Error removing poll:', err);
                    }
                  }
                  
                  setFormData({ ...formData, create_poll: isChecked });
                }}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="create_poll" className="ml-2 text-sm font-medium" style={{ color: colors.text.primary }}>
                Create Poll for Time Selection
              </label>
            </div>

            {formData.create_poll && (
              <div className="space-y-6 pl-6 border-l-2 border-orange-200">
                {/* Time Slot 1 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium" style={{ color: colors.text.primary }}>
                    Time Slot 1 *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={formData.poll_slot_1_date}
                        onChange={(e) => setFormData({ ...formData, poll_slot_1_date: e.target.value })}
                        required={formData.create_poll}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={formData.poll_slot_1_start}
                        onChange={(e) => {
                          const roundedTime = roundTimeToHalfHour(e.target.value);
                          const newEndTime = addTwoHours(roundedTime);
                          setFormData({ 
                            ...formData, 
                            poll_slot_1_start: roundedTime,
                            poll_slot_1_end: newEndTime
                          });
                        }}
                        required={formData.create_poll}
                        step="1800"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Only :00 or :30</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={formData.poll_slot_1_end}
                        onChange={(e) => {
                          const roundedTime = roundTimeToHalfHour(e.target.value);
                          setFormData({ ...formData, poll_slot_1_end: roundedTime });
                        }}
                        required={formData.create_poll}
                        step="1800"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Defaults to +2 hours</p>
                    </div>
                  </div>
                </div>

                {/* Time Slot 2 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium" style={{ color: colors.text.primary }}>
                    Time Slot 2 *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={formData.poll_slot_2_date}
                        onChange={(e) => setFormData({ ...formData, poll_slot_2_date: e.target.value })}
                        required={formData.create_poll}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={formData.poll_slot_2_start}
                        onChange={(e) => {
                          const roundedTime = roundTimeToHalfHour(e.target.value);
                          const newEndTime = addTwoHours(roundedTime);
                          setFormData({ 
                            ...formData, 
                            poll_slot_2_start: roundedTime,
                            poll_slot_2_end: newEndTime
                          });
                        }}
                        required={formData.create_poll}
                        step="1800"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Only :00 or :30</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={formData.poll_slot_2_end}
                        onChange={(e) => {
                          const roundedTime = roundTimeToHalfHour(e.target.value);
                          setFormData({ ...formData, poll_slot_2_end: roundedTime });
                        }}
                        required={formData.create_poll}
                        step="1800"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Defaults to +2 hours</p>
                    </div>
                  </div>
                </div>

                {/* Time Slot 3 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium" style={{ color: colors.text.primary }}>
                    Time Slot 3 *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={formData.poll_slot_3_date}
                        onChange={(e) => setFormData({ ...formData, poll_slot_3_date: e.target.value })}
                        required={formData.create_poll}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={formData.poll_slot_3_start}
                        onChange={(e) => {
                          const roundedTime = roundTimeToHalfHour(e.target.value);
                          const newEndTime = addTwoHours(roundedTime);
                          setFormData({ 
                            ...formData, 
                            poll_slot_3_start: roundedTime,
                            poll_slot_3_end: newEndTime
                          });
                        }}
                        required={formData.create_poll}
                        step="1800"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Only :00 or :30</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={formData.poll_slot_3_end}
                        onChange={(e) => {
                          const roundedTime = roundTimeToHalfHour(e.target.value);
                          setFormData({ ...formData, poll_slot_3_end: roundedTime });
                        }}
                        required={formData.create_poll}
                        step="1800"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Defaults to +2 hours</p>
                    </div>
                  </div>
                </div>

                {/* Poll Deadline */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
                    Poll Deadline (End Date) *
                  </label>
                  <input
                    type="date"
                    value={formData.poll_deadline_date}
                    onChange={(e) => setFormData({ ...formData, poll_deadline_date: e.target.value })}
                    required={formData.create_poll}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Voting will close at 23:59 on this date</p>
                </div>
              </div>
            )}

            {/* Email Reminder Settings */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: colors.text.primary }}>
                Email Reminder Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enable_reminders"
                    checked={formData.enable_reminders}
                    onChange={(e) => setFormData({ ...formData, enable_reminders: e.target.checked })}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enable_reminders" className="ml-2 text-sm" style={{ color: colors.text.primary }}>
                    Enable email reminders for registrants
                  </label>
                </div>

                {formData.enable_reminders && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
                        Days Before Event
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={formData.reminder_days_before}
                        onChange={(e) => setFormData({ ...formData, reminder_days_before: parseInt(e.target.value) || 1 })}
                        required={formData.enable_reminders}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Send reminder X days before the event</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
                        Reminder Time (Hour)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={formData.reminder_hour}
                        onChange={(e) => setFormData({ ...formData, reminder_hour: parseInt(e.target.value) || 9 })}
                        required={formData.enable_reminders}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Hour of day to send (0-23, 24-hour format)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving || !formData.title || (!formData.create_poll && !formData.event_date)}
              className="px-4 py-2 bg-orange-500 text-white rounded-md text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : createdEventId ? 'Save & Close' : 'Create & Close'}
            </button>
          </div>
          {createdEventId && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                <strong>Event created!</strong> Registration URL: 
                <a 
                  href={`/events-${createdEventId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline ml-1"
                >
                  {`${portalBaseUrl}/events-${createdEventId}`}
                </a>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

