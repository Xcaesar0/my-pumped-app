import React from 'react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import ConnectedHero from './ConnectedHero';
import { User } from '../hooks/useUser';

const Hero = ({ user, loading }: { user: User | null; loading: boolean }) => {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();

  if (loading) {
    return (
      <main className="flex-grow flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </main>
    );
  }

  return (
    <main className="flex-grow">
      {!isConnected || !user ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-24">
          <div className="relative text-center">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl"></div>
            <h1
              className="text-4xl sm:text-6xl md:text-7xl font-bold text-white relative z-10 leading-tight"
              style={{
                textShadow:
                  '0 0 15px rgba(255, 255, 255, 0.3), 0 0 20px rgba(0, 192, 255, 0.4)',
              }}
            >
              Become a Bounty Hunter
            </h1>
            <p className="mt-4 text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto relative z-10">
              Join the Pumped.Fun ecosystem. Complete tasks, earn rewards, and
              climb the leaderboard.
            </p>
            <div className="mt-8 relative z-10">
              <button
                onClick={() => open()}
                className="bg-green-500 text-black font-bold py-3 px-8 rounded-lg text-lg shadow-lg hover:bg-green-600 transition-all duration-300 transform hover:scale-105"
              >
                Connect Wallet to Start
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ConnectedHero user={user} />
      )}
    </main>
  );
};

export default Hero;