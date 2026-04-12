const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Welcome email HTML template
function getWelcomeEmailHTML(userName, portalBaseUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to IDAIC Members Portal</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: #f97316;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .footer-logo {
      max-width: 150px;
      height: auto;
      margin: 20px auto;
      opacity: 0.8;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: bold;
    }
    .content {
      padding: 30px 20px;
    }
    .content h2 {
      color: #f97316;
      margin-top: 0;
      font-size: 24px;
    }
    .content p {
      margin-bottom: 15px;
      font-size: 16px;
      color: #333;
    }
    .highlight-box {
      background-color: #fff7ed;
      border-left: 4px solid #f97316;
      padding: 20px;
      margin: 20px 0;
    }
    .highlight-box h3 {
      color: #f97316;
      margin-top: 0;
      font-size: 18px;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #f97316;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
      font-size: 16px;
    }
    .button:hover {
      background-color: #ea580c;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #f97316;
      text-decoration: none;
    }
    .features {
      margin: 25px 0;
    }
    .features ul {
      list-style: none;
      padding: 0;
    }
    .features li {
      padding: 10px 0;
      padding-left: 30px;
      position: relative;
    }
    .features li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #f97316;
      font-weight: bold;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Welcome to IDAIC</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">Members Portal Beta Program</p>
    </div>
    
    <div class="content">
      <h2>Hello ${userName || 'there'}!</h2>
      
      <p>We're thrilled to welcome you to the <strong>IDAIC Members Portal Beta Program</strong>! This is an exciting step forward in bringing the IDAIC community together.</p>
      
      <div class="highlight-box">
        <h3>What's Next?</h3>
        <p>Our members portal is designed to be a collaborative space where we share:</p>
        <ul class="features">
          <li><strong>Specific Content</strong> - Access to exclusive resources, insights, and updates</li>
          <li><strong>Events</strong> - Stay informed about upcoming IDAIC events and opportunities</li>
          <li><strong>Collaboration Projects</strong> - Connect with other members and explore potential partnerships</li>
        </ul>
      </div>
      
      <p>As part of our beta program, your feedback and engagement are invaluable in helping us build a platform that truly serves our community's needs.</p>
      
      <p>We're committed to creating a space where innovation, collaboration, and knowledge sharing thrive. Together, we can drive meaningful impact in AI and decarbonisation.</p>
      
      <p style="text-align: center;">
        <a href="${portalBaseUrl}" class="button">Access Members Portal</a>
      </p>
      
      <p>If you have any questions or need assistance, please don't hesitate to reach out to us at <a href="mailto:info@idaic.org" style="color: #f97316;">info@idaic.org</a>.</p>
      
      <p>Welcome aboard, and we look forward to your active participation in the IDAIC community!</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>The IDAIC Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <img src="https://xnjpbkcqfuvegiwdxypw.supabase.co/storage/v1/object/public/logos/31688ed3-d132-420e-b5a6-e202460db9fc_1761903959448_woimd8pvdnk.png" alt="IDAIC Logo" class="footer-logo" />
      <p>This email was sent from <strong>IDAIC Welcome (no-reply@idaic.nexusclimate.co)</strong></p>
      <p>Please reply to <a href="mailto:info@idaic.org">info@idaic.org</a> for any inquiries</p>
      <p style="margin-top: 15px;">
        &copy; ${new Date().getFullYear()} idaic.org. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// Welcome Email Function
// IMPORTANT: This function should ONLY be called manually via the "Send Welcome Email" button
// in the UserFormView component. It should NEVER be called automatically on user creation,
// approval, or any other automatic trigger.
exports.handler = async function (event, context) {
  console.log('sendWelcomeEmail called with method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Parsing request body...');
    const body = event.body || '{}';
    let requestData;
    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON in request body', details: parseError.message })
      };
    }

    const { userId, userEmail, userName } = requestData;
    console.log('Request data:', { userId, userEmail, userName: userName || 'not provided' });

    const portalBaseUrl = process.env.PORTAL_BASE_URL || process.env.BASE_URL || 'https://portal.idaic.org';

    if (!userId || !userEmail) {
      console.error('Missing required fields:', { userId: !!userId, userEmail: !!userEmail });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId and userEmail are required' })
      };
    }

    // Generate welcome email HTML
    const emailHTML = getWelcomeEmailHTML(userName || 'there', portalBaseUrl);

    // Send email directly via Resend API (same pattern as sendEmail.js)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = 'IDAIC Welcome <no-reply@idaic.nexusclimate.co>';
    const REPLY_TO = 'info@idaic.org';

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Email service not configured' })
      };
    }

    const emailPayload = {
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: [userEmail],
      subject: 'Welcome to IDAIC Members Portal - Beta Program',
      html: emailHTML
    };

    console.log('Sending email via Resend API to:', userEmail);

    try {
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
      console.log('Welcome email sent successfully via Resend:', result);

      // Update user record to mark welcome email as sent
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ welcome_email_sent: true })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update welcome_email_sent status:', updateError);
          // Don't fail the request if email was sent but DB update failed
        } else {
          console.log('✅ Welcome email status updated in database');
        }
      } catch (updateErr) {
        console.error('Error updating welcome_email_sent status:', updateErr);
        // Continue even if DB update fails - email was sent successfully
      }
    } catch (emailErr) {
      console.error('Error sending welcome email:', emailErr);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send welcome email', details: emailErr.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Welcome email sent successfully',
        emailSent: true
      })
    };

  } catch (error) {
    console.error('Unexpected error in sendWelcomeEmail:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

