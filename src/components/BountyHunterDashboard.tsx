import React, { useState } from 'react';
import { User } from '../hooks/useUser';
import LeaderboardMenu from './LeaderboardMenu';
import TasksMenu from './TasksMenu';
import { useUser } from '../hooks/useUser';
import ReferralCodeModal from './ReferralCodeModal';
import { Gift, Copy, Trophy } from 'lucide-react';
import ReferralCodeInput from './ReferralCodeInput';

interface BountyHunterDashboardProps {
  user: User;
}

const BountyHunterDashboard: React.FC<BountyHunterDashboardProps> = ({ user }) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const { 
    showReferralModal, 
    handleReferralModalClose, 
    handleReferralSuccess, 
    isNewUser 
  } = useUser();

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative text-center mb-8">
          <h1 className="text-4xl font-bold">Bounty Hunter</h1>
          <p className="text-lg text-gray-400">
            Complete social media tasks, invite friends, and climb the leaderboard to earn exclusive rewards
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
             <div className="bg-gray-800/50 p-6 rounded-lg h-full flex flex-col">
                <div className="flex items-center space-x-3 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-bold">Global Leaderboard</h2>
                </div>
                <p className="text-gray-400 mb-4 flex-grow">See where you stand against other bounty hunters.</p>
                <button 
                    onClick={() => setShowLeaderboard(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full"
                >
                    View Leaderboard
                </button>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-8">
            <div className="bg-gray-800/50 p-6 rounded-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Gift className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-bold">Refer and Earn</h2>
              </div>
              <p className="text-gray-400 mb-4">
                Share your referral code to earn points!
              </p>
              <div>
                <p className="text-sm text-gray-400">Your Referral Code</p>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={user.referral_code}
                    className="w-full bg-gray-900/50 p-2 rounded-lg border border-gray-700 font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(user.referral_code)}
                    className="bg-green-500 px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
              <div className="mt-4">
                 <ReferralCodeInput userId={user.id} onSuccess={handleReferralSuccess} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <TasksMenu />
          </div>
        </div>
      </div>
      
      {showLeaderboard && <LeaderboardMenu user={user} onClose={() => setShowLeaderboard(false)} />}
      
      {showReferralModal && isNewUser && (
        <ReferralCodeModal
          onClose={handleReferralModalClose}
          onSuccess={handleReferralSuccess}
        />
      )}
    </>
  );
};

export default BountyHunterDashboard;