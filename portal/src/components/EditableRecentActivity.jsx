import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { PageMention } from '../extensions/PageMention';
import { useAuth } from '../hooks/useAuth';
import { getAvailablePages, PAGE_MAP } from '../utils/pageMentions';

export default function EditableRecentActivity({ section, isAdminAuthenticated = false }) {
  const isAdmin = isAdminAuthenticated;
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
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc list-outside space-y-1 ml-4',
          },
        },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'page-mention-link',
          },
        },
      }),
      PageMention,
    ],
    editable: true,
    content: content?.content || '<ul><li>Activity item 1</li><li>Activity item 2</li><li>Activity item 3</li></ul>',
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[100px] text-gray-900',
        style: `
          & a[data-mention="true"] { color: #ea580c; font-weight: 500; cursor: pointer; text-decoration: underline; }
        `
      },
      handleKeyDown: (view, event) => {
        // Enable keyboard shortcuts for bullet lists
        // Ctrl+Shift+8 or Cmd+Shift+8 for bullet list
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === '8') {
          event.preventDefault();
          editor?.chain().focus().toggleBulletList().run();
          return true;
        }
        return false;
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
              
              const route = linkElement.getAttribute('data-route') || 
                           (href ? href.replace('#', '') : null);
              
              if (route) {
                console.log('handleClick - Navigating to page:', route);
                // Directly trigger navigation without custom event
                localStorage.setItem('idaic-current-page', route);
                window.dispatchEvent(new CustomEvent('navigateToPage', { 
                  detail: { page: route },
                  bubbles: true
                }));
                
                // Also dispatch pageMentionClick for backwards compatibility
                window.dispatchEvent(new CustomEvent('pageMentionClick', { 
                  detail: { route },
                  bubbles: true
                }));
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
      console.log('EditableRecentActivity received pageMentionClick event, route:', route);
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
      
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        const linkText = link.textContent.trim();
        
        // Check if this looks like a page mention (starts with @)
        if (linkText.startsWith('@')) {
          const route = link.getAttribute('data-route') || 
                       (href ? href.replace('#', '') : null);
          
          if (route) {
            // Ensure data attributes are set
            if (!link.getAttribute('data-route')) {
              link.setAttribute('data-route', route);
            }
            if (!link.getAttribute('data-mention')) {
              link.setAttribute('data-mention', 'true');
            }
            
            // Make sure link is clickable
            link.style.cursor = 'pointer';
            link.style.pointerEvents = 'auto';
            link.style.userSelect = 'none';
            link.style.textDecoration = 'underline';
            
            // Store route in a way we can access it
            if (!link.dataset.route) {
              link.dataset.route = route;
            }
            if (!link.dataset.mention) {
              link.dataset.mention = 'true';
            }
            
            // Create a unique handler function for this link
            const linkRoute = route; // Capture route in closure
            const handleLinkClick = (e) => {
              try {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('Link clicked directly - Navigating to page:', linkRoute);
                const navEvent = new CustomEvent('pageMentionClick', { 
                  detail: { route: linkRoute },
                  bubbles: true,
                  cancelable: true
                });
                window.dispatchEvent(navEvent);
              } catch (error) {
                console.error('Error handling link click:', error);
              }
              return false;
            };
            
            // Remove old handlers if they exist (by cloning without handlers)
            const oldOnClick = link.onclick;
            const oldOnMouseDown = link.onmousedown;
            
            // Add new handlers - use capture phase
            link.addEventListener('click', handleLinkClick, { capture: true, once: false });
            link.addEventListener('mousedown', handleLinkClick, { capture: true, once: false });
            
            // Also set as properties as backup
            link.onclick = handleLinkClick;
            link.onmousedown = handleLinkClick;
          }
        }
      });
    };

    const handleEditorClick = (event) => {
      try {
        const target = event.target;
        // Check if clicked element is a link or inside a link
        const linkElement = target.closest('a');
        if (linkElement) {
          const href = linkElement.getAttribute('href');
          const linkText = linkElement.textContent.trim();
          
          // Check if it's a mention (starts with @) or has data-mention
          if (linkText.startsWith('@') || linkElement.getAttribute('data-mention') === 'true') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const route = linkElement.getAttribute('data-route') || 
                         (href ? href.replace('#', '') : null);
            if (route) {
              console.log('Editor click handler - Navigating to page:', route);
              // Dispatch navigation event
              const navEvent = new CustomEvent('pageMentionClick', { 
                detail: { route },
                bubbles: true,
                cancelable: true
              });
              window.dispatchEvent(navEvent);
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
              console.log('Editor mousedown - Navigating to page:', route);
              const navEvent = new CustomEvent('pageMentionClick', { 
                detail: { route },
                bubbles: true,
                cancelable: true
              });
              window.dispatchEvent(navEvent);
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
      // If no content exists, set default with 3 bullet points
      setContent({ content: '<ul><li>Activity item 1</li><li>Activity item 2</li><li>Activity item 3</li></ul>' });
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [section]);

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content.content || '<ul><li>Activity item 1</li><li>Activity item 2</li><li>Activity item 3</li></ul>');
    }
  }, [editor, content]);

  // Update editor editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [editor, isEditing]);

  // Handle content save
  const handleSave = async (newContent) => {
    if (!newContent || newContent === '<p></p>') return;

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
      <div className="bg-white border rounded-lg p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-end mb-4">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mr-auto">Recent Activity</h3>
        {isAdmin && (
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
            {isEditing ? 'Save' : 'Edit'}
          </Button>
        )}
      </div>

      {error ? (
        <div className="text-red-500 text-center text-sm">
          Error: {error}
        </div>
      ) : (
        <div 
          className="relative group"
          onDoubleClick={() => !isEditing && setIsEditing(true)}
        >
          {/* Toolbar */}
          {isEditing && (
            <div className="mb-2 flex gap-2 p-2 bg-gray-50 rounded border border-gray-200 formatting-toolbar">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  editor?.isActive('bulletList')
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 border border-transparent'
                }`}
                title="Toggle Bullet List (Ctrl+Shift+8)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Bullets</span>
              </button>
              <div className="text-xs text-gray-500 flex items-center px-2">
                Tip: Type "- " or "* " at the start of a line to create bullets
              </div>
              <div className="w-px h-6 my-auto bg-gray-200" />
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPageMentionDropdown(!showPageMentionDropdown);
                  }}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-colors text-gray-700 hover:bg-gray-100 border border-transparent"
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
                              const tr = state.tr
                                .delete(from, to)
                                .insertText(text, from)
                                .addMark(
                                  from,
                                  from + text.length - 1, // -1 to exclude the trailing space
                                  linkMark.create({
                                    href: `#${route}`,
                                  })
                                );
                              
                              view.dispatch(tr);
                              
                              // Add data attributes to the DOM element
                              setTimeout(() => {
                                // Find all links in the editor and update the one we just created
                                const editorDom = view.dom;
                                const allLinks = editorDom.querySelectorAll('a[href="#' + route + '"]');
                                
                                // Find the link that contains our text
                                allLinks.forEach(link => {
                                  if (link.textContent.trim() === `@${page}`) {
                                    link.setAttribute('data-route', route);
                                    link.setAttribute('data-mention', 'true');
                                    link.style.cursor = 'pointer';
                                    // Ensure it's clickable
                                    link.onclick = (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const navEvent = new CustomEvent('pageMentionClick', { 
                                        detail: { route } 
                                      });
                                      window.dispatchEvent(navEvent);
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
                ? 'min-h-[150px] border border-gray-300 rounded-lg p-4 bg-gray-50 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500' 
                : content ? '' : 'text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'
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
                <p className="text-sm text-gray-500">Click to add content</p>
              </div>
            )}
            <div className="prose max-w-none">
              <EditorContent 
                editor={editor} 
                className="min-h-[100px] [&_ul]:list-disc [&_ul]:list-outside [&_ul]:ml-4 [&_ul]:space-y-1 [&_li]:text-base [&_li]:pl-0" 
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

