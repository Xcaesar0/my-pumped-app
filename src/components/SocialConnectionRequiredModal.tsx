import React from 'react'
import { X } from 'lucide-react'
import TelegramIcon from './icons/TelegramIcon'
import XIcon from './icons/XIcon'

interface SocialConnectionRequiredModalProps {
  platform: 'telegram' | 'x'
  onClose: () => void
  onConnect: () => void
}

const SocialConnectionRequiredModal: React.FC<SocialConnectionRequiredModalProps> = ({
  platform,
  onClose,
  onConnect,
}) => {
  const platformConfig = {
    telegram: {
      name: 'Telegram',
      icon: <TelegramIcon className="w-8 h-8 text-blue-400" />,
      description: 'To complete this task, you need to connect your Telegram account.',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
    },
    x: {
      name: 'X (Twitter)',
      icon: <XIcon className="w-8 h-8 text-white" />,
      description: 'To complete this task, you need to connect your X account.',
      buttonColor: 'bg-gray-800 hover:bg-gray-900',
    },
  }

  const config = platformConfig[platform]

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      ></div>
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#141414] rounded-2xl border border-gray-700/50 shadow-lg z-50"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-white">{config.name} Connection Required</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors duration-200 hover:bg-gray-700/50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
              {config.icon}
            </div>
            <h4 className="text-lg font-semibold text-white">Connect Your {config.name} Account</h4>
            <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
              {config.description}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={onConnect}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${config.buttonColor}`}
            >
              <span className="text-base">Connect {config.name}</span>
            </button>
            <p className="text-xs text-gray-500 text-center px-4">
              We only request read-only access to verify actions. We will never post on your behalf.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default SocialConnectionRequiredModal