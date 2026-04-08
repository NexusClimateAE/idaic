import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { colors } from '../config/colors';
import { ErrorMessage, SuccessMessage } from '../components/ErrorMessage';

const tabs = [
  { name: 'Personal Info', key: 'personal' },
  { name: 'Newsletters', key: 'newsletters' },
];

export default function Settings() {
  const { user } = useOutletContext();
  const [activeTab, setActiveTab] = useState('personal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Existing user fields from users table
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [region, setRegion] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Organization form fields
  const [category, setCategory] = useState('');
  const [otherCategory, setOtherCategory] = useState('');
  const [organizationDescription, setOrganizationDescription] = useState('');
  const [aiDecarbonisation, setAiDecarbonisation] = useState('');
  const [challenges, setChallenges] = useState('');
  const [contribution, setContribution] = useState('');
  const [projects, setProjects] = useState('');
  const [shareProjects, setShareProjects] = useState('');
  const [aiTools, setAiTools] = useState('');
  const [content, setContent] = useState('');
  const [dataPermission, setDataPermission] = useState('');
  
  // Newsletter subscription fields
  const [newsletterIdaicContent, setNewsletterIdaicContent] = useState(false);
  const [newsletterIdaicUk, setNewsletterIdaicUk] = useState(false);
  const [newsletterIdaicMena, setNewsletterIdaicMena] = useState(false);
  const [newsletterCsnNews, setNewsletterCsnNews] = useState(false);
  const [newsletterUaeClimate, setNewsletterUaeClimate] = useState(false);
  
  // Edit mode and success popup states
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Load user data and existing profile on component mount
  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        // Set email from authenticated user
        setEmail(user.email || '');
        
        // Try to load existing profile data
        try {
          const response = await fetch(`/.netlify/functions/userProfile?email=${encodeURIComponent(user.email)}`);
          if (response.ok) {
            const profileData = await response.json();
            if (profileData) {
              // Populate form with existing data
              setName(profileData.name || '');
              setRole(profileData.role || '');
              setCompany(profileData.company || '');
              setTitle(profileData.title || '');
              setRegion(profileData.region || '');
              setLinkedinUrl(profileData.linkedin_url || '');
              setCategory(profileData.category || '');
              setOtherCategory(profileData.otherCategory || '');
              setOrganizationDescription(profileData.organizationDescription || '');
              setAiDecarbonisation(profileData.aiDecarbonisation || '');
              setChallenges(profileData.challenges || '');
              setContribution(profileData.contribution || '');
              setProjects(profileData.projects || '');
              setShareProjects(profileData.shareProjects || '');
              setAiTools(profileData.aiTools || '');
              setContent(profileData.content || '');
              setDataPermission(profileData.data_permission === null ? '' : profileData.data_permission ? 'yes' : 'no');
              
              // Load newsletter preferences
              setNewsletterIdaicContent(profileData.newsletter_idaic_content || false);
              setNewsletterIdaicUk(profileData.newsletter_idaic_uk || false);
              setNewsletterIdaicMena(profileData.newsletter_idaic_mena || false);
              setNewsletterCsnNews(profileData.newsletter_csn_news || false);
              setNewsletterUaeClimate(profileData.newsletter_uae_climate || false);
              
              // If user has existing data, they've submitted before
              setHasSubmitted(true);
              setIsEditing(false);
            } else {
              // New user, start in editing mode
              setIsEditing(true);
            }
          }
        } catch (error) {
          console.error('Error loading profile data:', error);
          // If there's an error, assume new user and start in editing mode
          setIsEditing(true);
        }
      }
      setLoading(false);
    };

    loadUserData();
  }, [user]);

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');  // Clear any previous errors

    // Basic validation
    if (!name || !email) {
      setError('Name and email are required.');
      return;
    }

    if (dataPermission === '') {
      setError('Please select an option for data permission to continue.');
      return;
    }

    if (category === 'Other' && !otherCategory.trim()) {
      setError('Please specify your category when selecting "Other".');
      return;
    }

    const formData = {
      name,
      email,
      role,
      company,
      title,
      region,
      linkedinUrl,
      category,
      otherCategory: category === 'Other' ? otherCategory : '',
      organizationDescription,
      aiDecarbonisation,
      challenges,
      contribution,
      projects,
      shareProjects,
      aiTools,
      content,
      data_permission: dataPermission === 'yes',
      newsletter_idaic_content: newsletterIdaicContent,
      newsletter_idaic_uk: newsletterIdaicUk,
      newsletter_idaic_mena: newsletterIdaicMena,
      newsletter_csn_news: newsletterCsnNews,
      newsletter_uae_climate: newsletterUaeClimate,
      updated_by: user?.id // Track who made the update
    };

    try {
      // Submit to database - use PUT for updates, POST for new users
      const method = hasSubmitted ? 'PUT' : 'POST';
      const url = hasSubmitted 
        ? `/.netlify/functions/userProfile?id=${user?.id}`
        : '/.netlify/functions/userProfile';
      
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit profile');
      }

      const result = await response.json();

      // Show success popup and set submitted state
      setShowSuccessPopup(true);
      setHasSubmitted(true);
      setIsEditing(false);
      
      // Hide success popup after 3 seconds
      setTimeout(() => {
        setShowSuccessPopup(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting form:', error);
      setError(error.message || 'Failed to save profile. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading your profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Section Heading with Tabs (left-aligned, consistent with other pages) */}
      <div className="mb-4 border-b border-gray-200">
        <div className="sm:flex sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
          <nav className="mt-2 sm:mt-0">
            <ul className="flex space-x-4" role="tablist">
              {tabs.map(tab => (
                <li key={tab.key}>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors duration-150 focus:outline-none ${
                      activeTab === tab.key
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    style={activeTab === tab.key ? { color: colors.primary.orange, borderColor: colors.primary.orange } : {}}
                    onClick={() => setActiveTab(tab.key)}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                  >
                    {tab.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      {/* Tab Content */}
      <div className="max-w-7xl mx-auto bg-white shadow rounded-lg p-4">
        {activeTab === 'personal' && (
          <>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              {/* Personal Information */}
              <div className="border-b border-gray-200 pb-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-base font-medium text-gray-900">Personal Information</h3>
                  {hasSubmitted && !isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        setError('');
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input id="name" name="name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={!isEditing} className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`} />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                    <input 
                      id="email" 
                      name="email" 
                      type="email" 
                      autoComplete="email" 
                      value={email} 
                      readOnly
                      className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm py-1.5 px-2 text-gray-500 bg-gray-50 text-sm" 
                    />
                    <p className="mt-1 text-xs text-gray-500">Email is linked to your login account and cannot be changed here.</p>
                  </div>
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title/Position</label>
                    <input id="title" name="title" type="text" value={title} onChange={e => setTitle(e.target.value)} disabled={!isEditing} className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`} />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <input id="company" name="company" type="text" value={company} onChange={e => setCompany(e.target.value)} disabled={!isEditing} className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`} />
                  </div>
                  <div>
                    <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                    <select
                      id="region"
                      name="region"
                      value={region}
                      onChange={e => setRegion(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'} cursor-pointer`}
                    >
                      <option value="">Select Region</option>
                      <option value="UK">UK</option>
                      <option value="UAE">UAE</option>
                      <option value="EU">EU</option>
                      <option value="MENA">MENA</option>
                      <option value="Global">Global</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                    <input id="linkedinUrl" name="linkedinUrl" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} disabled={!isEditing} className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`} placeholder="https://linkedin.com/in/yourprofile" />
                  </div>
                </div>
              </div>

              {/* Organization Information - Split into two columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900 mb-2">Organization Information</h3>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">What Category fits best:</label>
                    <select
                      id="category"
                      name="category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                    >
                      <option value="">Select a category</option>
                      <option value="Represent industrial company">Represent industrial company</option>
                      <option value="Represent AI developer / provider">Represent AI developer / provider</option>
                      <option value="Represent research centre / university">Represent research centre / university</option>
                      <option value="Represent investor">Represent investor</option>
                      <option value="Other">Other: (please specify)</option>
                    </select>
                  </div>

                  {category === 'Other' && (
                    <div>
                      <label htmlFor="otherCategory" className="block text-sm font-medium text-gray-700 mb-1">Please specify:</label>
                      <input
                        id="otherCategory"
                        name="otherCategory"
                        type="text"
                        value={otherCategory}
                        onChange={e => setOtherCategory(e.target.value)}
                        disabled={!isEditing}
                        className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                        placeholder="Specify your category"
                      />
                    </div>
                  )}

                  <div>
                      <label htmlFor="organizationDescription" className="block text-sm font-medium text-gray-700 mb-1">What does the organization you represent do?</label>
                    <textarea
                      id="organizationDescription"
                      name="organizationDescription"
                      rows={2}
                      value={organizationDescription}
                      onChange={e => setOrganizationDescription(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                      placeholder="Describe your organization's activities"
                    />
                  </div>

                  <div>
                    <label htmlFor="aiDecarbonisation" className="block text-sm font-medium text-gray-700 mb-1">In what ways are you exploring or planning to use AI to accelerate decarbonisation within your organization?</label>
                    <textarea
                      id="aiDecarbonisation"
                      name="aiDecarbonisation"
                      rows={2}
                      value={aiDecarbonisation}
                      onChange={e => setAiDecarbonisation(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                      placeholder="Describe your AI decarbonisation plans"
                    />
                  </div>

                  <div>
                    <label htmlFor="challenges" className="block text-sm font-medium text-gray-700 mb-1">What industrial decarbonisation challenges would you like to address through AI?</label>
                    <textarea
                      id="challenges"
                      name="challenges"
                      rows={2}
                      value={challenges}
                      onChange={e => setChallenges(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                      placeholder="Describe the challenges you want to address"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900">&nbsp;</h3> {/* Spacer for alignment */}

                  <div>
                    <label htmlFor="contribution" className="block text-sm font-medium text-gray-700 mb-1">How might you contribute to addressing those challenges?</label>
                    <textarea
                      id="contribution"
                      name="contribution"
                      rows={2}
                      value={contribution}
                      onChange={e => setContribution(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                      placeholder="Describe how you can contribute"
                    />
                  </div>

                  <div>
                    <label htmlFor="projects" className="block text-sm font-medium text-gray-700 mb-1">Are you currently working on any projects—either in progress or recently completed—that you would like to showcase on our website?</label>
                    <textarea
                      id="projects"
                      name="projects"
                      rows={2}
                      value={projects}
                      onChange={e => setProjects(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                      placeholder="Describe your projects"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Would you be open to sharing them for visibility or potential collaboration opportunities?</label>
                    <div className="flex gap-4 mt-1">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="shareProjects"
                          value="yes"
                          checked={shareProjects === 'yes'}
                          onChange={e => setShareProjects(e.target.value)}
                          disabled={!isEditing}
                          className="text-orange-500 focus:ring-orange-500"
                        />
                        <span className="ml-2 text-sm">Yes</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="shareProjects"
                          value="no"
                          checked={shareProjects === 'no'}
                          onChange={e => setShareProjects(e.target.value)}
                          disabled={!isEditing}
                          className="text-orange-500 focus:ring-orange-500"
                        />
                        <span className="ml-2 text-sm">No</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="aiTools" className="block text-sm font-medium text-gray-700 mb-1">Are there specific AI tools or approaches you're interested in or developing?</label>
                    <textarea
                      id="aiTools"
                      name="aiTools"
                      rows={2}
                      value={aiTools}
                      onChange={e => setAiTools(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                      placeholder="Describe AI tools or approaches"
                    />
                  </div>

                  <div>
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Do you have a case study, perspective article or other content you could provide for the next meeting and/or the members portal?</label>
                    <textarea
                      id="content"
                      name="content"
                      rows={2}
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      disabled={!isEditing}
                      className={`mt-1 block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                      placeholder="Describe available content"
                    />
                  </div>
                </div>
              </div>

              {/* Divider before Data Permission */}
              <div className="border-t border-gray-200 my-6"></div>

              {/* Data Permission */}
              <div className="pb-4">
                <h3 className="text-base font-medium text-gray-900 mb-2">Data Permission</h3>
                <p className="text-sm text-gray-700 mb-4">
                  I agree that IDAIC have permission to process my data and host this information on the member section of the IDAIC website
                </p>
                <div>
                  <select
                    id="data_permission"
                    name="data_permission"
                    value={dataPermission}
                    onChange={e => setDataPermission(e.target.value)}
                    disabled={!isEditing}
                    className={`block w-full rounded-md border shadow-sm py-1.5 px-2 focus:ring-orange-500 text-sm ${isEditing ? 'border-gray-300 text-gray-900 focus:border-orange-500' : 'border-gray-200 text-gray-500 bg-gray-50'} cursor-pointer`}
                  >
                    <option value="">Select Option</option>
                    <option value="yes">Yes, I Agree</option>
                    <option value="no">No, I Decline</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1 gap-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-1.5 px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!isEditing && hasSubmitted}
                  className="inline-flex justify-center rounded-md border border-transparent bg-orange-500 py-1.5 px-3 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hasSubmitted ? 'Update Information' : 'Submit Information'}
                </button>
              </div>
            </form>
          </>
        )}
        {activeTab === 'newsletters' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-4">Newsletter Subscriptions</h3>
              <p className="text-sm text-gray-600 mb-6">Manage your newsletter subscriptions below. Select "Yes" to subscribe or "No" to unsubscribe.</p>
              
              {/* IDAIC Newsletters */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-900">IDAIC Content Updates</label>
                    <p className="text-xs text-gray-500 mt-1">Stay updated with IDAIC's latest content and announcements</p>
                  </div>
                  <select
                    value={newsletterIdaicContent ? 'yes' : 'no'}
                    onChange={(e) => setNewsletterIdaicContent(e.target.value === 'yes')}
                    className="ml-4 rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-900">IDAIC UK Chapter Updates</label>
                    <p className="text-xs text-gray-500 mt-1">Receive updates from the IDAIC UK Chapter</p>
                  </div>
                  <select
                    value={newsletterIdaicUk ? 'yes' : 'no'}
                    onChange={(e) => setNewsletterIdaicUk(e.target.value === 'yes')}
                    className="ml-4 rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-900">IDAIC MENA Chapter Updates</label>
                    <p className="text-xs text-gray-500 mt-1">Receive updates from the IDAIC MENA Chapter</p>
                  </div>
                  <select
                    value={newsletterIdaicMena ? 'yes' : 'no'}
                    onChange={(e) => setNewsletterIdaicMena(e.target.value === 'yes')}
                    className="ml-4 rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
              
              {/* Orange Divider */}
              <div className="my-6" style={{ borderTop: `2px solid ${colors.primary.orange}` }}></div>
              
              {/* Other Newsletters */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-900">CSN News Updates</label>
                    <p className="text-xs text-gray-500 mt-1">Climate Solutions News updates and articles</p>
                  </div>
                  <select
                    value={newsletterCsnNews ? 'yes' : 'no'}
                    onChange={(e) => setNewsletterCsnNews(e.target.value === 'yes')}
                    className="ml-4 rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-900">UAE Climate News</label>
                    <p className="text-xs text-gray-500 mt-1">UAE Climate Tech News and updates</p>
                  </div>
                  <select
                    value={newsletterUaeClimate ? 'yes' : 'no'}
                    onChange={(e) => setNewsletterUaeClimate(e.target.value === 'yes')}
                    className="ml-4 rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
              
              {/* Unsubscribe All Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setNewsletterIdaicContent(false);
                    setNewsletterIdaicUk(false);
                    setNewsletterIdaicMena(false);
                    setNewsletterCsnNews(false);
                    setNewsletterUaeClimate(false);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Unsubscribe All
                </button>
              </div>
              
              {/* Save Button */}
              <div className="flex justify-end pt-6">
                <button
                  type="button"
                  onClick={async () => {
                    setError('');
                    try {
                      const formData = {
                        newsletter_idaic_content: newsletterIdaicContent,
                        newsletter_idaic_uk: newsletterIdaicUk,
                        newsletter_idaic_mena: newsletterIdaicMena,
                        newsletter_csn_news: newsletterCsnNews,
                        newsletter_uae_climate: newsletterUaeClimate,
                        updated_by: user?.id
                      };
                      
                      const response = await fetch(`/.netlify/functions/userProfile?id=${user?.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData)
                      });
                      
                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to update newsletter preferences');
                      }
                      
                      setShowSuccessPopup(true);
                      setTimeout(() => setShowSuccessPopup(false), 3000);
                    } catch (error) {
                      console.error('Error updating newsletter preferences:', error);
                      setError(error.message || 'Failed to save newsletter preferences. Please try again.');
                    }
                  }}
                  className="inline-flex justify-center rounded-md border border-transparent bg-orange-500 py-1.5 px-3 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Error and Success Messages */}
      {error && <ErrorMessage message={error} className="mt-4" />}
      {showSuccessPopup && <SuccessMessage message="Profile saved successfully!" className="mt-4" />}
    </div>
  );
} 