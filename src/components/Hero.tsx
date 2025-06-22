import React, { useState } from 'react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { useUser } from '../hooks/useUser'
import ConnectedHero from './ConnectedHero'
import ReferralPage from './ReferralPage'
import ReferralCodeModal from './ReferralCodeModal'
import LetterGlitch from './LetterGlitch'
import PixelTransition from './PixelTransition'
import PillBlue from '../assets/Pill-blue.png'
import PillRed from '../assets/Pill-red.png'
import AgentSmithImage from '../assets/image copy.png'
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

  // Debug logging
  console.log('🎭 Hero component state:', {
    isConnected,
    user: user ? { id: user.id, username: user.username } : null,
    loading,
    isNewUser,
    showReferralModal
  })

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

  // Show loading only when actually loading and no user exists yet
  if (loading && !user) {
    console.log('⏳ Hero: Showing loading state...')
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 sm:px-6" style={{ backgroundColor: '#1A1A1A' }}>
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">
            Setting up your profile...
          </p>
        </div>
      </div>
    )
  }

  // Show connected hero immediately when user exists, even if still loading background tasks
  if (isConnected && user) {
    console.log('✅ Hero: Showing ConnectedHero for user:', user.username)
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

  console.log('🏠 Hero: Showing landing page (not connected or no user)')
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-3 sm:px-6" style={{ backgroundColor: '#1A1A1A' }}>
      {/* LetterGlitch background effect */}
      <div className="absolute inset-0 z-0">
        <LetterGlitch
          glitchSpeed={50}
          centerVignette={true}
          outerVignette={false}
          smooth={true}
          glitchColors={['#2b4539', '#61dca3', '#61b3dc']}
        />
      </div>

      {referralCode && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-3">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg max-w-sm text-center">
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

      <div className="relative z-10 text-center max-w-7xl mx-auto w-full" style={{ transform: 'translateY(-10%)' }}>
        <div className="mb-6 sm:mb-8 md:mb-12">
          {/* First line - "Are You Ready To Go.." - Made 33% smaller */}
          <div className="px-1 flex justify-center mb-2 sm:mb-4">
            <div className="text-center">
              <h1 className="text-2xl xs:text-3xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-5xl font-normal text-white leading-tight tracking-wide">
                Are You Ready To Go..
              </h1>
            </div>
          </div>
          {/* Second line - "Beyond The Pump?" - Made 25% smaller */}
          <div className="px-1 flex justify-center">
            <div className="text-center">
              <h2 className="text-3xl xs:text-4xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight tracking-wide">
                Beyond The Pump?
              </h2>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mt-8 sm:mt-12 lg:mt-16 px-2 sm:px-4">
          {/* YES Button with Pixel Transition */}
          <div className="relative w-full sm:w-auto max-w-xs sm:max-w-none">
            <div className={`absolute -top-3 sm:-top-4 md:-top-6 -right-1 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 z-20 transition-all duration-300 ${
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
            
            <PixelTransition
              firstContent={
                <button
                  onMouseEnter={() => setHoveredButton('yes')}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="relative group w-full sm:w-auto px-6 sm:px-8 md:px-10 lg:px-12 py-3 sm:py-4 md:py-5 lg:py-6 text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 active:scale-95 min-w-[120px] sm:min-w-[140px] md:min-w-[160px]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 group-hover:from-red-500 group-hover:to-red-600 transition-all duration-300 rounded-lg sm:rounded-xl md:rounded-2xl" />
                  <div className={`absolute inset-0 bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg sm:rounded-xl md:rounded-2xl ${
                    hoveredButton === 'yes' ? 'animate-pulse' : ''
                  }`} />
                  <div className="absolute inset-0 rounded-lg sm:rounded-xl md:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_15px_rgba(239,68,68,0.4)] sm:shadow-[0_0_20px_rgba(239,68,68,0.4)] md:shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
                  <span className="relative z-10">YES</span>
                </button>
              }
              secondContent={
                <div className="w-full h-full relative rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden">
                  <img
                    src="https://images.saymedia-content.com/.image/ar_16:9%2Cc_fill%2Ccs_srgb%2Cq_auto:eco%2Cw_1200/MTc0NTA2NDM0MTA3NTQ5Njg2/why-neo-is-the-one-in-the-matrix-trilogy.png"
                    alt="Neo from The Matrix"
                    className="w-full h-full object-cover rounded-lg sm:rounded-xl md:rounded-2xl"
                  />
                </div>
              }
              gridSize={12}
              pixelColor="#ff0000"
              animationStepDuration={0.4}
              onClick={handleYesClick}
              aspectRatio="0%"
              className="w-full sm:w-auto rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden"
            />
          </div>

          {/* NO Button with Pixel Transition */}
          <div className="relative w-full sm:w-auto max-w-xs sm:max-w-none">
            <div className={`absolute -top-3 sm:-top-4 md:-top-6 -right-1 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 z-20 transition-all duration-300 ${
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
            
            <PixelTransition
              firstContent={
                <button
                  onMouseEnter={() => setHoveredButton('no')}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="relative group w-full sm:w-auto px-6 sm:px-8 md:px-10 lg:px-12 py-3 sm:py-4 md:py-5 lg:py-6 text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 active:scale-95 min-w-[120px] sm:min-w-[140px] md:min-w-[160px]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 group-hover:from-blue-500 group-hover:to-blue-600 transition-all duration-300 rounded-lg sm:rounded-xl md:rounded-2xl" />
                  <div className={`absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg sm:rounded-xl md:rounded-2xl ${
                    hoveredButton === 'no' ? 'animate-pulse' : ''
                  }`} />
                  <div className="absolute inset-0 rounded-lg sm:rounded-xl md:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_15px_rgba(59,130,246,0.4)] sm:shadow-[0_0_20px_rgba(59,130,246,0.4)] md:shadow-[0_0_30px_rgba(59,130,246,0.5)]" />
                  <span className="relative z-10">NO</span>
                </button>
              }
              secondContent={
                <div className="w-full h-full relative rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden">
                  <img
                    src={AgentSmithImage}
                    alt="Agent Smith from The Matrix"
                    className="w-full h-full object-cover rounded-lg sm:rounded-xl md:rounded-2xl"
                  />
                </div>
              }
              gridSize={12}
              pixelColor="#0066ff"
              animationStepDuration={0.4}
              onClick={handleNoClick}
              aspectRatio="0%"
              className="w-full sm:w-auto rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden"
            />
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