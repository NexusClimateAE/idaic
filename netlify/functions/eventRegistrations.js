const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const { generateICS, icsToBase64 } = require('./generateCalendarInvite');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function (event, context) {
  try {
    switch (event.httpMethod) {
      case 'GET': {
        const { event_id } = event.queryStringParameters || {};
        
        if (event_id) {
          // Get registrations for a specific event
          const { data, error } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', event_id)
            .order('created_at', { ascending: false });
          
          if (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
          }
          
          // For each registration, check if user still exists and update role if needed
          const registrationsWithRoles = await Promise.all(
            (data || []).map(async (reg) => {
              if (reg.registration_type === 'internal' || reg.registration_type === 'new') {
                const { data: userData } = await supabase
                  .from('users')
                  .select('role')
                  .eq('email', reg.email)
                  .maybeSingle();
                
                if (userData) {
                  reg.user_role = userData.role || null;
                  reg.registration_type = 'internal';
                } else if (reg.registration_type === 'internal') {
                  // User was internal but no longer exists, mark as new
                  reg.registration_type = 'new';
                  reg.user_role = null;
                }
              }
              return reg;
            })
          );
          
          return { statusCode: 200, body: JSON.stringify(registrationsWithRoles) };
        } else {
          // Get all registrations
          const { data, error } = await supabase
            .from('event_registrations')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
          }
          return { statusCode: 200, body: JSON.stringify(data || []) };
        }
      }
      
      case 'POST': {
        const registrationData = JSON.parse(event.body);
        
        if (!registrationData.event_id || !registrationData.email || !registrationData.name) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'event_id, email, and name are required' })
          };
        }

        // Check if user already registered
        const { data: existing } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', registrationData.event_id)
          .eq('email', registrationData.email)
          .maybeSingle();

        if (existing) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'User already registered for this event' })
          };
        }

        // Check if email exists in users table and get their role
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, role')
          .eq('email', registrationData.email)
          .maybeSingle();

        // Set registration type and role
        let registrationType = 'external';
        let userRole = null;
        
        if (userData) {
          registrationType = 'internal';
          userRole = userData.role || null;
        } else {
          // Not in database, mark as "New"
          registrationType = 'new';
        }

        const newRegistration = {
          ...registrationData,
          registration_type: registrationType,
          user_role: userRole, // Store the user's role from users table
          status: null, // Default to null (which displays as "Confirmed")
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('event_registrations')
          .insert([newRegistration])
          .select();

        if (error) {
          return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }

        const registration = data[0];

        // Send confirmation email (non-blocking)
        try {
          // Get event details
          const { data: eventData } = await supabase
            .from('events')
            .select('*')
            .eq('id', registrationData.event_id)
            .maybeSingle();

          if (eventData) {
            // Generate cancellation token (using registration ID + a simple hash)
            const crypto = require('crypto');
            const cancellationToken = crypto
              .createHash('sha256')
              .update(`${registration.id}-${registration.email}-${process.env.SECRET_KEY || 'default-secret'}`)
              .digest('hex')
              .substring(0, 32);

            // Store cancellation token in registration
            await supabase
              .from('event_registrations')
              .update({ cancellation_token: cancellationToken })
              .eq('id', registration.id);

            // Format event date
            const formatDate = (dateString) => {
              if (!dateString) return 'TBA';
              const date = new Date(dateString);
              return date.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Dubai'
              }) + ' GST';
            };

            const eventDate = formatDate(eventData.event_date);
            const baseUrl = process.env.PORTAL_BASE_URL || process.env.BASE_URL || 'https://portal.idaic.org';
            const cancelUrl = `${baseUrl}/cancel-registration?token=${cancellationToken}&id=${registration.id}`;
            const eventUrl = eventData.registration_link || `${baseUrl}/events-${eventData.id}`;

            // Generate calendar invitation (.ics file)
            let calendarAttachment = null;
            if (eventData.event_date) {
              try {
                // Calculate end date (default to 1 hour after start if not specified)
                let endDate = eventData.event_date;
                if (eventData.event_end_date) {
                  endDate = eventData.event_end_date;
                } else {
                  // Default to 1 hour duration
                  const start = new Date(eventData.event_date);
                  start.setHours(start.getHours() + 1);
                  endDate = start.toISOString();
                }

                const icsContent = generateICS({
                  title: eventData.title || 'IDAIC Event',
                  description: eventData.description || `You are registered for ${eventData.title || 'this event'}.`,
                  startDate: eventData.event_date,
                  endDate: endDate,
                  location: eventData.location || '',
                  organizerEmail: process.env.ORGANIZER_EMAIL || 'info@idaic.org',
                  organizerName: 'IDAIC',
                  attendeeEmail: registrationData.email,
                  attendeeName: registrationData.name,
                  url: eventUrl
                });

                // Convert to base64 for email attachment
                const icsBase64 = icsToBase64(icsContent);
                calendarAttachment = {
                  filename: `${(eventData.title || 'event').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`,
                  content: icsBase64,
                  contentType: 'text/calendar; charset=utf-8; method=REQUEST'
                };
              } catch (calendarErr) {
                console.error('Error generating calendar invitation:', calendarErr);
                // Continue without calendar attachment if generation fails
              }
            }

            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #f97316; color: white; padding: 20px; text-align: center; }
                  .content { padding: 20px; background-color: #f9f9f9; }
                  .button { display: inline-block; padding: 12px 24px; background-color: #f97316; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                  .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                  .calendar-note { background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #2196f3; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Event Registration Confirmed</h1>
                  </div>
                  <div class="content">
                    <p>Dear ${registrationData.name},</p>
                    <p>Thank you for registering for <strong>${eventData.title || 'the event'}</strong>.</p>
                    <p><strong>Event Details:</strong></p>
                    <ul>
                      <li><strong>Date & Time:</strong> ${eventDate}</li>
                      ${eventData.location ? `<li><strong>Location:</strong> ${eventData.location}</li>` : ''}
                    </ul>
                    ${eventData.description ? `<p>${eventData.description.substring(0, 200)}${eventData.description.length > 200 ? '...' : ''}</p>` : ''}
                    ${calendarAttachment ? `
                    <div class="calendar-note">
                      <p><strong>📅 Add to Calendar</strong></p>
                      <p>A calendar invitation has been attached to this email. Open the attachment (.ics file) to add this event to your Google Calendar, Outlook, or other calendar application.</p>
                    </div>
                    ` : ''}
                    <p>If you need to cancel your registration, please click the link below:</p>
                    <p style="text-align: center;">
                      <a href="${cancelUrl}" class="button">Cancel Registration</a>
                    </p>
                    <p style="font-size: 12px; color: #666;">Or copy this link: ${cancelUrl}</p>
                  </div>
                  <div class="footer">
                    <p>This is an automated message from IDAIC.</p>
                  </div>
                </div>
              </body>
              </html>
            `;

            // Prepare email payload with optional calendar attachment
            const emailPayload = {
              to: registrationData.email,
              subject: `Registration Confirmed: ${eventData.title || 'Event'}`,
              html: emailHtml
            };

            if (calendarAttachment) {
              emailPayload.attachments = [calendarAttachment];
            }

            // Send email via email service
            const emailResponse = await fetch(`${baseUrl}/.netlify/functions/sendEmail`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(emailPayload)
            });

            if (!emailResponse.ok) {
              console.error('Failed to send confirmation email:', await emailResponse.text());
            }
          }
        } catch (emailErr) {
          // Log but don't fail registration if email fails
          console.error('Error sending confirmation email:', emailErr);
        }

        return { statusCode: 201, body: JSON.stringify(registration) };
      }
      
      case 'PUT': {
        const { id, token } = event.queryStringParameters || {};
        const updates = JSON.parse(event.body || '{}');
        
        if (!id) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Registration ID is required' }) };
        }

        // If token is provided, verify it for cancellation
        if (token) {
          const { data: registration } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (!registration) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Registration not found' }) };
          }

          // Verify cancellation token
          const crypto = require('crypto');
          const expectedToken = crypto
            .createHash('sha256')
            .update(`${registration.id}-${registration.email}-${process.env.SECRET_KEY || 'default-secret'}`)
            .digest('hex')
            .substring(0, 32);

          if (token !== expectedToken && token !== registration.cancellation_token) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Invalid cancellation token' }) };
          }

          // Update status to cancelled
          updates.status = 'cancelled';
          updates.cancelled_at = new Date().toISOString();
        }
        
        const { data: updatedRegistration, error: updateError } = await supabase
          .from('event_registrations')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select();
        
        if (updateError) {
          return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) };
        }
        return { statusCode: 200, body: JSON.stringify(updatedRegistration[0]) };
      }
      
      case 'DELETE': {
        const { id } = event.queryStringParameters || {};
        if (!id) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Registration ID is required' }) };
        }
        
        const { error } = await supabase
          .from('event_registrations')
          .delete()
          .eq('id', id);
        
        if (error) {
          return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
        return { statusCode: 204, body: '' };
      }
      
      default:
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

