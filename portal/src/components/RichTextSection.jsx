import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { PageMention } from '../extensions/PageMention';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../config/supabase';
import { getAvailablePages, PAGE_MAP } from '../utils/pageMentions';
import { getProtectedUrl } from '../utils/protectedUrls';

export default function RichTextSection({ section, isAdmin = false }) {
  const { user, getAuthToken } = useAuth();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPageMentionDropdown, setShowPageMentionDropdown] = useState(false);
  const mentionDropdownRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2]
        },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'page-mention-link',
          },
          // Allow clicking on links
          inclusive: false,
        },
      }),
      Underline,
      PageMention,
    ],
    editable: true,
    content: content?.content || '',
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[100px] text-gray-900',
        style: `
          & h1 { font-size: 2.5em; margin-bottom: 0.5em; }
          & h2 { font-size: 1.75em; margin-bottom: 0.5em; }
          & p { font-size: 1.1em; margin-bottom: 0.5em; }
          & a[data-mention="true"] { color: #ea580c !important; font-weight: 500 !important; cursor: pointer !important; text-decoration: underline !important; }
          & a[data-mention="true"]:hover { color: #c2410c !important; }
        `
      },
      handleClick: (view, pos, event) => {
        try {
          const target = event.target;
          // Check if clicked on a link (mention or regular)
          const linkElement = target.closest('a');
          if (linkElement) {
            const linkText = linkElement.textContent.trim();
            const href = linkElement.getAttribute('href');
            
            // If it's a mention (starts with @) or has data-mention attribute
            if (linkText.startsWith('@') || linkElement.getAttribute('data-mention') === 'true') {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              
              // Try to get route from data-route attribute first
              let route = linkElement.getAttribute('data-route');
              
              // If no route in data attribute, try to extract from href
              if (!route && href) {
                if (href.startsWith('#')) {
                  route = href.substring(1);
                } else if (href.includes('?page=')) {
                  try {
                    const url = new URL(href);
                    route = url.searchParams.get('page');
                  } catch (e) {
                    const match = href.match(/[?&]page=([^&]+)/);
                    route = match ? decodeURIComponent(match[1]) : null;
                  }
                } else {
                  // Try to match from PAGE_MAP
                  const mentionName = linkText.substring(1).trim();
                  route = PAGE_MAP[mentionName] || null;
                }
              }
              
              if (route) {
                // Use protected URL (opens in new tab)
                const protectedUrl = getProtectedUrl(route);
                console.log('handleClick - Opening protected URL:', protectedUrl);
                window.open(protectedUrl, '_blank', 'noopener,noreferrer');
              } else if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                // If it's already a full URL, just open it
                console.log('handleClick - Opening URL:', href);
                window.open(href, '_blank', 'noopener,noreferrer');
              }
              return true; // Tell ProseMirror we handled this
            }
          }
        } catch (error) {
          console.error('Error in handleClick:', error);
        }
        return false; // Let ProseMirror handle other clicks
      },
    },
  });

  // Listen for navigation events
  useEffect(() => {
    const handleNavigation = (event) => {
      const route = event.detail?.route;
      console.log('RichTextSection received pageMentionClick event, route:', route);
      if (route) {
        // Update current page in localStorage and trigger navigation
        localStorage.setItem('idaic-current-page', route);
        // Trigger a custom event that App.jsx can listen to
        console.log('Dispatching navigateToPage event with page:', route);
        window.dispatchEvent(new CustomEvent('navigateToPage', { detail: { page: route } }));
      }
    };

    window.addEventListener('pageMentionClick', handleNavigation);
    return () => {
      window.removeEventListener('pageMentionClick', handleNavigation);
    };
  }, []);

  // Add click listener and ensure all mention links are clickable
  useEffect(() => {
    if (!editor) return;

    const setupMentionLinks = () => {
      const editorElement = editor.view.dom;
      // Find ALL links, not just those with href starting with #
      const allLinks = editorElement.querySelectorAll('a');
      
      console.log('Setting up mention links, found', allLinks.length, 'links');
      
      allLinks.forEach((link, index) => {
        const href = link.getAttribute('href');
        const linkText = link.textContent.trim();
        
        console.log(`Link ${index}:`, {
          text: linkText,
          href: href,
          hasDataRoute: !!link.getAttribute('data-route'),
          hasDataMention: !!link.getAttribute('data-mention'),
          tagName: link.tagName
        });
        
        // Check if this looks like a page mention (starts with @) or has data-mention
        const isMention = linkText.startsWith('@') || link.getAttribute('data-mention') === 'true';
        
        if (isMention) {
          // Try to extract route from various sources
          let route = link.getAttribute('data-route');
          
          if (!route && href) {
            // Try to extract route from href
            if (href.startsWith('#')) {
              route = href.substring(1);
            } else if (href.includes('?page=')) {
              const match = href.match(/[?&]page=([^&]+)/);
              route = match ? decodeURIComponent(match[1]) : null;
            } else {
              // If it's already a full URL, try to extract the page parameter
              try {
                const url = new URL(href);
                route = url.searchParams.get('page');
              } catch (e) {
                // If URL parsing fails, try regex
                const match = href.match(/[?&]page=([^&]+)/);
                route = match ? decodeURIComponent(match[1]) : null;
              }
            }
          }
          
          // If still no route, try to match from PAGE_MAP based on link text
          if (!route && linkText.startsWith('@')) {
            const mentionName = linkText.substring(1).trim();
            route = PAGE_MAP[mentionName] || null;
          }
          
          if (route) {
            console.log('Setting up click handler for link:', linkText, 'route:', route);
            
            // Get the protected URL for this route
            const protectedUrl = getProtectedUrl(route);
            
            // Ensure data attributes are set
            link.setAttribute('data-route', route);
            link.setAttribute('data-mention', 'true');
            
            // Set the href to the protected URL
            link.setAttribute('href', protectedUrl);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            
            // Make sure link is clickable and styled orange
            link.style.cursor = 'pointer';
            link.style.pointerEvents = 'auto';
            link.style.userSelect = 'none';
            link.style.textDecoration = 'underline';
            link.style.color = '#ea580c';
            link.style.fontWeight = '500';
            
            // Store route in dataset
            link.dataset.route = route;
            link.dataset.mention = 'true';
            
            // Create a unique handler function for this link
            const linkRoute = route; // Capture route in closure
            const handleLinkClick = (e) => {
              console.log('=== LINK CLICKED ===', linkRoute, e);
              try {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // Use protected URL (opens in new tab)
                const protectedUrl = getProtectedUrl(linkRoute);
                console.log('Link clicked - Opening protected URL:', protectedUrl);
                window.open(protectedUrl, '_blank', 'noopener,noreferrer');
              } catch (error) {
                console.error('Error handling link click:', error);
              }
              return false;
            };
            
            // Remove existing listeners by cloning
            const newLink = link.cloneNode(true);
            link.parentNode?.replaceChild(newLink, link);
            
            // Add handlers to the new link
            newLink.addEventListener('click', handleLinkClick, true);
            newLink.addEventListener('mousedown', handleLinkClick, true);
            newLink.onclick = handleLinkClick;
            newLink.onmousedown = handleLinkClick;
            
            // Re-apply styles and attributes to ensure they stick
            newLink.style.cursor = 'pointer';
            newLink.style.pointerEvents = 'auto';
            newLink.style.userSelect = 'none';
            newLink.style.textDecoration = 'underline';
            newLink.style.color = '#ea580c';
            newLink.style.fontWeight = '500';
            newLink.setAttribute('href', protectedUrl);
            newLink.setAttribute('target', '_blank');
            newLink.setAttribute('rel', 'noopener noreferrer');
            newLink.setAttribute('data-route', route);
            newLink.setAttribute('data-mention', 'true');
            newLink.dataset.route = route;
            newLink.dataset.mention = 'true';
          }
        }
      });
    };

    const handleEditorClick = (event) => {
      console.log('Editor click detected, target:', event.target, event.target.tagName);
      try {
        const target = event.target;
        // Check if clicked element is a link or inside a link
        const linkElement = target.closest('a');
        console.log('Closest link element:', linkElement);
        if (linkElement) {
          const href = linkElement.getAttribute('href');
          const linkText = linkElement.textContent.trim();
          console.log('Link found:', { text: linkText, href: href, dataRoute: linkElement.getAttribute('data-route') });
          
          // Check if it's a mention (starts with @) or has data-mention
          if (linkText.startsWith('@') || linkElement.getAttribute('data-mention') === 'true') {
            console.log('=== MENTION LINK CLICKED IN EDITOR ===');
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const route = linkElement.getAttribute('data-route') || 
                         (href ? href.replace('#', '') : null);
            if (route) {
              // Use protected URL (opens in new tab)
              const protectedUrl = getProtectedUrl(route);
              console.log('Editor click - Opening protected URL:', protectedUrl);
              window.open(protectedUrl, '_blank', 'noopener,noreferrer');
            }
            return false;
          }
        }
      } catch (error) {
        console.error('Error in editor click handler:', error);
      }
      return undefined; // Don't return false, let other handlers process
    };

    const handleEditorMouseDown = (event) => {
      try {
        const target = event.target;
        const linkElement = target.closest('a');
        if (linkElement) {
          const linkText = linkElement.textContent.trim();
          if (linkText.startsWith('@') || linkElement.getAttribute('data-mention') === 'true') {
            // Prevent default to stop text selection
            event.preventDefault();
            const href = linkElement.getAttribute('href');
            const route = linkElement.getAttribute('data-route') || 
                         (href ? href.replace('#', '') : null);
            if (route) {
              // Use protected URL (opens in new tab)
              const protectedUrl = getProtectedUrl(route);
              console.log('Editor mousedown - Opening protected URL:', protectedUrl);
              window.open(protectedUrl, '_blank', 'noopener,noreferrer');
            }
            return false;
          }
        }
      } catch (error) {
        console.error('Error in editor mousedown handler:', error);
      }
      return undefined;
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleEditorClick, true);
    editorElement.addEventListener('mousedown', handleEditorMouseDown, true);
    
    // Setup links initially
    setupMentionLinks();
    
    // Watch for content changes and setup new links
    const observer = new MutationObserver(() => {
      setupMentionLinks();
    });
    
    observer.observe(editorElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'data-route', 'data-mention']
    });
    
    // Also setup links when editor content updates
    editor.on('update', setupMentionLinks);
    
    return () => {
      editorElement.removeEventListener('click', handleEditorClick, true);
      editorElement.removeEventListener('mousedown', handleEditorMouseDown, true);
      observer.disconnect();
      editor.off('update', setupMentionLinks);
    };
  }, [editor]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(event.target)) {
        setShowPageMentionDropdown(false);
      }
    };

    if (showPageMentionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPageMentionDropdown]);

  // Fetch current content
  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/.netlify/functions/contentSections?section=${section}`);
      if (!response.ok) throw new Error('Failed to fetch content');
      const data = await response.json();
      setContent(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching content:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [section]);

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content.content);
    }
  }, [editor, content]);

  // Update editor editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [editor, isEditing]);

  // Handle content save with debounce
  const handleSave = async (newContent) => {
    if (!newContent || newContent === '<p></p>') return; // Don't save empty content

    try {
      setSaving(true);
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No active session found. Please log in.');
      }
      const response = await fetch('/.netlify/functions/contentSections', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          section: section,
          content: newContent,
          content_type: 'rich_text',
          user_id: user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save content');
      }

      const savedContent = await response.json();
      // Update local state directly instead of refetching
      setContent(savedContent);
      setError(null);
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6 mb-6">
      <div className="flex items-center justify-end mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mr-auto">
          {section === 'home_content' ? 'Latest Updates' : 'Chapter Information'}
        </h2>
        <Button
          color="blue"
          outline
          onClick={() => {
            if (isEditing) {
              setIsEditing(false);
              handleSave(editor?.getHTML());
            } else {
              setIsEditing(true);
              setTimeout(() => editor?.commands.focus(), 100);
            }
          }}
        >
          {isEditing ? 'Save Content' : 'Edit Content'}
        </Button>
      </div>

      {error ? (
        <div className="text-red-500 text-center">
          Error: {error}
        </div>
      ) : (
        <div 
          className="relative group"
          onDoubleClick={() => !isEditing && setIsEditing(true)}
        >
          {/* Selection Toolbar */}
          {isEditing && (
            <div 
              className="fixed z-50 bg-white shadow-lg rounded-lg border border-gray-300 p-1.5 flex gap-1.5 invisible opacity-0 transition-opacity formatting-toolbar"
              style={{
                visibility: editor?.view?.state?.selection?.empty === false ? 'visible' : 'hidden',
                opacity: editor?.view?.state?.selection?.empty === false ? 1 : 0,
                top: typeof window !== 'undefined' ? 
                  Math.max(
                    10,
                    (window.getSelection()?.getRangeAt(0)?.getBoundingClientRect()?.top || 0) - 50
                  ) + 'px' : '0',
                left: typeof window !== 'undefined' ? 
                  Math.max(
                    10,
                    (window.getSelection()?.getRangeAt(0)?.getBoundingClientRect()?.left || 0)
                  ) + 'px' : '0',
              }}
            >
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`px-2 py-1 rounded text-sm font-bold transition-colors ${
                  editor?.isActive('heading', { level: 1 })
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ fontSize: '1.2em' }}
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`px-2 py-1 rounded text-sm font-semibold transition-colors ${
                  editor?.isActive('heading', { level: 2 })
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ fontSize: '1.1em' }}
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().setParagraph().run()}
                className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                  editor?.isActive('paragraph')
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Normal
              </button>
              <div className="w-px h-6 my-auto bg-gray-200" />
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                  editor?.isActive('bold')
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`px-2 py-1 rounded text-sm font-medium italic transition-colors ${
                  editor?.isActive('italic')
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                I
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                className={`px-2 py-1 rounded text-sm font-medium underline transition-colors ${
                  editor?.isActive('underline')
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                U
              </button>
              <div className="w-px h-6 my-auto bg-gray-200" />
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                  editor?.isActive('bulletList')
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                •
              </button>
              <div className="w-px h-6 my-auto bg-gray-200" />
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPageMentionDropdown(!showPageMentionDropdown);
                  }}
                  className="px-2 py-1 rounded text-sm font-medium transition-colors text-gray-700 hover:bg-gray-100"
                  title="Insert page mention"
                >
                  @
                </button>
                {showPageMentionDropdown && (
                  <div
                    ref={mentionDropdownRef}
                    className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto min-w-[200px] z-50"
                    style={{ maxHeight: '200px' }}
                  >
                    {getAvailablePages().map((page) => (
                      <div
                        key={page}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const route = PAGE_MAP[page];
                          if (editor && route) {
                            // Insert the mention as a link using ProseMirror transaction (like PageMention extension)
                            const { state, view } = editor;
                            const { from, to } = state.selection;
                            const text = `@${page} `;
                            const linkMark = state.schema.marks.link;
                            
                            if (linkMark) {
                              const protectedUrl = getProtectedUrl(route);
                              const tr = state.tr
                                .delete(from, to)
                                .insertText(text, from)
                                .addMark(
                                  from,
                                  from + text.length - 1, // -1 to exclude the trailing space
                                  linkMark.create({
                                    href: protectedUrl,
                                    'data-route': route,
                                    'data-mention': 'true',
                                  })
                                );
                              
                              view.dispatch(tr);
                              
                              // Add data attributes and click handler to the DOM element
                              setTimeout(() => {
                                // Find all links in the editor and update the one we just created
                                const editorDom = view.dom;
                                const allLinks = editorDom.querySelectorAll('a[data-route="' + route + '"]');
                                
                                // Find the link that contains our text
                                allLinks.forEach(link => {
                                  if (link.textContent.trim() === `@${page}`) {
                                    link.setAttribute('data-route', route);
                                    link.setAttribute('data-mention', 'true');
                                    link.setAttribute('href', protectedUrl);
                                    link.setAttribute('target', '_blank');
                                    link.setAttribute('rel', 'noopener noreferrer');
                                    link.style.cursor = 'pointer';
                                    link.style.textDecoration = 'underline';
                                    link.style.color = '#ea580c';
                                    // Ensure it's clickable
                                    link.onclick = (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(protectedUrl, '_blank', 'noopener,noreferrer');
                                      return false;
                                    };
                                  }
                                });
                              }, 50);
                            } else {
                              // Fallback if link mark doesn't exist
                              editor.chain()
                                .focus()
                                .deleteRange({ from, to })
                                .insertContent(text)
                                .run();
                            }
                            
                            setShowPageMentionDropdown(false);
                          }
                        }}
                      >
                        <span className="font-medium text-gray-900">@{page}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Editor */}
          <div 
            className={`transition-colors ${
              isEditing 
                ? 'min-h-[200px] border border-gray-300 rounded-lg p-4 bg-gray-50 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500' 
                : content ? '' : 'text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'
            }`}
            onClick={() => {
              if (!isEditing) {
                setIsEditing(true);
                // Give time for editor to become editable
                setTimeout(() => {
                  editor?.commands.focus();
                }, 100);
              }
            }}
            onBlur={(e) => {
              // Don't trigger blur when clicking formatting buttons
              if (e.relatedTarget?.closest('.formatting-toolbar')) {
                return;
              }
              // Don't save if clicking inside the editor
              if (e.relatedTarget?.closest('.ProseMirror')) {
                return;
              }
              if (isEditing) {
                setIsEditing(false);
                handleSave(editor?.getHTML());
              }
            }}
          >
            {!content && !isEditing && (
              <div className="text-gray-400">
                <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500">Click to add content</p>
              </div>
            )}
            <div className="prose max-w-none">
              <style>{`
                .ProseMirror a[data-mention="true"],
                .prose a[data-mention="true"] {
                  color: #ea580c !important;
                  font-weight: 500 !important;
                  cursor: pointer !important;
                  text-decoration: underline !important;
                }
                .ProseMirror a[data-mention="true"]:hover,
                .prose a[data-mention="true"]:hover {
                  color: #c2410c !important;
                }
                .ProseMirror a[data-mention="true"]:visited,
                .prose a[data-mention="true"]:visited {
                  color: #ea580c !important;
                }
              `}</style>
              <EditorContent 
                editor={editor} 
                className="min-h-[100px] [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-3 [&_p]:text-base [&_p]:mb-2" 
              />
            </div>
          </div>

          {saving && (
            <div className="absolute top-2 right-2 text-sm text-blue-500">
              Saving...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
