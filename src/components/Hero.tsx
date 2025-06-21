import React, { useState } from 'react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { useUser } from '../hooks/useUser'
import ConnectedHero from './ConnectedHero'
import ReferralPage from './ReferralPage'
import ReferralCodeModal from './ReferralCodeModal'
import Particles from './Particles'
import FuzzyText from './FuzzyText'
import PillBlue from '../assets/Pill-blue.png'
import PillRed from '../assets/Pill-red.png'
import { useReferralInfo } from '../hooks/useReferralInfo'

const Hero = () => {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)
  const { open } = useWeb3Modal()
  const { isConnected } = useAccount()
  const { 
    user, 
    loading, 
    isNewUser,
    showReferralModal, 
    handleReferralModalClose, 
    handleReferralSuccess 
  } = useUser()
  const { referralCode, referrerUsername, isLoadingReferrer } = useReferralInfo()

  const handleYesClick = () => {
    open()
  }

  const handleNoClick = () => {
    window.open('https://pump.fun', '_blank')
  }

  const isReferralPath = window.location.pathname.startsWith('/ref/')
  const referralCodeFromPath = isReferralPath ? window.location.pathname.replace('/ref/', '') : null
  
  if (isReferralPath && referralCodeFromPath) {
    return <ReferralPage referralCode={referralCodeFromPath} />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 sm:px-6" style={{ backgroundColor: '#1A1A1A' }}>
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">
            {isConnected ? 'Loading your profile...' : 'Connecting your wallet...'}
          </p>
        </div>
      </div>
    )
  }

  if (isConnected && user) {
    return (
      <>
        <ConnectedHero user={user} />
        
        {showReferralModal && isNewUser && (
          <ReferralCodeModal
            onClose={handleReferralModalClose}
            onSuccess={handleReferralSuccess}
          />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 sm:px-6" style={{ backgroundColor: '#1A1A1A' }}>
      {/* Particle effect background - only on main hero screen */}
      <div className="absolute inset-0 z-0">
        <Particles
          particleCount={150}
          particleSpread={8}
          speed={0.05}
          particleColors={['#ffffff', '#e5e5e5', '#cccccc']}
          moveParticlesOnHover={true}
          particleHoverFactor={0.5}
          alphaParticles={true}
          particleBaseSize={80}
          sizeRandomness={0.8}
          cameraDistance={25}
          disableRotation={false}
        />
      </div>

      {referralCode && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <p className="text-sm font-medium">
              {isLoadingReferrer
                ? 'Checking invite...'
                : referrerUsername
                  ? `🎉 You were invited by ${referrerUsername}! Connect your wallet to join.`
                  : '🎉 You have an invite! Connect your wallet to join.'}
            </p>
          </div>
        </div>
      )}

      <div className="relative z-10 text-center max-w-6xl mx-auto w-full">
        <div className="mb-8 sm:mb-12">
          <div className="px-2 flex justify-center">
            <FuzzyText
              fontSize="clamp(1.9rem, 8vw, 4.56rem)"
              fontWeight={400}
              color="#ffffff"
              enableHover={true}
              baseIntensity={0.15}
              hoverIntensity={0.4}
            >
              Are You Ready To Go..
            </FuzzyText>
          </div>
          <div className="px-2 flex justify-center">
            <FuzzyText
              fontSize="clamp(3.5rem, 16vw, 8rem)"
              fontWeight={700}
              color="#ffffff"
              enableHover={true}
              baseIntensity={0.15}
              hoverIntensity={0.4}
            >
              Beyond The Pump?
            </FuzzyText>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mt-8 sm:mt-12 lg:mt-16 px-4">
          <div className="relative w-full sm:w-auto">
            <div className={`absolute -top-4 sm:-top-6 -right-1 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 z-20 transition-all duration-300 ${
              hoveredButton === 'yes' ? 'twinkle-red' : ''
            }`}>
              <img 
                src={PillRed} 
                alt="Red pill icon" 
                className="w-full h-full object-contain"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
              {hoveredButton === 'yes' && (
                <div className="absolute inset-0 twinkle-overlay">
                  <div className="twinkle-star twinkle-star-red twinkle-star-1"></div>
                  <div className="twinkle-star twinkle-star-red twinkle-star-2"></div>
                  <div className="twinkle-star twinkle-star-red twinkle-star-3"></div>
                </div>
              )}
            </div>
            <button
              onClick={handleYesClick}
              onMouseEnter={() => setHoveredButton('yes')}
              onMouseLeave={() => setHoveredButton(null)}
              className="relative group w-full sm:w-auto px-8 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6 text-lg sm:text-xl lg:text-2xl font-bold text-white rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 active:scale-95 min-w-[140px] sm:min-w-[160px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 group-hover:from-red-500 group-hover:to-red-600 transition-all duration-300" />
              <div className={`absolute inset-0 bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                hoveredButton === 'yes' ? 'animate-pulse' : ''
              }`} />
              <div className="absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_20px_rgba(239,68,68,0.4)] sm:shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
              <span className="relative z-10">YES</span>
            </button>
          </div>

          <div className="relative w-full sm:w-auto">
            <div className={`absolute -top-4 sm:-top-6 -right-1 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 z-20 transition-all duration-300 ${
              hoveredButton === 'no' ? 'twinkle-blue' : ''
            }`}>
              <img 
                src={PillBlue} 
                alt="Blue pill icon" 
                className="w-full h-full object-contain"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
              {hoveredButton === 'no' && (
                <div className="absolute inset-0 twinkle-overlay">
                  <div className="twinkle-star twinkle-star-blue twinkle-star-1"></div>
                  <div className="twinkle-star twinkle-star-blue twinkle-star-2"></div>
                  <div className="twinkle-star twinkle-star-blue twinkle-star-3"></div>
                </div>
              )}
            </div>
            <button
              onClick={handleNoClick}
              onMouseEnter={() => setHoveredButton('no')}
              onMouseLeave={() => setHoveredButton(null)}
              className="relative group w-full sm:w-auto px-8 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6 text-lg sm:text-xl lg:text-2xl font-bold text-white rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 active:scale-95 min-w-[140px] sm:min-w-[160px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 group-hover:from-blue-500 group-hover:to-blue-600 transition-all duration-300" />
              <div className={`absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                hoveredButton === 'no' ? 'animate-pulse' : ''
              }`} />
              <div className="absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_20px_rgba(59,130,246,0.4)] sm:shadow-[0_0_30px_rgba(59,130,246,0.5)]" />
              <span className="relative z-10">NO</span>
            </button>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes twinkle-red {
            0%, 100% { 
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)) brightness(1);
            }
            50% { 
              filter: drop-shadow(0 2px 8px rgba(239,68,68,0.4)) brightness(1.2);
            }
          }

          @keyframes twinkle-blue {
            0%, 100% { 
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)) brightness(1);
            }
            50% { 
              filter: drop-shadow(0 2px 8px rgba(59,130,246,0.4)) brightness(1.2);
            }
          }
        `}
      </style>
    </div>
  )
}

export default Hero