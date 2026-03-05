/**
 * Metro config for monorepo – extends @expo/metro-config.
 * Tells Metro where to find workspace packages and hoisted node_modules.
 */
const { getDefaultConfig } = require('@expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')
const rootModules = path.resolve(monorepoRoot, 'node_modules')
const localModules = path.resolve(projectRoot, 'node_modules')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [monorepoRoot]

config.resolver.nodeModulesPaths = [
  localModules,
  rootModules,
]

config.resolver.disableHierarchicalLookup = false

// Only block local copies of singleton native packages when the hoisted
// copy exists at the monorepo root. On EAS Build the layout may differ.
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

const blockPatterns = []
for (const pkg of singletonPackages) {
  const localCopy = path.resolve(localModules, pkg)
  const rootCopy = path.resolve(rootModules, pkg)
  if (fs.existsSync(localCopy) && fs.existsSync(rootCopy) && localCopy !== rootCopy) {
    blockPatterns.push(new RegExp('^' + escapeRegExp(localCopy) + '[\\\\/].*$'))
  }
}

if (blockPatterns.length > 0) {
  const existing = config.resolver.blockList || []
  config.resolver.blockList = Array.isArray(existing)
    ? [...existing, ...blockPatterns]
    : [existing, ...blockPatterns].filter(Boolean)
}

module.exports = config
