// Chrome launch settings shared by the test tools. Adapted from the author's Still Recalled entry.
import puppeteer from 'puppeteer-core';
import { rmSync } from 'node:fs';

export const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// The kept test profile with Gemini Nano. It lives on E: (an SSD with room to spare): Chrome needs about 22 GB free on
// the profile's drive before it downloads the model, and C: has less.
export const NANO_PROFILE = process.env.SK_NANO_PROFILE || 'E:/spare-key-test/nano-profile';

/**
 * Flags for a profile that serves Gemini Nano. Puppeteer's defaults turn off background networking and the
 * OptimizationHints feature, which is how Chrome downloads and serves the model; everything else stays as Puppeteer
 * sets it. With ignoreDefaultArgs, Puppeteer drops its userDataDir option, so the profile goes in as a flag.
 */
export function builtInModelArgs({ headless = false, userDataDir } = {}) {
  return [...(userDataDir ? [`--user-data-dir=${userDataDir}`] : []), ...puppeteer.defaultArgs({ headless, enableExtensions: true })]
    .filter(a => a !== '--disable-background-networking' && a !== 'about:blank')
    .map(a => a.startsWith('--disable-features=') ? '--disable-features=' + a.slice(19).split(',').filter(f => f !== 'OptimizationHints').join(',') : a);
}

/** A kept profile can keep running an old copy of the extension's service worker; removing the cache prevents that. */
export function freshServiceWorkers(userDataDir) {
  if (userDataDir) rmSync(`${userDataDir}/Default/Service Worker`, { recursive: true, force: true });
}
