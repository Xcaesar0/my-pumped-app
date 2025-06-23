import React, { useState } from 'react'
import { X, Gift, Award } from 'lucide-react'
import CashNFTRewards from './CashNFTRewards'
import NameTagRewards from './NameTagRewards'

interface RewardsModalProps {
  onClose: () => void
}

const RewardsModal: React.FC<RewardsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'cash' | 'nametags'>('cash')

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div 
        className="w-full max-w-4xl h-[95vh] sm:max-h-[90vh] flex flex-col rounded-2xl border border-gray-700/50 overflow-hidden"
        style={{ backgroundColor: '#171717' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-700/50" style={{ backgroundColor: '#171717' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #52D593 0%, #4ade80 100%)' }}>
                <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Rewards</h2>
                <p className="text-xs sm:text-sm text-gray-400">Exclusive rewards for top performers</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors duration-200 hover:bg-gray-700/50"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 p-1 rounded-lg mt-4" style={{ backgroundColor: '#262626' }}>
            <button
              onClick={() => setActiveTab('cash')}
              className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === 'cash'
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              style={{ backgroundColor: activeTab === 'cash' ? '#52D593' : 'transparent' }}
            >
              <Gift className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Cash & NFTs</span>
            </button>
            <button
              onClick={() => setActiveTab('nametags')}
              className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === 'nametags'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              style={{ backgroundColor: activeTab === 'nametags' ? '#52D593' : 'transparent' }}
            >
              <Award className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Name Tags</span>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'cash' ? (
            <div className="h-full">
              <CashNFTRewards />
            </div>
          ) : (
            <div className="h-full">
              <NameTagRewards />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RewardsModal