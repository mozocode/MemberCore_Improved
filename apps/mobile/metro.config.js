// SDK 52+ auto-configures monorepo support (watchFolders, nodeModulesPaths, etc.)
// See: https://docs.expo.dev/guides/monorepos
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
