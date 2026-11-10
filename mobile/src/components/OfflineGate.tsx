import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './Confirm';
import { useSplashReady } from './AppSplash';
import { OfflineModeScreen } from '../screens/OfflineModeScreen';
import { useOfflineMode } from '../lib/connectivity';
import { hasSavedAccount } from '../lib/savedAccount';
import { offlineTakeover } from '../lib/modePolicy';
import { offlineLlmSupported } from '../ml/capability';
import { useAutoDownload } from '../ml/modelDownload';

/** Lets the "connecting" screen offer the offline tools when the sign-in service cannot be reached. */
const Ctx = createContext<{ openOfflineTools: () => void }>({ openOfflineTools: () => {} });
export const useOfflineTools = () => useContext(Ctx);

/**
 * Sits above sign-in and the rest of the app, so it works before anyone has signed in and without a server:
 *  - an account that was signed in on this phone keeps working with no internet: the app opens as usual from the copy saved on the phone, the
 *    banner says what is waiting to be sent, and everything is sent by itself when the connection returns
 *  - with no internet AND no saved account (a fresh install, or after signing out) there is nothing to open, so the offline tools page (scan a plant,
 *    ask a question) is shown instead, and the app comes back by itself when the connection returns
 *  - the offline assistant downloads itself on the first launch (Wi-Fi, enough room) and continues whenever the connection returns
 */
export function OfflineGate({ children }: { children: React.ReactNode }) {
  const noInternet = useOfflineMode();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [forced, setForced] = useState(false);
  const splashReady = useSplashReady();
  useAutoDownload();

  // re-read whenever the connection changes: the flag is written once the account has loaded
  useEffect(() => { hasSavedAccount().then(setSaved); }, [noInternet]);
  const offline = offlineTakeover(noInternet, offlineLlmSupported(), saved, forced);

  // with no signal the sign-in service never answers, so the splash must not wait for it
  useEffect(() => { if (noInternet) splashReady(); }, [noInternet, splashReady]);
  useEffect(() => { if (!noInternet) setForced(false); }, [noInternet]);

  const open = useCallback(() => setForced(true), []);

  return (
    <Ctx.Provider value={{ openOfflineTools: open }}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }} importantForAccessibility={offline ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={offline}>
          {children}
        </View>
        {offline ? (
          <View style={StyleSheet.absoluteFill}>
            <ToastProvider>
              <ConfirmProvider>
                <OfflineModeScreen onClose={forced ? () => setForced(false) : undefined} />
              </ConfirmProvider>
            </ToastProvider>
          </View>
        ) : null}
      </View>
    </Ctx.Provider>
  );
}
