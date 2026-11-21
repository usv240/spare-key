// Service worker: opens the side panel, owns the offscreen page (Gemini Nano and every Firebase call), keeps the
// session's state in chrome.storage.session, and runs Quick exit.
// It never shows a badge or a count on the toolbar icon.
import { QUICK_EXIT_URL } from '../../shared/config.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Session storage is cleared when the browser closes. Only the extension's own pages may read it.
chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});

let creating = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ||= chrome.offscreen.createDocument({
    url: 'src/offscreen.html',
    // The page frames the site's App Check bridge, and hosts Gemini Nano sessions, which need a document.
    reasons: ['IFRAME_SCRIPTING'],
    justification: 'Runs the on-device model and frames the App Check token page for Firebase AI Logic.',
  }).finally(() => { creating = null; });
  await creating;
}

// "What left this computer": every cloud request, appended before it is sent (see src/ai.js).
const SENT_MAX = 200;
let sentWrite = Promise.resolve();
function appendSent(entry) {
  sentWrite = sentWrite.then(async () => {
    const { sentLog = [] } = await chrome.storage.session.get('sentLog');
    sentLog.push(entry);
    await chrome.storage.session.set({ sentLog: sentLog.slice(-SENT_MAX) });
  });
  return sentWrite;
}

/**
 * Quick exit, in this order: forget everything from this session; close the scan tab; replace the page in the active
 * tab with an ordinary one; close the side panel. Each step runs even if an earlier one fails.
 */
async function quickExit({ windowId, url } = {}) {
  const target = /^https:\/\//.test(url || '') ? url : (await chrome.storage.local.get('quickExitUrl')).quickExitUrl || QUICK_EXIT_URL;
  const { scanTabId } = await chrome.storage.session.get('scanTabId').catch(() => ({}));
  await chrome.storage.session.clear().catch(() => {});
  if (await chrome.offscreen.hasDocument().catch(() => false)) await chrome.offscreen.closeDocument().catch(() => {});
  if (scanTabId) await chrome.tabs.remove(scanTabId).catch(() => {});
  const [tab] = await chrome.tabs.query({ active: true, ...(windowId ? { windowId } : { lastFocusedWindow: true }) }).catch(() => []);
  if (tab) {
    await chrome.tabs.update(tab.id, { url: target }).catch(() => {});
    windowId ||= tab.windowId;
  }
  // chrome.sidePanel.close() is checked for at run time; the panel also closes itself as a fallback.
  if (windowId && typeof chrome.sidePanel.close === 'function') await chrome.sidePanel.close({ windowId }).catch(() => {});
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'quick-exit') quickExit({ windowId: tab?.windowId });
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.target === 'offscreen') return false;
  switch (msg.type) {
    case 'sk:ensure-offscreen':
      ensureOffscreen().then(() => reply({ ok: true }), e => reply({ ok: false, error: String(e) }));
      return true;
    case 'sk:sent':
      // Only from the extension's own pages.
      if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`)) return false;
      appendSent(msg.entry).then(() => reply({ ok: true }), e => reply({ ok: false, error: String(e) }));
      return true;
    case 'sk:quick-exit':
      quickExit({ windowId: msg.windowId, url: msg.url }).then(() => reply({ ok: true }), () => reply({ ok: false }));
      return true;
    case 'sk:capabilities':
      reply({
        sidePanelClose: typeof chrome.sidePanel.close === 'function',
        chrome: (navigator.userAgent.match(/Chrome\/([\d.]+)/) || [])[1] || 'unknown',
      });
      return false;
    default:
      return false;
  }
});
