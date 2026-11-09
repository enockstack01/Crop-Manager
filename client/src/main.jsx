import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './styles/index.css';
import { useTranslation } from 'react-i18next';
import { frFR, deDE, esES, ptBR, zhCN, arSA, hiIN } from '@clerk/localizations';
import { i18nReady } from './i18n/index.js';
import { App } from './App.jsx';
import { setTokenGetter } from './lib/api.js';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/Confirm.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY: set it in client/.env');
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Clerk's own sign-in / sign-up screens are translated where Clerk offers the language
const CLERK_LOCALES = { fr: frFR, de: deDE, es: esES, pt: ptBR, zh: zhCN, ar: arSA, hi: hiIN };

/**
 * Remounts the screens when the interface language changes, so every screen re-renders in it. Clerk itself stays mounted (it is outside
 * this wrapper): restarting it on a language change reloaded the session and threw away a half-finished sign-in.
 */
function LanguageRoot({ children }) {
  const { i18n } = useTranslation();
  return <div key={i18n.language} style={{ display: 'contents' }}>{children}</div>;
}

/** Clerk's own sign-in texts follow the interface language without being restarted. */
function ClerkWithLanguage({ children }) {
  const { i18n } = useTranslation();
  return (
    <ClerkProvider
      localization={CLERK_LOCALES[i18n.language]}
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}

/** Wires Clerk's session token into the axios instance. */
function ApiTokenBridge() {
  const { getToken } = useAuth();
  setTokenGetter(() => getToken());
  return null;
}

// the first screen waits (a few milliseconds) for the chosen language's texts, then appears in that language
i18nReady.finally(() => ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkWithLanguage>
      <ApiTokenBridge />
      <QueryClientProvider client={queryClient}>
        <LanguageRoot>
          <BrowserRouter>
            <ToastProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </ToastProvider>
          </BrowserRouter>
        </LanguageRoot>
      </QueryClientProvider>
    </ClerkWithLanguage>
  </React.StrictMode>
));
