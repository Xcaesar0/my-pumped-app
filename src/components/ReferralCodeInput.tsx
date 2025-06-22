import React, { useState } from 'react'
import { Hash, AlertCircle, CheckCircle, Gift } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ReferralCodeInputProps {
  userId: string
  onSuccess: () => void
}

const ReferralCodeInput: React.FC<ReferralCodeInputProps> = ({ userId, onSuccess }) => {
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!referralCode.trim()) {
      setError('Please enter a referral code.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('process_referral_code_entry', {
        referral_code_param: referralCode.trim(),
        referee_id_param: userId
      })

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      if (data?.success) {
        setSuccess(data.message || 'Referral code applied successfully!')
        onSuccess()
      } else {
        setError(data?.error || 'Invalid or expired referral code.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
        <div className="flex items-center space-x-2 mb-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">Success!</span>
        </div>
        <p className="text-sm text-white mb-1">{success}</p>
        <p className="text-xs text-gray-400">You earned +25 points. Connect your X account to activate more rewards.</p>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
      <div className="flex items-center space-x-2 mb-3">
        <Hash className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Enter Referral Code</span>
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
          <Gift className="w-3 h-3" />
          <span className="text-xs font-semibold">+25 pts</span>
        </div>
      </div>
      
      {error && (
        <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/30 flex items-center space-x-2">
          <AlertCircle className="w-3 h-3 text-red-400" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <form onSubmit={handleApplyCode} className="space-y-3">
        <input
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value)}
          placeholder="Enter referral code"
          className="w-full px-3 py-2 text-sm text-white bg-black border border-gray-600/50 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
          disabled={loading}
        />
        <button
          type="submit"
          className="w-full px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-green-600/50 hover:shadow-green-500/70 focus:outline-none focus:ring-4 focus:ring-green-500/50"
          disabled={loading}
        >
          {loading ? 'Applying...' : 'Apply Code'}
        </button>
      </form>
      
      <p className="text-xs text-gray-400 mt-2 text-center">
        Have a friend's referral code? Enter it to earn bonus points!
      </p>
    </div>
  )
}

export default ReferralCodeInput