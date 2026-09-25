// Dynamic layer over app.json. Android release builds block plain-HTTP requests,
// so cleartext traffic is allowed only while the configured API is http:// (e.g. the
// dev server on the LAN) and switches off automatically once the API moves to https.
module.exports = ({ config }) => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['expo-build-properties', { android: { usesCleartextTraffic: apiUrl.startsWith('http://') } }],
    ],
  };
};
