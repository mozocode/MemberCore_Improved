// Monorepo redirect: expo/AppEntry.js resolves ../../App to this file
// because expo is hoisted to root/node_modules/expo/.
// Re-export the actual App from the mobile project.
export { default } from './apps/mobile/App'
