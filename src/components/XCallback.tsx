import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const XCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth_token = params.get('oauth_token');
    const oauth_verifier = params.get('oauth_verifier');

    if (!oauth_token || !oauth_verifier) {
      setStatus('error');
      setMessage('Missing OAuth parameters from X.');
      return;
    }

    const finishXOAuth = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_FUNCTION_URL || '/functions/v1/x-oauth'}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oauth_token, oauth_verifier })
          }
        );
        const data = await response.json();
        if (data.success) {
          setStatus('success');
          setMessage('X account linked successfully!');
          setTimeout(() => navigate('/profile'), 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to link X account.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Error completing X OAuth flow.');
      }
    };

    finishXOAuth();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <div className="p-8 rounded-lg bg-gray-900 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">X (Twitter) Account Linking</h2>
        {status === 'loading' && <p>Linking your X account...</p>}
        {status === 'success' && <p className="text-green-400">{message}</p>}
        {status === 'error' && <p className="text-red-400">{message}</p>}
      </div>
    </div>
  );
};

export default XCallback; 