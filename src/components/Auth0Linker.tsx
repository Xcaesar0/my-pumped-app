import { useAuth0 } from '@auth0/auth0-react';
import { useUser } from '../hooks/useUser';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Auth0Linker = () => {
  const { user: auth0User, isAuthenticated, logout, isLoading } = useAuth0();
  const { user: supabaseUser, refreshSocialConnections } = useUser();

  useEffect(() => {
    const linkAccount = async () => {
      if (isLoading || !isAuthenticated || !auth0User || !supabaseUser) {
        return;
      }

      try {
        console.log("Auth0 user found, attempting to link to Supabase user:", supabaseUser.id);
        
        const platformUserId = auth0User.sub?.split('|')[1];
        const platformUsername = auth0User.nickname;

        if (!platformUserId || !platformUsername) {
            console.error("Could not extract twitter user ID or username from Auth0 profile.");
            return;
        }

        const { error: dbError } = await supabase
          .from('social_connections')
          .upsert({
            user_id: supabaseUser.id,
            platform: 'x',
            platform_user_id: platformUserId,
            platform_username: platformUsername,
            is_active: true,
            user_data: auth0User,
          }, { onConflict: 'user_id, platform' });

        if (dbError) throw dbError;

        console.log("Successfully linked X account!");
        await refreshSocialConnections();

      } catch (error) {
        console.error("Failed to link X account:", error);
      } finally {
        logout({ logoutParams: { returnTo: window.location.origin } });
      }
    };

    linkAccount();
  }, [isLoading, isAuthenticated, auth0User, supabaseUser, logout, refreshSocialConnections]);

  return null;
};

export default Auth0Linker; 