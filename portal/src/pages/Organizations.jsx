import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { colors } from '../config/colors';
import { ErrorMessage, SuccessMessage } from '../components/ErrorMessage';
import Favicon from '../components/Favicon';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Organizations() {
  const { user } = useOutletContext();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showSlider, setShowSlider] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    org_id: '',
    name: '',
    bio: '',
    location: '',
    website: '',
    logo_display: false,
    founding_member: false
  });

  // Load organizations on component mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📝 Loading organizations...');
      
      const response = await fetch('/.netlify/functions/orgs');
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ API Error:', data);
        throw new Error(data.error || 'Failed to load organizations');
      }
      
      console.log('✅ Organizations loaded:', data);
      setOrganizations(data);
    } catch (err) {
      console.error('❌ Error loading organizations:', err);
      setError(err.message || 'Failed to load organizations. Please check if the database is set up correctly.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // If there's a logo file and we have an org_id, upload the logo first
      let uploadedLogoUrl = null;
      if (logoFile && formData.org_id) {
        console.log('📤 Logo file detected, uploading before saving organization...');
        try {
          uploadedLogoUrl = await uploadLogoFile(logoFile, formData.org_id);
          console.log('✅ Logo uploaded successfully, URL:', uploadedLogoUrl);
        } catch (logoErr) {
          console.error('❌ Logo upload failed:', logoErr);
          setError(`Logo upload failed: ${logoErr.message}. Organization will still be saved.`);
          // Continue with organization save even if logo upload fails
        }
      }

      // Determine the org_id - use formData.org_id if editing, or the newly created org id
      let finalOrgId = formData.org_id;
      
      const method = editingOrg ? 'PUT' : 'POST';
      const url = editingOrg 
        ? `/.netlify/functions/orgs?id=${editingOrg.id}`
        : '/.netlify/functions/orgs';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingOrg ? formData : { 
            name: formData.name, 
            bio: formData.bio, 
            location: formData.location, 
            website: formData.website,
            logo_display: formData.logo_display || false, // Use formData value
            founding_member: formData.founding_member || false // Use formData value
          }),
          updated_by: user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save organization');
      }

      const result = await response.json();
      
      if (result.organization) {
        console.log('✅ Organization saved successfully:', result.organization);
        console.log('🆔 Organization UUID:', result.organization.id);
        
        // If this was a new organization and we have a logo file, upload it now
        if (!editingOrg && logoFile && result.organization.id) {
          console.log('📤 New organization created, uploading logo...');
          try {
            await uploadLogoFile(logoFile, result.organization.id);
            console.log('✅ Logo uploaded for new organization');
            // Reload to get the updated organization with logo
            await loadOrganizations();
          } catch (logoErr) {
            console.error('❌ Logo upload failed for new org:', logoErr);
            // Don't fail the whole operation
          }
        }
        
        if (!editingOrg) {
          // New organization created
          console.log('📝 New organization created with UUID:', result.organization.id);
        }
      }

      let successMsg = editingOrg ? 'Organization updated successfully!' : `Organization "${result.organization.name}" created successfully!`;
      if (logoFile && uploadedLogoUrl) {
        successMsg += ' Logo uploaded successfully.';
      }
      
      setSuccess(successMsg);
      setShowForm(false);
      setEditingOrg(null);
      setFormData({ org_id: '', name: '', bio: '', location: '', website: '', logo_display: false, founding_member: false });
      setLogoFile(null);
      loadOrganizations();
    } catch (err) {
      setError(err.message);
    }
  };

  // Helper function to upload logo file
  const uploadLogoFile = async (file, orgId) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onerror = (error) => {
        console.error('❌ FileReader error:', error);
        reject(new Error('Failed to read file'));
      };
      
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result.split(',')[1];
          
          if (!base64Data) {
            reject(new Error('Failed to extract base64 data from file'));
            return;
          }
          
          const response = await fetch('/.netlify/functions/uploadLogo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              org_id: orgId,
              logo_name: file.name,
              logo_data: base64Data,
              logo_type: file.type,
              is_primary: true,
              updated_by: user?.id
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            reject(new Error(errorData.error || 'Failed to upload logo'));
            return;
          }

          const result = await response.json();
          
          if (result?.organization?.logo_url) {
            resolve(result.organization.logo_url);
          } else {
            reject(new Error('Logo uploaded but URL not returned'));
          }
        } catch (err) {
          reject(err);
        }
      };
      
      reader.readAsDataURL(file);
    });
  };

  const handleEdit = (org) => {
    setEditingOrg(org);
    setFormData({
      org_id: org.id, // Use the organization's UUID instead of org.org_id
      name: org.name,
      bio: org.bio || '',
      location: org.location || '',
      website: org.website || '',
      logo_display: org.logo_display || false,
      founding_member: org.founding_member || false
    });
    setShowForm(true);
  };

  const handleDelete = (org) => {
    setOrgToDelete(org);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!orgToDelete) return;

    try {
      const response = await fetch(`/.netlify/functions/orgs?id=${orgToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete organization');
      }

      setSuccess('Organization deleted successfully!');
      loadOrganizations();
      setShowDeleteConfirm(false);
      setOrgToDelete(null);
    } catch (err) {
      setError(err.message);
      setShowDeleteConfirm(false);
      setOrgToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setOrgToDelete(null);
  };

  const handleViewDetails = (org) => {
    setSelectedOrg(org);
    setShowSlider(true);
  };

  const handleLogoUpload = async (file) => {
    console.log('🎯 handleLogoUpload called with file:', file?.name);
    
    if (!file) {
      console.error('❌ No file provided to handleLogoUpload');
      return;
    }
    
    // Check if org_id is available
    if (!formData.org_id) {
      const errorMsg = 'Organization ID is missing. Please save the organization first before uploading a logo.';
      setError(errorMsg);
      console.error('❌ formData.org_id is missing:', formData);
      console.error('❌ Cannot upload without org_id. User needs to save organization first.');
      return;
    }
    
    console.log('✅ org_id available:', formData.org_id);
    
    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
      const errorMsg = 'Please select an image file (PNG, JPG, GIF, SVG, etc.)';
      setError(errorMsg);
      console.error('❌ Invalid file type:', file.type);
      return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      const errorMsg = 'File size must be less than 5MB';
      setError(errorMsg);
      console.error('❌ File too large:', file.size, 'bytes');
      return;
    }
    
    console.log('✅ File validation passed, starting upload process...');
    setUploadingLogo(true);
    setError('');
    setSuccess(''); // Clear any previous success messages

    try {
      // Convert file to base64
      console.log('📖 Reading file as base64...');
      const reader = new FileReader();
      
      reader.onerror = (error) => {
        console.error('❌ FileReader error:', error);
        setError('Failed to read file. Please try again.');
        setUploadingLogo(false);
      };
      
      reader.onloadend = async () => {
        console.log('✅ File read complete, converting to base64...');
        const base64Data = reader.result.split(',')[1];
        
        if (!base64Data) {
          console.error('❌ Failed to extract base64 data from file');
          setError('Failed to process file. Please try again.');
          setUploadingLogo(false);
          return;
        }
        
        console.log('✅ Base64 data extracted, length:', base64Data.length);
        console.log('🔄 Uploading logo for org_id:', formData.org_id);
        console.log('📁 File details:', { name: file.name, type: file.type, size: file.size });
        console.log('📊 Upload payload:', {
          org_id: formData.org_id,
          logo_name: file.name,
          logo_type: file.type,
          is_primary: true,
          has_logo_data: !!base64Data
        });
        
        const response = await fetch('/.netlify/functions/uploadLogo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: formData.org_id,
            logo_name: file.name,
            logo_data: base64Data,
            logo_type: file.type,
            is_primary: true,
            updated_by: user?.id // Include updated_by for logo uploads
          })
        });

        console.log('📤 Upload response status:', response.status);
        console.log('📤 Upload response headers:', Object.fromEntries(response.headers.entries()));
        
        let result = null;
        if (!response.ok) {
          try {
            const errorData = await response.json();
            console.error('❌ Upload error response:', errorData);
            console.error('❌ Error message:', errorData.error);
            console.error('❌ Error details:', errorData.details);
            console.error('❌ Error hint:', errorData.hint);
            console.error('❌ Response status:', response.status);
            
            // Show the error to the user with all details
            const errorMsg = errorData.error || 'Failed to upload logo';
            const detailsMsg = errorData.details ? `\nDetails: ${errorData.details}` : '';
            const hintMsg = errorData.hint ? `\nHint: ${errorData.hint}` : '';
            setError(`${errorMsg}${detailsMsg}${hintMsg}`);
            throw new Error(errorMsg);
          } catch (e) {
            console.error('❌ Upload failed:', e);
            if (!error) {
              // If we couldn't parse error, show generic message
              setError(`Failed to upload logo. Server responded with status ${response.status}. Check browser console for details.`);
            }
            throw new Error('Failed to upload logo');
          }
        } else {
          try {
            result = await response.json();
            console.log('✅ Upload result:', result);
            console.log('✅ Upload result type:', typeof result);
            console.log('✅ Upload result keys:', result ? Object.keys(result) : 'null');
          } catch (parseErr) {
            console.error('⚠️ Could not parse response JSON:', parseErr);
            setError('Logo upload may have succeeded, but could not parse response. Please check if logo appears in storage.');
          }
        }

        if (!result?.organization?.logo_url) {
          console.log('❌ Logo URL not returned in response');
          setError('Logo uploaded to storage but URL not updated in organization.');
        } else {
          console.log('✅ Logo URL updated successfully:', result.organization.logo_url);
          
          // After successful logo upload, also save any pending form changes (like logo_display)
          // This ensures the form state is synced with the database
          let profileUpdated = false;
          if (editingOrg && formData.org_id) {
            try {
              // Check if there are any changes to save (compare with original organization)
              const hasChanges = 
                formData.name !== editingOrg.name ||
                formData.bio !== (editingOrg.bio || '') ||
                formData.location !== (editingOrg.location || '') ||
                formData.website !== (editingOrg.website || '') ||
                formData.logo_display !== (editingOrg.logo_display || false) ||
                formData.founding_member !== (editingOrg.founding_member || false);

              if (hasChanges) {
                const updateResponse = await fetch(`/.netlify/functions/orgs?id=${formData.org_id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: formData.name,
                    bio: formData.bio,
                    location: formData.location,
                    website: formData.website,
                    logo_display: formData.logo_display || false,
                    founding_member: formData.founding_member || false,
                    updated_by: user?.id
                  })
                });

                if (updateResponse.ok) {
                  console.log('✅ Organization form data also updated after logo upload');
                  profileUpdated = true;
                } else {
                  console.warn('⚠️ Logo uploaded but form update had issues');
                  setSuccess('Logo uploaded successfully. Organization profile could not be updated.');
                }
              }
            } catch (updateErr) {
              console.error('⚠️ Error updating form data after logo upload:', updateErr);
              setSuccess('Logo uploaded successfully.');
            }
          }
          
          // Set appropriate success message based on what was updated
          if (profileUpdated) {
            setSuccess('Logo uploaded successfully. Organization profile has been updated.');
          } else {
            setSuccess('Logo uploaded successfully.');
          }
          
          // Update formData with the returned organization data to keep it in sync
          if (result.organization) {
            setFormData(prev => ({
              ...prev,
              logo_url: result.organization.logo_url
            }));
          }
        }
        setLogoFile(null);
        loadOrganizations(); // Refresh the list
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('❌ Logo upload error:', err);
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('📁 File selected:', file.name, file.type, file.size);
      // Validate file type
      if (!file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        setError('Please select an image file (PNG, JPG, GIF, SVG, etc.)');
        return;
      }
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setLogoFile(file);
      setError(''); // Clear any previous errors
      console.log('✅ File ready for upload when Update is clicked');
    } else {
      console.warn('⚠️ No file selected');
      setLogoFile(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          setError('File size must be less than 5MB');
          return;
        }
        setLogoFile(file);
        setError(''); // Clear any previous errors
        console.log('✅ File ready for upload when Update is clicked');
      } else {
        setError('Please select an image file (PNG, JPG, GIF, SVG, etc.).');
      }
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const filteredOrganizations = organizations
    .filter(org =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.location && org.location.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      // Handle boolean values (logo_display, founding_member)
      if (typeof aVal === 'boolean') {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      }
      
      // Convert to string for comparison if needed
      if (typeof aVal !== 'string') aVal = String(aVal);
      if (typeof bVal !== 'string') bVal = String(bVal);
      
      if (aVal.toLowerCase() < bVal.toLowerCase()) return sortDir === 'asc' ? -1 : 1;
      if (aVal.toLowerCase() > bVal.toLowerCase()) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) {
    return (
      <div className="py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading organizations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Organizations</h1>
        <p className="text-gray-600">Manage organization information and logos</p>
      </div>

      {/* Search and Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingOrg(null);
            setFormData({ org_id: '', name: '', bio: '', location: '', website: '', logo_display: false, founding_member: false });
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          Add Organization
        </button>
      </div>

      {/* Organizations Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[80vh] overflow-y-auto pb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Organization
                  <span className="ml-1 align-middle" style={{ color: colors.primary.orange }}>
                    {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('location')}
                >
                  Location
                  <span className="ml-1 align-middle" style={{ color: colors.primary.orange }}>
                    {sortBy === 'location' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('website')}
                >
                  Website
                  <span className="ml-1 align-middle" style={{ color: colors.primary.orange }}>
                    {sortBy === 'website' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('logo_display')}
                >
                  Logo Display
                  <span className="ml-1 align-middle" style={{ color: colors.primary.orange }}>
                    {sortBy === 'logo_display' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('founding_member')}
                >
                  Founding Member
                  <span className="ml-1 align-middle" style={{ color: colors.primary.orange }}>
                    {sortBy === 'founding_member' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrganizations.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{org.name}</div>
                      {org.bio && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">{org.bio}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {org.location || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {org.website ? (
                      <a 
                        href={org.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-500"
                      >
                        {org.website}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {org.logo_url ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        org.logo_display 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {org.logo_display ? 'Yes' : 'No'}
                      </span>
                    ) : (
                      <span className="text-gray-400">No logo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      org.founding_member 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {org.founding_member ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleViewDetails(org)}
                      className="text-blue-600 hover:text-blue-500"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleEdit(org)}
                      className="text-orange-600 hover:text-orange-500"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(org)}
                      className="text-red-600 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {/* Spacer row to ensure last row is fully visible */}
              <tr>
                <td colSpan="6" className="h-12"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Organization Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingOrg ? 'Edit Organization' : 'Add Organization'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Company Name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    rows={3}
                    placeholder="Organization description..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="City, Country"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="https://company.com"
                  />
                </div>

                {/* Logo Upload Section */}
                {editingOrg && formData.org_id && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
                        isDragOver
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="space-y-1 text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="logo-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-orange-600 hover:text-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-orange-500"
                          >
                            <span>Upload a file</span>
                            <input
                              id="logo-upload"
                              name="logo-upload"
                              type="file"
                              className="sr-only"
                              accept="image/*,.svg"
                              onChange={handleFileChange}
                              disabled={uploadingLogo}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF, SVG up to 5MB</p>
                        {uploadingLogo && (
                          <p className="text-xs text-orange-600 mt-2">Uploading logo... Please wait.</p>
                        )}
                        {logoFile && !uploadingLogo && (
                          <div className="mt-2">
                            <p className="text-xs text-green-600 mb-1">File selected: {logoFile.name}</p>
                            <p className="text-xs text-gray-500">Logo will be uploaded when you click Update</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!editingOrg && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Note:</span> Save the organization first, then you'll be able to upload a logo.
                    </p>
                  </div>
                )}

                {/* Logo Display Toggle - Only show when editing and organization has a logo */}
                {editingOrg && formData.org_id && (
                  <div className="mt-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.logo_display || false}
                        onChange={(e) => setFormData({ ...formData, logo_display: e.target.checked })}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Display logo on members page</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">When enabled, this organization's logo will be shown on the main members page</p>
                  </div>
                )}

                {/* Founding Member Checkbox */}
                <div className="mt-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.founding_member || false}
                      onChange={(e) => setFormData({ ...formData, founding_member: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Founding Member</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Mark this organization as a founding member for special ranking</p>
                </div>

                {/* Organization ID Footnote (use UUID id), created/updated info */}
                {editingOrg && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Organization UUID:</span> {editingOrg.id}
                    </p>
                    {editingOrg.created_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Created:</span> {new Date(editingOrg.created_at).toLocaleString()}
                      </p>
                    )}
                    {editingOrg.updated_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Last Updated:</span> {new Date(editingOrg.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingOrg(null);
                      setFormData({ org_id: '', name: '', bio: '', location: '', website: '', logo_display: false, founding_member: false });
                      setLogoFile(null);
                      setIsDragOver(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                  >
                    {editingOrg ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Right-hand Slider for Organization Details */}
      {showSlider && selectedOrg && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={() => setShowSlider(false)}
          ></div>
          
          {/* Slider Panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Organization Details</h3>
                <button
                  onClick={() => setShowSlider(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Organization Icon */}
                  <div className="text-center">
                    {selectedOrg.website ? (
                      <div className="mx-auto flex items-center justify-center">
                        <Favicon url={selectedOrg.website} size={48} />
                      </div>
                    ) : (
                      <div className="mx-auto h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No website</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Organization Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedOrg.name}</p>
                    </div>
                    
                    {/* Organization ID removed from top section */}
                    
                    {selectedOrg.bio && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Bio</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedOrg.bio}</p>
                      </div>
                    )}
                    
                    {selectedOrg.location && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Location</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedOrg.location}</p>
                      </div>
                    )}
                    
                    {selectedOrg.website && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Website</label>
                        <a 
                          href={selectedOrg.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-1 text-sm text-orange-600 hover:text-orange-500"
                        >
                          {selectedOrg.website}
                        </a>
                      </div>
                    )}
                    
                    {/* Created/Updated moved to footer */}
                  </div>
                  
                  {/* Organization ID Footnote (use UUID id), created/updated info with timezone */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Organization UUID:</span> {selectedOrg.id}
                    </p>
                    {selectedOrg.created_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Created:</span> {new Date(selectedOrg.created_at).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                      </p>
                    )}
                    {selectedOrg.updated_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Last Updated:</span> {new Date(selectedOrg.updated_at).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="border-t border-gray-200 p-6">
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowSlider(false);
                      handleEdit(selectedOrg);
                    }}
                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    Edit Organization
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">Delete Organization</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete <strong>"{orgToDelete?.name}"</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error and Success Messages */}
      {error && <ErrorMessage message={error} className="mt-4" onClose={() => setError('')} />}
      {success && <SuccessMessage message={success} className="mt-4" onClose={() => setSuccess('')} />}
    </div>
  );
}
