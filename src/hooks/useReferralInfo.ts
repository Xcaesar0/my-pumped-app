import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const REFERRAL_CODE_KEY = 'pending_referral_code';

export const useReferralInfo = () => {
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referrerUsername, setReferrerUsername] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const path = window.location.pathname;
        if (path.startsWith('/ref/')) {
            const code = path.split('/ref/')[1];
            if (code) {
                sessionStorage.setItem(REFERRAL_CODE_KEY, code);
                window.history.replaceState({}, document.title, window.location.pathname.split('/ref/')[0] || '/');
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
            setIsLoading(false);
        };

        fetchReferrer();
    }, [referralCode]);
    
    const clearReferralInfo = () => {
        sessionStorage.removeItem(REFERRAL_CODE_KEY);
        setReferralCode(null);
        setReferrerUsername(null);
    };

    return { referralCode, referrerUsername, isLoadingReferrer: isLoading, clearReferralInfo };
}; 