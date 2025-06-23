import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Auth0Provider } from '@auth0/auth0-react';

// Log environment variables to verify they are loaded
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_WALLETCONNECT_PROJECT_ID:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID);

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <Auth0Provider
      domain="dev-zhv5b08q30xa1r26.us.auth0.com"
      clientId="vtgbmQsj4NzNamWabs0AJa92XVBDbRaR"
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      <App />
    </Auth0Provider>
  </StrictMode>
);
