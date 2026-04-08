/**
 * Generates a deterministic UUID from a string (email).
 * This ensures password-users have valid UUIDs that are consistent.
 * Based on a simple hashing of the string into a UUID format.
 */
export function getDeterministicUUID(email) {
  if (!email) return '00000000-0000-0000-0000-000000000000';
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  
  const hex = Math.abs(hash).toString(16).padEnd(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(12, 15)}-a${hex.slice(15, 18)}-${hex.slice(18, 30)}`;
}

/**
 * Normalizes user objects from different sources into a single shape.
 */
export function normalizeUser(rawUser, source = 'supabase') {
  if (!rawUser) return null;
  
  if (source === 'password') {
    return {
      id: rawUser.id && rawUser.id !== 'password_user' ? rawUser.id : getDeterministicUUID(rawUser.email),
      email: rawUser.email,
      role: rawUser.role || 'user',
      user_metadata: {
        full_name: rawUser.name || rawUser.email.split('@')[0],
      },
      auth_source: 'password'
    };
  }
  
  return {
    ...rawUser,
    role: rawUser.role || 'user',
    auth_source: 'supabase'
  };
}
