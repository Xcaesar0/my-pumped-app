import { useEffect } from 'react'

export const useReferralPersistence = () => {
  useEffect(() => {
    // Check for referral parameter in URL on page load
    const urlParams = new URLSearchParams(window.location.search)
    const referralParam = urlParams.get('ref')
    
    if (referralParam) {
      console.log('Found referral parameter in URL:', referralParam)
      // Store referral in localStorage for persistence
      localStorage.setItem('pending_referral', referralParam)
      
      // Clean up URL to remove referral parameter
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('ref')
      window.history.replaceState({}, document.title, newUrl.toString())
    }

    // Check for referral in URL path (e.g., /ref/ABC123)
    const pathMatch = window.location.pathname.match(/\/ref\/(.+)/)
    if (pathMatch) {
      const referralCode = pathMatch[1]
      console.log('Found referral code in path:', referralCode)
      localStorage.setItem('pending_referral', referralCode)
      
      // Don't redirect immediately - let the ReferralPage component handle it
      // Only redirect if we're not already on the referral page
      if (!window.location.pathname.startsWith('/ref/')) {
        window.history.replaceState({}, document.title, '/')
      }
    }
  }, [])

  const getPendingReferral = (): string | null => {
    return localStorage.getItem('pending_referral')
  }

  const clearPendingReferral = () => {
    localStorage.removeItem('pending_referral')
  }

  const hasPendingReferral = (): boolean => {
    return !!localStorage.getItem('pending_referral')
  }

  return {
    getPendingReferral,
    clearPendingReferral,
    hasPendingReferral
  }
}