const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Email service using Resend (can be changed to SendGrid, Mailgun, etc.)
// Set RESEND_API_KEY in environment variables
// Alternative: Use SMTP with nodemailer

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { to, subject, html, text, attachments, from, reply_to } = JSON.parse(event.body || '{}');

    if (!to || !subject || (!html && !text)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'to, subject, and html/text are required' })
      };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    // Allow custom from/reply_to from request, fallback to environment variables
    const FROM_EMAIL = from || process.env.FROM_EMAIL || 'IDAIC Events <no-reply@portal.idaic.org>';
    const REPLY_TO = reply_to || process.env.REPLY_TO || 'info@idaic.org';

    // If Resend is configured, use it
    if (RESEND_API_KEY) {
      const emailPayload = {
        from: FROM_EMAIL,
        reply_to: REPLY_TO,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html || text,
      };

      // Add attachments if provided
      // Resend expects attachments in format: [{ filename, content, contentType? }]
      // content should be base64 encoded string
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        emailPayload.attachments = attachments.map(att => ({
          filename: att.filename || 'attachment',
          content: att.content, // Should be base64 encoded
          contentType: att.contentType || att.type || 'application/octet-stream'
        }));
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Resend API error:', errorData);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to send email', details: errorData })
        };
      }

      const result = await response.json();
      console.log('Email sent successfully via Resend:', result);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, messageId: result.id })
      };
    }

    // Fallback: Log email (for development/testing)
    console.log('Email service not configured. Would send email:', {
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to,
      subject,
      html: html || text,
      attachments: attachments ? `${attachments.length} attachment(s)` : 'none'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Email service not configured (RESEND_API_KEY not set). Email logged to console.',
        preview: { to, subject }
      })
    };

  } catch (error) {
    console.error('Error in sendEmail:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

