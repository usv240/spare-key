// The latest Remote Config catalogue overrides, set by whichever page has fetched them (the offscreen page).
let current = {};
export const remoteOverrides = () => current;
export function setRemoteOverrides(o) { current = o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
