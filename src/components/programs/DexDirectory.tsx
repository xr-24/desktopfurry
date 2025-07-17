import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import {
  loadProfileStart,
  loadProfileSuccess,
  loadProfileFailure,
  startEditing,
  cancelEditing,
  updateEditingProfile,
  saveProfileStart,
  saveProfileSuccess,
  saveProfileFailure,
  searchProfilesStart,
  searchProfilesSuccess,
  searchProfilesFailure,
  clearSearchResults,
  setAvailableBackgrounds,
  clearErrors,
  UserProfile,
} from '../../store/profileSlice';
import { authService } from '../../services/authService';
import AvatarCrop from '../AvatarCrop';
import ProfileCard from '../ProfileCard';
import '../../styles/dexdirectory.css';

interface DexDirectoryProps {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  isMaximized: boolean;
}

const DexDirectory: React.FC<DexDirectoryProps> = ({
  onClose,
  onMinimize,
  onMaximize,
  isMaximized,
}) => {
  const dispatch = useDispatch();
  const {
    currentProfile,
    isLoadingProfile,
    profileError,
    isEditing,
    editingProfile,
    isSaving,
    saveError,
    searchResults,
    searchQuery,
    isSearching,
    searchError,
    pagination,
    availableBackgrounds,
  } = useSelector((state: RootState) => state.profile);

  const [activeTab, setActiveTab] = useState<'profile' | 'browse'>('profile');
  const [searchInput, setSearchInput] = useState('');

  // Load user's profile and available backgrounds on mount
  useEffect(() => {
    loadUserProfile();
    loadAvailableBackgrounds();
  }, []);

  const loadUserProfile = async () => {
    dispatch(loadProfileStart());
    try {
      const response = await authService.apiCall('/api/profiles/me', 'GET');
      if (response.success) {
        dispatch(loadProfileSuccess(response.profile));
      } else {
        dispatch(loadProfileFailure(response.error || 'Failed to load profile'));
      }
    } catch (error) {
      dispatch(loadProfileFailure('Failed to load profile'));
    }
  };

  const loadAvailableBackgrounds = () => {
    // Get available background patterns from assets
    const backgrounds = [
      { id: 'sandstone', name: 'Sandstone', pattern: '/assets/patterns/Sandstone.png' },
      { id: 'waves', name: 'Waves', pattern: '/assets/patterns/Waves.png' },
      { id: 'circles', name: 'Circles', pattern: '/assets/patterns/Circles.png' },
      { id: 'bees', name: 'Bees', pattern: '/assets/patterns/Bees.png' },
      { id: 'blocks', name: 'Blocks', pattern: '/assets/patterns/Blocks.png' },
      { id: 'blue-geo', name: 'Blue Geo', pattern: '/assets/patterns/Blue Geo.png' },
      { id: 'bubbles', name: 'Bubbles', pattern: '/assets/patterns/Bubbles.png' },
      { id: 'bubbles-2', name: 'Bubbles 2', pattern: '/assets/patterns/Bubbles 2.png' },
      { id: 'city', name: 'City', pattern: '/assets/patterns/City.png' },
      { id: 'clouds', name: 'Clouds', pattern: '/assets/patterns/Clouds.png' },
      { id: 'dark-sky', name: 'Dark Sky', pattern: '/assets/patterns/Dark Sky.png' },
      { id: 'duck', name: 'Duck', pattern: '/assets/patterns/Duck.png' },
      { id: 'forest', name: 'Forest', pattern: '/assets/patterns/Forest.png' },
      { id: 'glitch', name: 'Glitch', pattern: '/assets/patterns/Glitch.png' },
      { id: 'grid', name: 'Grid', pattern: '/assets/patterns/Grid.png' },
      { id: 'ice-cream', name: 'Ice Cream', pattern: '/assets/patterns/Ice Cream.png' },
      { id: 'mariposa', name: 'Mariposa', pattern: '/assets/patterns/Mariposa.png' },
      { id: 'metal-links', name: 'Metal Links', pattern: '/assets/patterns/Metal Links.png' },
      { id: 'palm-tree', name: 'Palm Tree', pattern: '/assets/patterns/Palm Tree.png' },
      { id: 'paradise', name: 'Paradise', pattern: '/assets/patterns/Paradise.jpg' },
      { id: 'pink-flower', name: 'Pink Flower', pattern: '/assets/patterns/Pink Flower.png' },
      { id: 'pink-sky', name: 'Pink Sky', pattern: '/assets/patterns/Pink Sky.png' },
      { id: 'planets', name: 'Planets', pattern: '/assets/patterns/Planets.png' },
      { id: 'purple-geo', name: 'Purple Geo', pattern: '/assets/patterns/Purple Geo.png' },
      { id: 'purple-sponge', name: 'Purple Sponge', pattern: '/assets/patterns/Purple Sponge.jpg' },
      { id: 'red-tile', name: 'Red Tile', pattern: '/assets/patterns/Red Tile.png' },
      { id: 'strawberries', name: 'Strawberries', pattern: '/assets/patterns/Strawberries.png' },
      { id: 'summer', name: 'Summer', pattern: '/assets/patterns/Summer.png' },
      { id: 'sunset', name: 'Sunset', pattern: '/assets/patterns/Sunset.png' },
      { id: 'veggies', name: 'Veggies', pattern: '/assets/patterns/Veggies.png' },
    ];
    dispatch(setAvailableBackgrounds(backgrounds));
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;

    dispatch(saveProfileStart());
    try {
      const response = await authService.apiCall('/api/profiles/me', 'PUT', editingProfile);
      if (response.success) {
        dispatch(saveProfileSuccess(response.profile));
      } else {
        dispatch(saveProfileFailure(response.error || 'Failed to save profile'));
      }
    } catch (error) {
      dispatch(saveProfileFailure('Failed to save profile'));
    }
  };

  const handleSearch = async (query: string, page: number = 1) => {
    dispatch(searchProfilesStart({ query, page }));
    try {
      const response = await authService.apiCall(
        `/api/profiles/search?q=${encodeURIComponent(query)}&page=${page}`,
        'GET'
      );
      if (response.success) {
        dispatch(searchProfilesSuccess({
          profiles: response.profiles,
          pagination: response.pagination,
          append: page > 1,
        }));
      } else {
        dispatch(searchProfilesFailure(response.error || 'Search failed'));
      }
    } catch (error) {
      dispatch(searchProfilesFailure('Search failed'));
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      handleSearch(searchInput.trim());
    } else {
      dispatch(clearSearchResults());
    }
  };

  const handleLoadMore = () => {
    if (pagination?.hasNextPage) {
      handleSearch(searchQuery, pagination.currentPage + 1);
    }
  };

  const renderProfileTab = () => {
    if (isLoadingProfile) {
      return <div className="loading">Loading profile...</div>;
    }

    if (profileError) {
      return <div className="error">Error: {profileError}</div>;
    }

    if (!currentProfile) {
      return <div className="error">Profile not found</div>;
    }

    return (
      <div className="profile-tab">
        <div className="profile-header">
            <div className="profile-avatar">
              <AvatarCrop
                appearance={{
                  hue: currentProfile.hue || 0,
                  eyes: currentProfile.eyes || 'none',
                  ears: currentProfile.ears || 'none',
                  fluff: currentProfile.fluff || 'none',
                  tail: currentProfile.tail || 'none',
                  body: currentProfile.body || 'CustomBase',
                }}
                size={120}
                cropConfig={{
                  scale: currentProfile.avatar_crop_scale || 2.2,
                  offsetX: currentProfile.avatar_crop_offset_x || -0.5,
                  offsetY: currentProfile.avatar_crop_offset_y || -0.3,
                }}
              />
            </div>
          <div className="profile-info">
            <h2 className="username">{currentProfile.username}</h2>
            {!isEditing && (
              <button
                className="win98-button"
                onClick={() => dispatch(startEditing())}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="profile-edit">
            <div className="form-group">
              <label>Biography (max 500 characters):</label>
              <textarea
                value={editingProfile?.biography || ''}
                onChange={(e) =>
                  dispatch(updateEditingProfile({ biography: e.target.value }))
                }
                maxLength={500}
                rows={4}
                className="win98-textbox"
              />
              <div className="char-count">
                {(editingProfile?.biography || '').length}/500
              </div>
            </div>

            <div className="form-group">
              <label>Interest Tags (max 200 characters, comma-separated):</label>
              <input
                type="text"
                value={editingProfile?.interest_tags || ''}
                onChange={(e) =>
                  dispatch(updateEditingProfile({ interest_tags: e.target.value }))
                }
                maxLength={200}
                className="win98-textbox"
                placeholder="gaming, art, music, coding"
              />
              <div className="char-count">
                {(editingProfile?.interest_tags || '').length}/200
              </div>
            </div>

            <div className="form-group">
              <label>Privacy Setting:</label>
              <select
                value={editingProfile?.privacy_setting || 'public'}
                onChange={(e) =>
                  dispatch(updateEditingProfile({
                    privacy_setting: e.target.value as 'public' | 'friends' | 'private'
                  }))
                }
                className="win98-dropdown"
              >
                <option value="public">Public</option>
                <option value="friends">Friends Only</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div className="form-group">
              <label>Background:</label>
              <div className="background-selector">
                {availableBackgrounds.map((bg) => (
                  <div
                    key={bg.id}
                    className={`background-option ${
                      editingProfile?.profile_background_id === bg.id ? 'selected' : ''
                    }`}
                    onClick={() =>
                      dispatch(updateEditingProfile({ profile_background_id: bg.id }))
                    }
                    style={{
                      backgroundImage: `url(${bg.pattern})`,
                    }}
                    title={bg.name}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Avatar Picture Crop:</label>
              <div className="avatar-crop-controls">
                <div className="crop-preview">
                  <AvatarCrop
                    appearance={{
                      hue: editingProfile?.hue || 0,
                      eyes: editingProfile?.eyes || 'none',
                      ears: editingProfile?.ears || 'none',
                      fluff: editingProfile?.fluff || 'none',
                      tail: editingProfile?.tail || 'none',
                      body: editingProfile?.body || 'CustomBase',
                    }}
                    size={80}
                    cropConfig={{
                      scale: editingProfile?.avatar_crop_scale || 2.2,
                      offsetX: editingProfile?.avatar_crop_offset_x || -0.5,
                      offsetY: editingProfile?.avatar_crop_offset_y || -0.3,
                    }}
                  />
                </div>
                <div className="crop-sliders">
                  <div className="slider-group">
                    <label>Zoom: {((editingProfile?.avatar_crop_scale || 2.2) * 100 / 2.2).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="1.5"
                      max="3.5"
                      step="0.1"
                      value={editingProfile?.avatar_crop_scale || 2.2}
                      onChange={(e) =>
                        dispatch(updateEditingProfile({ avatar_crop_scale: parseFloat(e.target.value) }))
                      }
                      className="win98-slider"
                    />
                  </div>
                  <div className="slider-group">
                    <label>Horizontal Position</label>
                    <input
                      type="range"
                      min="-1"
                      max="0"
                      step="0.05"
                      value={editingProfile?.avatar_crop_offset_x || -0.5}
                      onChange={(e) =>
                        dispatch(updateEditingProfile({ avatar_crop_offset_x: parseFloat(e.target.value) }))
                      }
                      className="win98-slider"
                    />
                  </div>
                  <div className="slider-group">
                    <label>Vertical Position</label>
                    <input
                      type="range"
                      min="-0.8"
                      max="0.2"
                      step="0.05"
                      value={editingProfile?.avatar_crop_offset_y || -0.3}
                      onChange={(e) =>
                        dispatch(updateEditingProfile({ avatar_crop_offset_y: parseFloat(e.target.value) }))
                      }
                      className="win98-slider"
                    />
                  </div>
                  <button
                    type="button"
                    className="win98-button"
                    onClick={() =>
                      dispatch(updateEditingProfile({
                        avatar_crop_scale: 2.2,
                        avatar_crop_offset_x: -0.5,
                        avatar_crop_offset_y: -0.3,
                      }))
                    }
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                className="win98-button"
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                className="win98-button"
                onClick={() => dispatch(cancelEditing())}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>

            {saveError && <div className="error">{saveError}</div>}
          </div>
        ) : (
          <div 
            className="profile-view"
            style={{
              backgroundImage: currentProfile.profile_background_id ? 
                `linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.8)), url(/assets/patterns/${
                  availableBackgrounds.find(bg => bg.id === currentProfile.profile_background_id)?.pattern.split('/').pop() || 'Sandstone.png'
                })` : 
                undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <div className="profile-section">
              <h3>Biography</h3>
              <div className="biography">
                {currentProfile.biography || 'No biography set.'}
              </div>
            </div>

            <div className="profile-section">
              <h3>Interests</h3>
              <div className="interest-tags">
                {currentProfile.interest_tags ? (
                  currentProfile.interest_tags.split(',').map((tag, index) => (
                    <span key={index} className="interest-tag">
                      {tag.trim()}
                    </span>
                  ))
                ) : (
                  'No interests set.'
                )}
              </div>
            </div>

            <div className="profile-section">
              <h3>Privacy</h3>
              <div className="privacy-setting">
                {currentProfile.privacy_setting === 'public' && 'Public Profile'}
                {currentProfile.privacy_setting === 'friends' && 'Friends Only'}
                {currentProfile.privacy_setting === 'private' && 'Private Profile'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBrowseTab = () => {
    return (
      <div className="browse-tab">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search names, interests..."
            className="win98-textbox search-input"
          />
          <button type="submit" className="win98-button" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchError && <div className="error">{searchError}</div>}

        <div className="search-results">
          {searchResults.length > 0 ? (
            <>
              <div className="results-grid">
                {searchResults.map((profile) => (
                  <ProfileCard key={profile.user_id} profile={profile} />
                ))}
              </div>

              {pagination && pagination.hasNextPage && (
                <div className="pagination">
                  <button
                    className="win98-button"
                    onClick={handleLoadMore}
                    disabled={isSearching}
                  >
                    Load More ({pagination.currentPage}/{pagination.totalPages})
                  </button>
                </div>
              )}
            </>
          ) : searchQuery && !isSearching ? (
            <div className="no-results">No profiles found for "{searchQuery}"</div>
          ) : !searchQuery ? (
            <div className="search-prompt">
              Enter a search term to find other users by name or interests.
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="dexdirectory-content">
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          My Profile
        </button>
        <button
          className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'profile' ? renderProfileTab() : renderBrowseTab()}
      </div>
    </div>
  );
};

export default DexDirectory;
