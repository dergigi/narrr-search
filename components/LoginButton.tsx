'use client';

import { useState, useEffect } from 'react';
import { useNostr } from '../app/contexts/NostrContext';

export default function LoginButton() {
  const { isLoggedIn, login, logout, user, isLoading, ndk } = useNostr();
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  // Fetch user profile when user object changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (isLoggedIn && user && ndk) {
        try {
          // Try to get user profile data
          await user.fetchProfile();
          
          if (user.profile) {
            // Extract picture URL
            setProfilePicture(user.profile.picture || null);
            
            // Get user's name or displayName
            setUserName(user.profile.displayName || user.profile.name || null);
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
        }
      } else {
        setProfilePicture(null);
        setUserName(null);
      }
    };

    fetchUserProfile();
  }, [user, isLoggedIn, ndk]);

  if (isLoading) {
    return (
      <button
        disabled
        className="px-4 py-2 rounded-md bg-gray-300 text-gray-600 cursor-not-allowed"
      >
        Loading...
      </button>
    );
  }

  if (isLoggedIn && user) {
    return (
      <div className="flex items-center gap-3">
        {profilePicture ? (
          <div className="w-8 h-8 rounded-full overflow-hidden">
            <img 
              src={profilePicture} 
              alt="Profile" 
              className="w-full h-full object-cover"
              onError={(e) => {
                // If image fails to load, hide it
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center">
            <span className="text-purple-700 text-sm font-bold">
              {userName?.slice(0, 1) || user.npub?.slice(0, 2)}
            </span>
          </div>
        )}
        
        <span className="text-sm text-gray-700 hidden sm:inline">
          {userName || `${user.npub?.slice(0, 8)}...${user.npub?.slice(-4)}`}
        </span>
        
        <button
          onClick={logout}
          className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
    >
      Login with Extension
    </button>
  );
} 