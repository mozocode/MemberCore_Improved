/**
 * Metro config extending @expo/metro-config (required for EAS Build).
 * Customizations: monorepo watchFolders, resolver paths, and singleton blockList.
 */
const { getDefaultConfig } = require('@expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')
const rootModules = path.resolve(monorepoRoot, 'node_modules')
const localModules = path.resolve(projectRoot, 'node_modules')

// Start from Expo's default (extends @expo/metro-config)
const config = getDefaultConfig(projectRoot)

config.watchFolders = [monorepoRoot]

// Root modules first so hoisted copies win
config.resolver.nodeModulesPaths = [
  rootModules,
  localModules,
]

config.resolver.disableHierarchicalLookup = false

// Block the local copies of native singleton packages so Metro
// can only find the single root copy. This prevents the
// "Tried to register two views with the same name" crash.
const singletonPackages = [
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
  'react',
  'react-native',
]

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const blockPatterns = singletonPackages.map((pkg) => {
  const blocked = path.resolve(localModules, pkg)
  return new RegExp('^' + escapeRegExp(blocked) + '[\\\\/].*$')
})

const existingBlockList = config.resolver.blockList || []
const allBlocked = Array.isArray(existingBlockList)
  ? [...existingBlockList, ...blockPatterns]
  : [existingBlockList, ...blockPatterns].filter(Boolean)

config.resolver.blockList = allBlocked

module.exports = config
