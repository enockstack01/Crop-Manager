import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './Confirm';
import { useSplashReady } from './AppSplash';
import { OfflineModeScreen } from '../screens/OfflineModeScreen';
import { useOfflineMode } from '../lib/connectivity';
import { offlineModeApplies } from '../lib/modePolicy';
import { offlineLlmSupported } from '../ml/capability';
import { useAutoDownload } from '../ml/modelDownload';

/**
 * Sits above sign-in and the rest of the app, so it works before anyone has signed in and without a server:
 *  - while the phone has no internet, the offline assistant is shown over everything and the app underneath is hidden from screen
 *    readers; when the connection returns the layer goes away by itself and the app is exactly where it was left
 *  - the offline assistant downloads itself on the first launch (Wi-Fi, enough room) and continues whenever the connection returns
 */
export function OfflineGate({ children }: { children: React.ReactNode }) {
  const noInternet = useOfflineMode();
  // a 32-bit phone is never switched to the offline-assistant screen: it has no offline assistant, so it keeps the normal app
  const offline = offlineModeApplies(noInternet, offlineLlmSupported());
  const splashReady = useSplashReady();
  useAutoDownload();

  // with no signal the sign-in service never answers, so the splash must not wait for it
  useEffect(() => { if (noInternet) splashReady(); }, [noInternet, splashReady]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} importantForAccessibility={offline ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={offline}>
        {children}
      </View>
      {offline ? (
        <View style={StyleSheet.absoluteFill}>
          <ToastProvider>
            <ConfirmProvider>
              <OfflineModeScreen />
            </ConfirmProvider>
          </ToastProvider>
        </View>
      ) : null}
    </View>
  );
}
