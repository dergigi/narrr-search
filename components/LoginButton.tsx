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
        className="px-4 py-2 rounded-md bg-gray-800 text-gray-400 cursor-not-allowed font-mono border border-purple-500/30"
      >
        CONNECTING...
      </button>
    );
  }

  if (isLoggedIn && user) {
    return (
      <div className="flex items-center gap-3">
        {profilePicture ? (
          <div className="w-9 h-9 rounded-md overflow-hidden border-2 border-purple-500 shadow-lg shadow-purple-900/40">
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
          <div className="w-9 h-9 rounded-md bg-purple-900/50 border-2 border-purple-500 flex items-center justify-center shadow-lg shadow-purple-900/40">
            <span className="text-purple-300 text-sm font-mono">
              {userName?.slice(0, 1) || user.npub?.slice(0, 2)}
            </span>
          </div>
        )}
        
        <span className="text-sm text-purple-300 hidden sm:inline font-mono">
          {userName || `${user.npub?.slice(0, 8)}...${user.npub?.slice(-4)}`}
        </span>
        
        <button
          onClick={logout}
          className="px-4 py-2 rounded-md bg-gradient-to-r from-red-900 to-red-700 text-white hover:shadow-lg hover:shadow-red-900/50 transition-all duration-300 cyber-glow font-mono text-sm border border-red-500/50"
        >
          DISCONNECT
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-5 py-2 rounded-md bg-gradient-to-r from-purple-800 to-purple-600 text-white border border-purple-500/50 hover:shadow-lg hover:shadow-purple-900/50 transition-all duration-300 cyber-glow font-mono"
    >
      <span className="font-mono text-sm">AUTHENTICATE</span>
    </button>
  );
} 