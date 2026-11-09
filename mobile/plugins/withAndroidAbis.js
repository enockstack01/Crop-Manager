const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Which processors the Android app is built for, so one APK installs on small and large phones, 32-bit and 64-bit:
 *
 *   armeabi-v7a   32-bit ARM phones (older and many budget phones, and 64-bit phones running a 32-bit system)
 *   arm64-v8a     64-bit ARM phones (almost every phone sold in recent years)
 *   x86_64        64-bit emulators on a PC
 *
 * The on-phone language model (llama.rn) has no 32-bit build, so a 32-bit phone is never offered the offline assistant or its download:
 * the app installs and runs normally there (records, the leaf scan, the online AI), and never switches to the offline-assistant screen
 * (see ml/capability.ts and offlineModeApplies in lib/modePolicy.ts). 32-bit x86 is left out: no phones and only old emulators use it.
 */
const ABIS = 'armeabi-v7a,arm64-v8a,x86_64';

module.exports = function withAndroidAbis(config) {
  return withGradleProperties(config, (c) => {
    const props = c.modResults;
    const existing = props.find((p) => p.type === 'property' && p.key === 'reactNativeArchitectures');
    if (existing) existing.value = ABIS;
    else props.push({ type: 'property', key: 'reactNativeArchitectures', value: ABIS });
    return c;
  });
};
