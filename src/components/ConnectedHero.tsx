import React from 'react';
import BountyHunterDashboard from './BountyHunterDashboard';
import { User } from '../hooks/useUser';

const ConnectedHero = ({ user }: { user: User }) => {
  return (
    <div className="text-center">
      <BountyHunterDashboard user={user} />
    </div>
  );
};

export default ConnectedHero;