import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './styles/index.css';
import { useTranslation } from 'react-i18next';
import { frFR } from '@clerk/localizations';
import './i18n/index.js';
import { App } from './App.jsx';
import { setTokenGetter } from './lib/api.js';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/Confirm.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY — set it in client/.env');
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Clerk's own sign-in / sign-up screens are translated where Clerk offers the language
const CLERK_LOCALES = { fr: frFR };

/** Remounts the app when the interface language changes, so every screen re-renders in it. */
function LanguageRoot({ children }) {
  const { i18n } = useTranslation();
  return <div key={i18n.language} style={{ display: 'contents' }}>{children(i18n.language)}</div>;
}

/** Wires Clerk's session token into the axios instance. */
function ApiTokenBridge() {
  const { getToken } = useAuth();
  setTokenGetter(() => getToken());
  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageRoot>
      {(lang) => (
        <ClerkProvider
          localization={CLERK_LOCALES[lang]}
          publishableKey={PUBLISHABLE_KEY}
          afterSignOutUrl="/"
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <ApiTokenBridge />
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <ToastProvider>
                <ConfirmProvider>
                  <App />
                </ConfirmProvider>
              </ToastProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </ClerkProvider>
      )}
    </LanguageRoot>
  </React.StrictMode>
);
