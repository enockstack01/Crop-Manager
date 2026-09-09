// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

// `mobile` is intentionally NOT one of the repo's npm workspaces (server, client)
// and ships its own complete node_modules, so the default config is sufficient.
const config = getDefaultConfig(__dirname);

module.exports = config;
