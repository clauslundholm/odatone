/* The app imports a few pure modules from the website (../lib) — pricing
   above all, so the app and the web can never quote different prices.
   Metro only reads files inside the project unless told otherwise. */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

/* Only ../lib, not the repository root: the root holds the website's own
   node_modules and .next, which Metro has no business watching. */
config.watchFolders = [path.resolve(projectRoot, "../lib")];

/* A file in ../lib must never resolve a package from the website's
   node_modules — two copies of React in one bundle is the classic way
   this goes wrong. Packages come from the app's own install, full stop. */
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
