import React, { useState } from 'react'
import { X, Gift, AlertCircle, CheckCircle, Users, Hash } from 'lucide-react'
import { User, processReferralFromCode, validateReferralCode } from '../lib/supabase'
import { useUser } from '../hooks/useUser'

interface ReferralCodeModalProps {
  onClose: () => void
  onSuccess: () => void
}

const ReferralCodeModal: React.FC<ReferralCodeModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useUser()
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow A-Z and 0-9, convert to uppercase
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 12) {
      setReferralCode(value)
      setError(null) // Clear error when user types
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !referralCode) return

    setLoading(true)
    setError(null)

    try {
      const result = await processReferralFromCode(referralCode.trim(), user.id)
      
      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 3000) // Show success message for 3 seconds
      } else {
        setError(result.error || 'Invalid referral code')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit referral code.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] rounded-2xl border border-gray-700/50 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Enter Referral Code</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
          <p className="text-gray-400 mb-6">
            Enter a referral code to get bonus points and rewards.
          </p>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={referralCode}
              onChange={handleInputChange}
              placeholder="Enter code"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading || !referralCode}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-600"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ReferralCodeModal