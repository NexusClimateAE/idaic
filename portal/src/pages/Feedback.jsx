import React, { useState, useEffect } from 'react';
import { colors, font, form as formConfig } from '../config/colors';
import { useAuth } from '../hooks/useAuth';

export default function FeedbackForm({ onNavigate }) {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Pre-fill name and email from user data
  useEffect(() => {
    if (user) {
      // Get name from user_metadata or user object
      const userName = user.user_metadata?.name || 
                       user.user_metadata?.full_name || 
                       user.name || 
                       '';
      // Get email from user object
      const userEmail = user.email || '';
      
      setName(userName);
      setEmail(userEmail);
    }
  }, [user]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const removeFile = (index) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSending(true);
    setStatus('Sending…');

    const form = e.target;
    
    try {
      let attachmentUrls = [];
      
      // Step 1: Upload files if any exist
      if (selectedFiles.length > 0) {
        setStatus('Uploading files…');
        
        // Convert files to base64 for upload
        const filePromises = selectedFiles.map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64Content = reader.result.split(',')[1]; // Remove data:type;base64, prefix
              resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                content: base64Content
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        });

        const filesData = await Promise.all(filePromises);
        
        // Upload files to Linear
        const uploadResponse = await fetch('/.netlify/functions/uploadFeedbackFiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: filesData }),
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          // Extract successful uploads
          attachmentUrls = uploadResult.results
            .filter(result => result.success)
            .map(result => ({
              name: result.filename,
              url: result.assetUrl
            }));
        } else {
          console.warn('File upload failed, proceeding without attachments');
        }
      }

      // Step 2: Create Linear issue
      setStatus('Creating issue…');
      
      const data = {
        name: name || form.name?.value || '',
        email: email || form.email?.value || '',
        subject: form.subject.value,
        type: form.type.value,
        comment: comment || form.comment?.value || '',
        attachments: attachmentUrls // Pass attachment URLs
      };

      const resp = await fetch('/.netlify/functions/createFeedbackTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (resp.ok) {
        const result = await resp.json();
        let successMessage = 'Thanks for sharing your feedback!';
        if (attachmentUrls.length > 0) {
          successMessage += ` ${attachmentUrls.length} file(s) attached successfully.`;
        }
        setStatus(successMessage);
        form.reset();
        setSelectedFiles([]);
        setComment('');
        // Reset name and email to user's values (in case they were changed)
        if (user) {
          const userName = user.user_metadata?.name || 
                           user.user_metadata?.full_name || 
                           user.name || 
                           '';
          setName(userName);
          setEmail(user.email || '');
        }
      } else {
        let errorText = 'Oops, something went wrong.';
        try {
          const data = await resp.json();
          if (data && data.error) errorText = data.error;
        } catch {
          const text = await resp.text();
          if (text) errorText = text;
        }
        setStatus(errorText);
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setStatus('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Feedback</h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 rounded-lg shadow"
        style={{
          background: colors.background.white,
          fontFamily: font.primary,
          color: colors.text.primary,
        }}
      >
        <h2 className="text-lg sm:text-xl mb-4 font-bold" style={{ color: colors.text.primary }}>
          Share Your Feedback
        </h2>
        <form id="feedbackForm" onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium" style={{ color: colors.text.primary }}>
              Your name
            </label>
            <input
              id="name" name="name" required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md px-3 py-2 sm:py-1.5 text-base outline-1 outline-offset-1 placeholder:text-gray-400 focus:outline-2 focus:outline-offset-2 sm:text-sm"
              style={{
                background: colors.background.white,
                color: colors.text.primary,
                borderColor: colors.border.light,
                fontFamily: font.primary,
                boxShadow: 'none',
              }}
              onFocus={e => e.target.style.outlineColor = formConfig.focus}
              onBlur={e => e.target.style.outlineColor = ''}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium" style={{ color: colors.text.primary }}>
              Your email
            </label>
            <input
              id="email" name="email" type="email" placeholder="you@example.com" required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md px-3 py-2 sm:py-1.5 text-base outline-1 outline-offset-1 placeholder:text-gray-400 focus:outline-2 focus:outline-offset-2 sm:text-sm"
              style={{
                background: colors.background.white,
                color: colors.text.primary,
                borderColor: colors.border.light,
                fontFamily: font.primary,
                boxShadow: 'none',
              }}
              onFocus={e => e.target.style.outlineColor = formConfig.focus}
              onBlur={e => e.target.style.outlineColor = ''}
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium" style={{ color: colors.text.primary }}>
              Subject
            </label>
            <input
              id="subject" name="subject" required
              className="mt-1 block w-full rounded-md px-3 py-2 sm:py-1.5 text-base outline-1 outline-offset-1 placeholder:text-gray-400 focus:outline-2 focus:outline-offset-2 sm:text-sm"
              style={{
                background: colors.background.white,
                color: colors.text.primary,
                borderColor: colors.border.light,
                fontFamily: font.primary,
                boxShadow: 'none',
              }}
              onFocus={e => e.target.style.outlineColor = formConfig.focus}
              onBlur={e => e.target.style.outlineColor = ''}
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium" style={{ color: colors.text.primary }}>
              Type
            </label>
            <select
              id="type" name="type" required
              className="mt-1 block w-full rounded-md px-3 py-2 sm:py-1.5 text-base outline-1 outline-offset-1 focus:outline-2 focus:outline-offset-2 sm:text-sm"
              style={{
                background: colors.background.white,
                color: colors.text.primary,
                borderColor: colors.border.light,
                fontFamily: font.primary,
                boxShadow: 'none',
              }}
              onFocus={e => e.target.style.outlineColor = formConfig.focus}
              onBlur={e => e.target.style.outlineColor = ''}
            >
              <option value="feedback">Feedback</option>
              <option value="bug">Bug</option>
            </select>
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium" style={{ color: colors.text.primary }}>
              Add your comment
            </label>
            <textarea
              id="comment"
              name="comment"
              rows="4"
              required
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
              }}
              className="mt-1 block w-full rounded-md px-3 py-2 sm:py-1.5 text-base outline-1 outline-offset-1 placeholder:text-gray-400 focus:outline-2 focus:outline-offset-2 sm:text-sm"
              style={{
                background: colors.background.white,
                color: colors.text.primary,
                borderColor: colors.border.light,
                fontFamily: font.primary,
                boxShadow: 'none',
              }}
              onFocus={e => e.target.style.outlineColor = formConfig.focus}
              onBlur={e => e.target.style.outlineColor = ''}
              placeholder="Enter your feedback here..."
            />
          </div>

          {/* File Upload Section */}
          <div className="border rounded-lg p-4" style={{ borderColor: colors.border.light, backgroundColor: '#fafafa' }}>
            <div className="block text-sm font-medium mb-3" style={{ color: colors.text.primary }}>
              Upload Files or Screenshots (Optional)
            </div>
            
            <div className="mt-3 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors hover:border-gray-400"
              style={{ borderColor: colors.border.light }}
            >
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm" style={{ color: colors.text.primary }}>
                  <label htmlFor="attachments" className="relative cursor-pointer rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ 
                      color: colors.primary.orange,
                      focusRingColor: colors.primary.orange 
                    }}
                  >
                    <span>Upload files</span>
                    <input
                      id="attachments"
                      name="attachments"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.csv,.xlsx,.xls"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1" style={{ color: colors.text.primary }}>or drag and drop</p>
                </div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>
                  Screenshots (PNG, JPG), Documents (PDF, DOC), Spreadsheets (CSV, XLSX)
                </p>
                <p className="text-xs" style={{ color: colors.text.secondary }}>
                  Up to 10MB per file, 5 files maximum
                </p>
              </div>
            </div>
            
            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 p-3 bg-white rounded-md border" style={{ borderColor: colors.border.light }}>
                <p className="text-sm font-medium mb-3" style={{ color: colors.text.primary }}>
                  Selected files ({selectedFiles.length}):
                </p>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border" style={{ borderColor: colors.border.light }}>
                      <div className="flex items-center flex-1 min-w-0">
                        <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block" style={{ color: colors.text.primary }}>
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown type'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-3 text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  💡 Tip: Screenshots help us understand visual issues, while documents can provide additional context
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={sending}
            className="mt-4 w-full rounded-md px-4 py-3 sm:py-2 font-medium disabled:opacity-50 transition-all hover:shadow-md"
            style={{
              background: colors.primary.orange,
              color: colors.text.white,
              fontFamily: font.primary,
            }}
          >
            {sending ? 'Sending…' : 'Submit Feedback'}
          </button>

          <p
            id="status"
            aria-live="polite"
            className="mt-2 text-center text-sm sm:text-base"
            style={{ color: colors.primary.orange, fontFamily: font.primary }}
          >
            {status}
          </p>
        </form>
      </div>
    </div>
  );
}