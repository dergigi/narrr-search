'use client';

import { useNostr } from '../app/contexts/NostrContext';
import { NDKEvent, NDKUser } from '@nostr-dev-kit/ndk';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { ShieldCheckIcon, ShieldExclamationIcon, UserCircleIcon } from '@heroicons/react/24/solid';

export default function SearchResults() {
  const { searchResults, isSearching, isLoggedIn, user, userFollows, getProfile, profileCache } = useNostr();
  const [displayResults, setDisplayResults] = useState<NDKEvent[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [authorProfiles, setAuthorProfiles] = useState<Map<string, NDKUser | null>>(new Map());

  // Update display results whenever searchResults changes
  useEffect(() => {
    console.log('Search results updated:', searchResults.length);
    // Limit results to 420 notes
    setDisplayResults(searchResults.slice(0, 420));
    
    if (searchResults.length > 0 && !initialized) {
      setInitialized(true);
    }
  }, [searchResults]);

  // Preload profiles for all authors in the display results
  useEffect(() => {
    if (!displayResults.length) return;

    const loadProfiles = async () => {
      // Get unique pubkeys from the current display results
      const pubkeys = new Set<string>();
      displayResults.forEach(event => {
        if (event.pubkey) {
          pubkeys.add(event.pubkey);
        }
      });

      console.log(`Preloading ${pubkeys.size} author profiles for display`);
      
      // Create a new map for this batch of authors
      const newAuthorProfiles = new Map<string, NDKUser | null>();
      
      // For each pubkey, check the cache first, then load if needed
      const profilePromises = Array.from(pubkeys).map(async (pubkey) => {
        try {
          // First check if we already have this profile in our local component state
          if (authorProfiles.has(pubkey)) {
            newAuthorProfiles.set(pubkey, authorProfiles.get(pubkey)!);
            return;
          }
          
          // Otherwise load the profile using the context's getProfile function
          const profile = await getProfile(pubkey);
          newAuthorProfiles.set(pubkey, profile);
        } catch (error) {
          console.error(`Error loading profile for ${pubkey}:`, error);
          newAuthorProfiles.set(pubkey, null);
        }
      });
      
      await Promise.all(profilePromises);
      
      // Update our local cache of author profiles
      setAuthorProfiles(prev => {
        const merged = new Map(prev);
        newAuthorProfiles.forEach((value, key) => {
          merged.set(key, value);
        });
        return merged;
      });
    };
    
    loadProfiles();
  }, [displayResults, getProfile]);

  if (!isLoggedIn) {
    return null;
  }
  
  // Only show the loader if there are no results yet and we're still searching
  if (isSearching && displayResults.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto my-8">
        <div className="flex flex-col items-center justify-center p-8 cyber-border rounded-lg">
          <div className="cyber-spinner mb-4">
            <div className="cyber-spinner-polygon"></div>
            <div className="cyber-spinner-polygon"></div>
          </div>
          <p className="text-purple-400 font-mono">SEARCHING NARRR NETWORK...</p>
        </div>
      </div>
    );
  }

  if (displayResults.length === 0 && initialized) {
    return (
      <div className="w-full max-w-2xl mx-auto my-8">
        <div className="text-center p-8 cyber-border rounded-lg">
          <p className="mb-3 text-purple-400 font-mono">SEARCH_COMPLETE: NO_RESULTS</p>
          <p className="text-sm text-gray-400">Try a different search term or check if your connected relays support NIP-50 search.</p>
        </div>
      </div>
    );
  }

  if (displayResults.length === 0) {
    return null; // Don't show anything if we haven't searched yet
  }

  const getAuthorName = (event: NDKEvent) => {
    try {
      // If this note is from the current user, use their profile info directly
      if (user && event.pubkey === user.pubkey) {
        if (user.profile?.displayName) return user.profile.displayName;
        if (user.profile?.name) return user.profile.name;
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile) {
        if (cachedProfile.profile.displayName) return cachedProfile.profile.displayName;
        if (cachedProfile.profile.name) return cachedProfile.profile.name;
      }
      
      // Otherwise use the profile from the event author
      const profile = event.author?.profile;
      if (profile) {
        if (profile.displayName) return profile.displayName;
        if (profile.name) return profile.name;
      }
      
      // Check the global profile cache as a last resort
      const globalCachedProfile = profileCache.get(event.pubkey)?.profile;
      if (globalCachedProfile) {
        if (globalCachedProfile.displayName) return globalCachedProfile.displayName;
        if (globalCachedProfile.name) return globalCachedProfile.name;
      }
      
      // Fall back to npub if no profile or name is available
      return event.author?.npub ? 
        `${event.author.npub.slice(0, 8)}...${event.author.npub.slice(-4)}` :
        event.pubkey ? 
          `${event.pubkey.slice(0, 8)}...${event.pubkey.slice(-4)}` : 
          'UNKNOWN_USER';
    } catch (error) {
      console.error('Error getting author name:', error);
      return 'UNKNOWN_USER';
    }
  };

  const getProfilePicture = (event: NDKEvent) => {
    try {
      // If this note is from the current user, use their profile picture directly
      if (user && event.pubkey === user.pubkey && user.profile?.picture) {
        return user.profile.picture;
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile?.picture) {
        return cachedProfile.profile.picture;
      }
      
      // Otherwise use the picture from the author's profile
      const profile = event.author?.profile;
      if (profile?.picture) {
        return profile.picture;
      }
      
      // Check the global profile cache as a last resort
      return profileCache.get(event.pubkey)?.profile?.picture || null;
    } catch (error) {
      console.error('Error getting profile picture:', error);
      return null;
    }
  };

  const isNip05Verified = (event: NDKEvent) => {
    try {
      // If this note is from the current user, check their profile directly
      if (user && event.pubkey === user.pubkey) {
        return !!user.profile?.nip05;
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile) {
        return !!cachedProfile.profile.nip05;
      }
      
      const profile = event.author?.profile;
      if (profile) {
        return !!profile.nip05;
      }
      
      // Check the global profile cache as a last resort
      return !!profileCache.get(event.pubkey)?.profile?.nip05;
    } catch (error) {
      console.error('Error checking NIP-05 verification:', error);
      return false;
    }
  };

  const getNip05Name = (event: NDKEvent) => {
    try {
      // If this note is from the current user, get their nip05 directly
      if (user && event.pubkey === user.pubkey) {
        return user.profile?.nip05 || null;
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile) {
        return cachedProfile.profile.nip05 || null;
      }
      
      const profile = event.author?.profile;
      if (profile) {
        return profile.nip05 || null;
      }
      
      // Check the global profile cache as a last resort
      return profileCache.get(event.pubkey)?.profile?.nip05 || null;
    } catch (error) {
      console.error('Error getting NIP-05 name:', error);
      return null;
    }
  };

  const getProfileUrl = (event: NDKEvent) => {
    try {
      // First check if user has a NIP-05 identifier
      const nip05 = getNip05Name(event);
      if (nip05 && typeof nip05 === 'string') {
        // Use the full NIP-05 identifier for nosta.me
        return `https://nosta.me/${nip05}`;
      }
      
      // Fall back to npub if available
      if (event.author?.npub) {
        return `https://nosta.me/${event.author.npub}`;
      }
      
      // Last resort: use hex pubkey
      if (event.pubkey) {
        return `https://nosta.me/${event.pubkey}`;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating profile URL:', error);
      return null;
    }
  };

  const getTimeAgo = (event: NDKEvent) => {
    try {
      if (!event.created_at) return 'TIMESTAMP_UNKNOWN';
      return formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true });
    } catch (error) {
      console.error('Error getting time ago:', error);
      return 'TIMESTAMP_ERROR';
    }
  };
  
  const getNoteUrl = (event: NDKEvent) => {
    try {
      // Ensure we have a valid ID
      if (!event.id) return null;
      // Return the njump.me URL with the note ID
      return `https://njump.me/${event.id}`;
    } catch (error) {
      console.error('Error creating note URL:', error);
      return null;
    }
  };
  
  const getResultType = (event: NDKEvent) => {
    if (user && event.pubkey === user.pubkey) {
      return 'YOUR_NOTE';
    } else if (userFollows.has(event.pubkey)) {
      return 'FOLLOWED_USER';
    }
    return 'GLOBAL_NOTE';
  };

  const renderVerificationStatus = (event: NDKEvent) => {
    // Get the verification status
    const verified = isNip05Verified(event);
    
    // Get the NIP-05 name, which might be null
    const nip05Value = getNip05Name(event);
    
    // If we have a valid NIP-05 string, show it with appropriate styling
    if (nip05Value && typeof nip05Value === 'string') {
      if (verified) {
        // Verified case - show in green
        return (
          <div className="flex items-center" title={`Verified: ${nip05Value}`}>
            <ShieldCheckIcon className="w-4 h-4 text-green-400 mr-1" />
            <span className="text-xs text-green-400 truncate max-w-[150px]">{nip05Value}</span>
          </div>
        );
      } else {
        // Unverified case - show in red
        return (
          <div className="flex items-center" title={`Unverified: ${nip05Value}`}>
            <ShieldExclamationIcon className="w-4 h-4 text-red-400 mr-1" />
            <span className="text-xs text-red-400 truncate max-w-[150px]">{nip05Value}</span>
          </div>
        );
      }
    }
    
    // No NIP-05 identifier at all
    if (verified) {
      // Should be rare, but just in case - verified but no NIP-05 value
      return (
        <div className="flex items-center" title="NIP-05 Verified">
          <ShieldCheckIcon className="w-4 h-4 text-green-400 mr-1" />
          <span className="text-xs text-green-400 truncate max-w-[150px]">Verified</span>
        </div>
      );
    }
    
    // If no NIP-05, return null (no badge)
    return null;
  };

  // Function to detect and parse media URLs from content
  const parseMediaContent = (content: string) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex) || [];
    
    const mediaItems = {
      images: [] as string[],
      videos: [] as string[],
      youtubeEmbeds: [] as string[]
    };
    
    urls.forEach(url => {
      // Clean up the URL (remove trailing punctuation that might be part of text)
      const cleanUrl = url.replace(/[.,;:!?]$/, '');
      
      // Check for image URLs
      if (/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(cleanUrl)) {
        mediaItems.images.push(cleanUrl);
      }
      // Check for video URLs
      else if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanUrl)) {
        mediaItems.videos.push(cleanUrl);
      }
      // Check for YouTube URLs
      else if (/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/.test(cleanUrl) || 
               /youtu\.be\/([a-zA-Z0-9_-]+)/.test(cleanUrl)) {
        // Extract YouTube video ID
        const match = cleanUrl.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) || 
                     cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          mediaItems.youtubeEmbeds.push(match[1]);
        }
      }
    });
    
    return mediaItems;
  };

  // Function to render media content
  const renderMedia = (event: NDKEvent) => {
    if (!event.content) return null;
    
    const media = parseMediaContent(event.content);
    
    return (
      <>
        {/* Render images */}
        {media.images.length > 0 && (
          <div className="mt-3 space-y-2">
            {media.images.map((imgUrl, idx) => (
              <div key={`img-${idx}`} className="rounded-lg overflow-hidden bg-black/30 border border-purple-500/30">
                <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={imgUrl} 
                    alt="Embedded media" 
                    className="max-h-80 max-w-full object-contain mx-auto"
                    onError={(e) => {
                      // Hide image on error
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </a>
              </div>
            ))}
          </div>
        )}
        
        {/* Render videos */}
        {media.videos.length > 0 && (
          <div className="mt-3 space-y-2">
            {media.videos.map((videoUrl, idx) => (
              <div key={`video-${idx}`} className="rounded-lg overflow-hidden bg-black/30 border border-purple-500/30">
                <video 
                  src={videoUrl} 
                  controls 
                  className="max-h-80 max-w-full mx-auto"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ))}
          </div>
        )}
        
        {/* Render YouTube embeds */}
        {media.youtubeEmbeds.length > 0 && (
          <div className="mt-3 space-y-2">
            {media.youtubeEmbeds.map((videoId, idx) => (
              <div key={`yt-${idx}`} className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden bg-black/30 border border-purple-500/30">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8 space-y-6">
      <div className="flex justify-between items-center mb-4 cyber-border py-2 px-4 rounded-md">
        <h2 className="text-lg font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">
          RESULTS<span className="ml-2">[{displayResults.length}{searchResults.length > 420 ? ` of ${searchResults.length}` : ''}]</span>
        </h2>
        {isSearching && (
          <div className="flex items-center">
            <div className="w-3 h-3 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-xs text-purple-400 font-mono">SEARCHING...</span>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {displayResults.map((event, index) => (
          <div 
            key={event.id} 
            className={`cyber-border rounded-lg p-4 transition-all duration-300 hover:shadow-lg hover:shadow-purple-900/30 ${
              user && event.pubkey === user.pubkey 
                ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-900/20 to-gray-900/70' 
                : userFollows.has(event.pubkey)
                  ? 'border-l-4 border-l-blue-400 bg-gradient-to-r from-blue-900/20 to-gray-900/70'
                  : 'bg-gray-900/70'
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                {/* Profile picture */}
                <div className="mr-3">
                  {getProfilePicture(event) ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-purple-500/50 shadow-lg shadow-purple-900/30 bg-black">
                      {(() => {
                        const profileUrl = getProfileUrl(event);
                        return profileUrl ? (
                          <a href={profileUrl} target="_blank" rel="noopener noreferrer" title="View profile on nosta.me">
                            <img 
                              src={getProfilePicture(event) || ''} 
                              alt={getAuthorName(event)} 
                              className="w-full h-full object-cover hover:opacity-80 transition-opacity duration-200"
                              onError={(e) => {
                                // If image fails to load, show fallback
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.classList.add('flex', 'items-center', 'justify-center', 'bg-purple-900/30');
                                  parent.innerHTML = `<span class="text-purple-300 text-sm font-mono">${getAuthorName(event).slice(0, 2).toUpperCase()}</span>`;
                                }
                              }}
                            />
                          </a>
                        ) : (
                          <img 
                            src={getProfilePicture(event) || ''} 
                            alt={getAuthorName(event)} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If image fails to load, show fallback
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.classList.add('flex', 'items-center', 'justify-center', 'bg-purple-900/30');
                                parent.innerHTML = `<span class="text-purple-300 text-sm font-mono">${getAuthorName(event).slice(0, 2).toUpperCase()}</span>`;
                              }
                            }}
                          />
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg border-2 border-purple-500/50 shadow-lg shadow-purple-900/30 flex items-center justify-center bg-purple-900/30">
                      {(() => {
                        const profileUrl = getProfileUrl(event);
                        return profileUrl ? (
                          <a href={profileUrl} target="_blank" rel="noopener noreferrer" title="View profile on nosta.me">
                            <UserCircleIcon className="w-6 h-6 text-purple-300 hover:text-purple-400 transition-colors duration-200" />
                          </a>
                        ) : (
                          <UserCircleIcon className="w-6 h-6 text-purple-300" />
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-medium text-purple-400 font-mono flex items-center gap-1">
                    {(() => {
                      const profileUrl = getProfileUrl(event);
                      const authorName = getAuthorName(event);
                      return profileUrl ? (
                        <a 
                          href={profileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="max-w-[200px] truncate hover:text-purple-300 transition-colors duration-200"
                          title="View profile on nosta.me"
                        >
                          {authorName}
                        </a>
                      ) : (
                        <span className="max-w-[200px] truncate">{authorName}</span>
                      );
                    })()}
                    {renderVerificationStatus(event)}
                  </div>
                  <div className="text-xs text-purple-300 font-mono flex items-center">
                    <span className="inline-block w-2 h-2 bg-purple-500 mr-2"></span>
                    {getResultType(event)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 font-mono">
                {(() => {
                  const noteUrl = getNoteUrl(event);
                  if (typeof noteUrl === 'string') {
                    return (
                      <a 
                        href={noteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-purple-400 transition-colors duration-200"
                        title="View on njump.me"
                      >
                        {getTimeAgo(event)}
                      </a>
                    );
                  } else {
                    return getTimeAgo(event);
                  }
                })()}
              </div>
            </div>
            
            {/* Warning for unverified users - don't show for YOUR_NOTE */}
            {!isNip05Verified(event) && !getNip05Name(event) && user?.pubkey !== event.pubkey && (
              <div className="mb-3 p-2 border border-red-500/30 bg-red-900/20 rounded flex items-center text-sm">
                <ShieldExclamationIcon className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
                <span className="text-red-300 font-mono text-xs">WARNING: UNVERIFIED USER - POTENTIAL SCAMMER. VERIFY IDENTITY BEFORE TRUSTING CONTENT.</span>
              </div>
            )}
            
            <div className="text-gray-300 font-light whitespace-pre-wrap break-words bg-black/20 p-3 rounded">
              {event.content}
            </div>
            
            {/* Render inline media content */}
            {renderMedia(event)}
            
            {event.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {event.tags
                  .filter((tag: string[]) => tag[0] === 't')
                  .map((tag: string[], i: number) => (
                    <span 
                      key={i} 
                      className="inline-block bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-0.5 text-xs font-mono text-purple-300"
                    >
                      #{tag[1]}
                    </span>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 