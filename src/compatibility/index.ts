// process.envType is set by our js-bundler rollup
// this way we can produce two separate bundles
// one for node.js, one for use in browsers
export const isBrowser = process.envType === 'browser';