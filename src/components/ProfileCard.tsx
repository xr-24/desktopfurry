import React, { useMemo } from 'react';
import { UserProfile } from '../store/profileSlice';
import AvatarCrop from './AvatarCrop';
import { socketService } from '../services/socketService';
import { useAppSelector } from '../store/hooks';

interface ProfileCardProps {
  profile: UserProfile;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const { items } = useAppSelector((state) => state.inventory);

  const handleSendFriendRequest = () => {
    socketService.sendFriendRequest(profile.username);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderInterestTags = () => {
    if (!profile.interest_tags) return null;
    
    const tags = profile.interest_tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (tags.length === 0) return null;

    return (
      <div className="profile-card-tags">
        {tags.slice(0, 3).map((tag, index) => (
          <span key={index} className="profile-card-tag">
            {tag}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="profile-card-tag-more">+{tags.length - 3}</span>
        )}
      </div>
    );
  };

  // Use equipped items from profile data (provided by backend)
  const equippedItems = useMemo(() => {
    if (profile.equippedItems && Array.isArray(profile.equippedItems)) {
      return profile.equippedItems;
    }
    
    // Fallback to inventory lookup if equippedItems not provided
    if (!profile.current_item_ids || !Array.isArray(profile.current_item_ids)) {
      return [];
    }
    
    return profile.current_item_ids
      .map(itemId => items.find((item: any) => item.id === itemId))
      .filter(Boolean)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        asset_path: item.asset_path
      }));
  }, [profile.equippedItems, profile.current_item_ids, items]);

  const getBackgroundStyle = () => {
    if (!profile.profile_background_id) return {};
    
    const backgroundPath = `/assets/patterns/${profile.profile_background_id === 'sandstone' ? 'Sandstone' : 
      profile.profile_background_id === 'waves' ? 'Waves' :
      profile.profile_background_id === 'circles' ? 'Circles' :
      profile.profile_background_id === 'bees' ? 'Bees' :
      profile.profile_background_id === 'blocks' ? 'Blocks' :
      profile.profile_background_id === 'blue-geo' ? 'Blue Geo' :
      profile.profile_background_id === 'bubbles' ? 'Bubbles' :
      profile.profile_background_id === 'bubbles-2' ? 'Bubbles 2' :
      profile.profile_background_id === 'city' ? 'City' :
      profile.profile_background_id === 'clouds' ? 'Clouds' :
      profile.profile_background_id === 'dark-sky' ? 'Dark Sky' :
      profile.profile_background_id === 'duck' ? 'Duck' :
      profile.profile_background_id === 'forest' ? 'Forest' :
      profile.profile_background_id === 'glitch' ? 'Glitch' :
      profile.profile_background_id === 'grid' ? 'Grid' :
      profile.profile_background_id === 'ice-cream' ? 'Ice Cream' :
      profile.profile_background_id === 'mariposa' ? 'Mariposa' :
      profile.profile_background_id === 'metal-links' ? 'Metal Links' :
      profile.profile_background_id === 'palm-tree' ? 'Palm Tree' :
      profile.profile_background_id === 'paradise' ? 'Paradise.jpg' :
      profile.profile_background_id === 'pink-flower' ? 'Pink Flower' :
      profile.profile_background_id === 'pink-sky' ? 'Pink Sky' :
      profile.profile_background_id === 'planets' ? 'Planets' :
      profile.profile_background_id === 'purple-geo' ? 'Purple Geo' :
      profile.profile_background_id === 'purple-sponge' ? 'Purple Sponge.jpg' :
      profile.profile_background_id === 'red-tile' ? 'Red Tile' :
      profile.profile_background_id === 'strawberries' ? 'Strawberries' :
      profile.profile_background_id === 'summer' ? 'Summer' :
      profile.profile_background_id === 'sunset' ? 'Sunset' :
      profile.profile_background_id === 'veggies' ? 'Veggies' :
      'Sandstone'}.png`;

    return {
      backgroundImage: `url(${backgroundPath})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  };

  return (
    <div className="profile-card" style={getBackgroundStyle()}>
      <div className="profile-card-content">
        <div className="profile-card-header">
          <div className="profile-card-avatar">
            <AvatarCrop
              appearance={{
                hue: profile.hue || 0,
                eyes: profile.eyes || 'none',
                ears: profile.ears || 'none',
                fluff: profile.fluff || 'none',
                tail: profile.tail || 'none',
                body: profile.body || 'CustomBase',
              }}
              size={60}
              cropConfig={{
                scale: profile.avatar_crop_scale || 2.2,
                offsetX: profile.avatar_crop_offset_x || -0.5,
                offsetY: profile.avatar_crop_offset_y || -0.3,
              }}
              equippedItems={equippedItems}
            />
          </div>
          <div className="profile-card-info">
            <h3 className="profile-card-username">{profile.username}</h3>
            {profile.is_friend && (
              <span className="profile-card-friend-badge">Friend</span>
            )}
          </div>
        </div>

        {profile.biography && (
          <div className="profile-card-bio">
            {truncateText(profile.biography, 100)}
          </div>
        )}

        {renderInterestTags()}

        {/* Add Friend button - only show if not already a friend and not the current user */}
        {!profile.is_friend && currentUser && profile.user_id !== currentUser.id && (
          <div className="profile-card-actions">
            <button
              className="win98-button profile-card-add-friend-btn"
              onClick={handleSendFriendRequest}
              title="Send friend request"
            >
              Add Friend
            </button>
          </div>
        )}

        <div className="profile-card-privacy">
          {profile.privacy_setting === 'public' && '🌐 Public'}
          {profile.privacy_setting === 'friends' && '👥 Friends Only'}
          {profile.privacy_setting === 'private' && '🔒 Private'}
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
