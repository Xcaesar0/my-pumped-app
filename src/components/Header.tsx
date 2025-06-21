import React, { useState } from 'react';
import { Wallet, User as UserIcon, Gift, Award } from 'lucide-react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount } from 'wagmi';
import { useUser } from '../hooks/useUser';
import Logo from './Logo';
import ProfileSettingsModal from './ProfileSettingsModal';
import RewardsModal from './RewardsModal';

const Header = () => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const { user, loading } = useUser();

  const handleWalletClick = () => {
    if (!isConnected) {
      open();
    }
  };

  const handleLogoClick = () => {
    window.location.href = '/';
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleUserProfileClick = () => {
    if (isConnected && user) {
      setShowProfileModal(true);
    }
  };

  const handleRewardsClick = () => {
    if (isConnected && user) {
      setShowRewardsModal(true);
    }
  };

  return (
    <>
      <header className="relative z-50 w-full border-b border-gray-800/50" style={{ backgroundColor: '#0C0C0C' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Logo onClick={handleLogoClick} />

            {/* Desktop: Full buttons with text */}
            <div className="hidden sm:flex items-center space-x-3">
              {/* Rewards Button (when connected) */}
              {isConnected && user && !loading && (
                <button
                  onClick={handleRewardsClick}
                  className="rewards-glow-button flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-300 border border-gray-700/50 hover:border-green-500/50 relative overflow-hidden"
                  style={{ backgroundColor: '#262626' }}
                >
                  {/* Animated background glow - fixed z-index */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-green-400/20 to-green-500/10 animate-pulse-glow -z-10"></div>
                  
                  {/* Rotating border glow - fixed z-index */}
                  <div className="absolute inset-0 rounded-lg animate-border-glow -z-10">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/50 via-green-400/70 to-green-500/50 opacity-0 animate-border-rotate"></div>
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10 flex items-center space-x-2">
                    <Gift className="w-4 h-4 text-green-400 animate-bounce-subtle" />
                    <span className="text-sm font-medium text-green-400">Rewards</span>
                  </div>
                  
                  {/* Sparkle effects - fixed positioning */}
                  <div className="absolute top-1 right-1 w-1 h-1 bg-green-400 rounded-full animate-sparkle-1 z-20"></div>
                  <div className="absolute bottom-1 left-1 w-1 h-1 bg-green-400 rounded-full animate-sparkle-2 z-20"></div>
                  <div className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-green-300 rounded-full animate-sparkle-3 z-20"></div>
                </button>
              )}

              {/* Username Display (when connected) */}
              {isConnected && user && !loading && (
                <button
                  onClick={handleUserProfileClick}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-300 border border-gray-700/50 hover:border-gray-600/50"
                  style={{ backgroundColor: '#262626' }}
                >
                  <UserIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">{user.username}</span>
                </button>
              )}

              {/* Loading indicator when user is being loaded */}
              {isConnected && loading && (
                <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                  <span className="text-sm text-gray-400">Loading...</span>
                </div>
              )}

              {/* Connect Wallet Button - Only show when not connected */}
              {!isConnected && (
                <button 
                  onClick={handleWalletClick}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 shadow-lg transform hover:scale-[1.02] active:scale-[0.98] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#52D593' }}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                      <span className="text-sm font-semibold text-black">Loading...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 text-black" />
                      <span className="text-sm font-semibold text-black">Connect Wallet</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Mobile: Icon-only buttons */}
            <div className="flex sm:hidden items-center space-x-2">
              {/* Rewards Button (when connected) - Mobile */}
              {isConnected && user && !loading && (
                <button
                  onClick={handleRewardsClick}
                  className="rewards-glow-button p-2 rounded-lg transition-all duration-300 border border-gray-700/50 hover:border-green-500/50 relative overflow-hidden"
                  style={{ backgroundColor: '#262626' }}
                >
                  {/* Animated background glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-green-400/20 to-green-500/10 animate-pulse-glow -z-10"></div>
                  
                  {/* Rotating border glow */}
                  <div className="absolute inset-0 rounded-lg animate-border-glow -z-10">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/50 via-green-400/70 to-green-500/50 opacity-0 animate-border-rotate"></div>
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <Gift className="w-4 h-4 text-green-400 animate-bounce-subtle" />
                  </div>
                  
                  {/* Sparkle effects */}
                  <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-green-400 rounded-full animate-sparkle-1 z-20"></div>
                  <div className="absolute bottom-0.5 left-0.5 w-0.5 h-0.5 bg-green-400 rounded-full animate-sparkle-2 z-20"></div>
                </button>
              )}

              {/* Username Display (when connected) - Mobile */}
              {isConnected && user && !loading && (
                <button
                  onClick={handleUserProfileClick}
                  className="p-2 rounded-lg transition-all duration-300 border border-gray-700/50 hover:border-gray-600/50"
                  style={{ backgroundColor: '#262626' }}
                >
                  <UserIcon className="w-4 h-4 text-blue-400" />
                </button>
              )}

              {/* Loading indicator when user is being loaded - Mobile */}
              {isConnected && loading && (
                <div className="p-2 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                </div>
              )}

              {/* Connect Wallet Button - Mobile - Only show when not connected */}
              {!isConnected && (
                <button 
                  onClick={handleWalletClick}
                  disabled={loading}
                  className="p-2 rounded-lg transition-all duration-300 shadow-lg transform hover:scale-[1.02] active:scale-[0.98] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#52D593' }}
                >
                  {loading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                  ) : (
                    <Wallet className="w-4 h-4 text-black" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Connection Status (Mobile) */}
          {isConnected && address && (
            <div className="mt-3 sm:hidden p-2 rounded-lg border border-green-500/30" style={{ backgroundColor: '#262626' }}>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs text-gray-300">Connected:</span>
                <span className="text-xs font-mono text-green-400">{formatAddress(address)}</span>
              </div>
              {user && (
                <p className="text-xs text-blue-400 mt-1">@{user.username}</p>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Profile Settings Modal */}
      {showProfileModal && user && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Rewards Modal */}
      {showRewardsModal && user && (
        <RewardsModal
          onClose={() => setShowRewardsModal(false)}
        />
      )}

      {/* Custom CSS for glowing animations */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes border-rotate {
          0% {
            opacity: 0;
            transform: rotate(0deg);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: rotate(360deg);
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        @keyframes sparkle-1 {
          0%, 100% {
            opacity: 0;
            transform: scale(0);
          }
          25% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0;
            transform: scale(0);
          }
        }

        @keyframes sparkle-2 {
          0%, 100% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
          75% {
            opacity: 0;
            transform: scale(0);
          }
        }

        @keyframes sparkle-3 {
          0%, 100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          33% {
            opacity: 1;
            transform: scale(1) rotate(120deg);
          }
          66% {
            opacity: 0;
            transform: scale(0) rotate(240deg);
          }
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-border-glow {
          animation: border-rotate 3s linear infinite;
        }

        .animate-border-rotate {
          animation: border-rotate 3s linear infinite;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }

        .animate-sparkle-1 {
          animation: sparkle-1 3s ease-in-out infinite;
        }

        .animate-sparkle-2 {
          animation: sparkle-2 3s ease-in-out infinite 1s;
        }

        .animate-sparkle-3 {
          animation: sparkle-3 3s ease-in-out infinite 2s;
        }

        .rewards-glow-button:hover .animate-pulse-glow {
          animation-duration: 1s;
        }

        .rewards-glow-button:hover .animate-border-glow {
          animation-duration: 1.5s;
        }

        .rewards-glow-button:hover {
          box-shadow: 
            0 0 20px rgba(34, 197, 94, 0.4),
            0 0 40px rgba(34, 197, 94, 0.2),
            0 0 60px rgba(34, 197, 94, 0.1);
        }

        /* Ensure proper z-index layering */
        .rewards-glow-button {
          position: relative;
          isolation: isolate;
        }
      `}</style>
    </>
  );
};

export default Header;