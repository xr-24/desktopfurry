import React from 'react';
import { UserProfile } from '../store/profileSlice';
import AvatarCrop from './AvatarCrop';
import { useDispatch } from 'react-redux';
import { openProgram } from '../store/programSlice';

interface ProfileCardProps {
  profile: UserProfile;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile }) => {
  const dispatch = useDispatch();

  const handleVisitDextop = () => {
    // Open Browser98 and then update its state to navigate to the user's dextop
    const windowId = `browser98-${Date.now()}`;
    dispatch(openProgram({
      type: 'browser98',
      controllerId: 'system'
    }));
    
    // Note: In a real implementation, we would need to update the browser state
    // after the program opens to navigate to the dextop URL
    // This would require additional logic in the Browser98 component
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
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${backgroundPath})`,
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

        <div className="profile-card-actions">
          <button
            className="win98-button profile-card-visit-btn"
            onClick={handleVisitDextop}
            title="Visit their Dextop"
          >
            Visit Dextop
          </button>
        </div>

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
