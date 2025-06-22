import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const REFERRAL_CODE_KEY = 'pending_referral_code';

export const useReferralInfo = () => {
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referrerUsername, setReferrerUsername] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const path = window.location.pathname;
        if (path.startsWith('/ref/')) {
            const code = path.split('/ref/')[1];
            if (code) {
                sessionStorage.setItem(REFERRAL_CODE_KEY, code);
                // Clean up URL without causing navigation - Chrome-safe approach
                try {
                    const newUrl = window.location.pathname.split('/ref/')[0] || '/';
                    window.history.replaceState({}, document.title, newUrl);
                } catch (e) {
                    // Fallback for Chrome if history API fails
                    console.warn('Could not update URL:', e);
                }
            }
        }
        
        const codeFromStorage = sessionStorage.getItem(REFERRAL_CODE_KEY);
        setReferralCode(codeFromStorage);

    }, []);

    useEffect(() => {
        if (!referralCode) {
            setIsLoading(false);
            return;
        }

        const fetchReferrer = async () => {
            setIsLoading(true);
            try {
                // Add a small delay for Chrome compatibility
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const { data, error } = await supabase
                    .from('users')
                    .select('username')
                    .eq('referral_code', referralCode)
                    .single();

                if (error) {
                    console.error("Error fetching referrer username:", error.message);
                    setReferrerUsername(null);
                } else if (data) {
                    setReferrerUsername(data.username);
                }
            } catch (err) {
                console.error("Error in fetchReferrer:", err);
                setReferrerUsername(null);
            } finally {
                setIsLoading(false);
            }
        };

        // Use requestAnimationFrame for Chrome compatibility
        requestAnimationFrame(() => {
            fetchReferrer();
        });
    }, [referralCode]);
    
    const clearReferralInfo = () => {
        try {
            sessionStorage.removeItem(REFERRAL_CODE_KEY);
            setReferralCode(null);
            setReferrerUsername(null);
        } catch (e) {
            // Fallback for Chrome if sessionStorage fails
            console.warn('Could not clear referral info:', e);
        }
    };

    return { 
        referralCode, 
        referrerUsername, 
        isLoadingReferrer: isLoading, 
        clearReferralInfo 
    };
};