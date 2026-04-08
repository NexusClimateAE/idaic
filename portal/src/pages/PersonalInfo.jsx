import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ErrorMessage, SuccessMessage } from '../components/ErrorMessage';

export default function PersonalInfo() {
  const { user, getAuthToken } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    region: '',
    data_permission: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const REGIONS = ['UK', 'UAE', 'EU', 'MENA', 'Global'];

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          throw new Error('No active session found. Please log in.');
        }

        const response = await fetch(`/.netlify/functions/userProfile?id=${user?.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch profile');
        const data = await response.json();
        
        setFormData({
          name: data.name || '',
          email: data.email || '',
          company: data.company || '',
          region: data.region || '',
          data_permission: data.data_permission ? 'yes' : 'no'
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchUserProfile();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No active session found. Please log in.');
      }

      const response = await fetch(`/.netlify/functions/userProfile?id=${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          data_permission: formData.data_permission === 'yes',
          updated_at: new Date().toISOString().replace('Z', '+00:00')
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Personal Information</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-900">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-900">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-900">
            Company
          </label>
          <input
            type="text"
            id="company"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-900">
            Region
          </label>
          <select
            id="region"
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          >
            <option value="">Select Region</option>
            {REGIONS.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="data_permission" className="block text-sm font-medium text-gray-900">
            Data Permission
          </label>
          <select
            id="data_permission"
            value={formData.data_permission}
            onChange={(e) => setFormData({ ...formData, data_permission: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          >
            <option value="">Select Option</option>
            <option value="yes">Yes, I Agree</option>
            <option value="no">No, I Decline</option>
          </select>
          <p className="mt-2 text-sm text-gray-500">
            I agree that IDAIC have permission to process my data and host this information on the member section of the IDAIC website
          </p>
        </div>

        {error && <ErrorMessage message={error} />}
        {success && <SuccessMessage message={success} />}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-orange-500 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
