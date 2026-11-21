// The two Chrome checks (TECHNICAL-DESIGN.md section 7). They read the browser itself, with code only, and send nothing.

// Permissions that let an extension watch or change what you do, in plain words.
const POWERFUL = {
  history: 'see your browsing history',
  tabs: 'see the pages you open',
  cookies: 'read your sign-in cookies',
  webRequest: 'watch the pages you load',
  webRequestBlocking: 'change the pages you load',
  declarativeNetRequest: 'change the pages you load',
  desktopCapture: 'record your screen',
  tabCapture: 'record your tabs',
  proxy: 'route your browsing through another computer',
  debugger: 'take control of your pages',
  clipboardRead: 'read what you copy',
  geolocation: 'see your location',
  management: 'see and turn off your other extensions',
};
const ALL_SITES = /^(<all_urls>|\*:\/\/\*\/\*|https?:\/\/\*\/\*)$/;

/** Enabled extensions that can read every page, or that someone who manages this browser installed. */
export async function checkExtensions(nextRef) {
  if (!chrome.management?.getAll) return { status: 'not_checked', why: 'no_permission', findings: [] };
  const all = await chrome.management.getAll();
  const others = all.filter(x => x.enabled && x.type === 'extension' && x.id !== chrome.runtime.id);
  const findings = [];
  for (const x of others) {
    const hosts = x.hostPermissions || [];
    const allSites = hosts.some(h => ALL_SITES.test(h)) || hosts.length >= 20;
    const powers = (x.permissions || []).filter(p => POWERFUL[p]).map(p => POWERFUL[p]);
    const byAdmin = x.installType === 'admin';
    if (!byAdmin && !(allSites && powers.length)) continue;
    const can = [...new Set([...(allSites ? ['read and change every website you visit'] : []), ...powers])];
    findings.push({
      ref: nextRef(),
      code: 'chrome.extension.broad_access',
      check: 'chrome.extensions',
      service: 'chrome',
      group: 'browsing',
      label: x.name.slice(0, 90),
      detail: `${x.name}\nIt can ${can.join(', ')}.${byAdmin ? '\nIt was installed by whoever manages this browser, not from your own clicks.' : ''}`,
      howFound: 'reader',
      confidence: 'high',
      disagree: false,
      recency: 'unknown',
      access: ['browsing'],
      ownership: null,
      openUrl: `chrome://extensions/?id=${x.id}`,
      accountEmail: '',
      extensionId: x.id,
      installedByAdmin: byAdmin,
    });
  }
  return { status: 'checked', entries: others.length, findings };
}

/** Whether this Chrome sends history and passwords to an account other than the one being checked. */
export async function checkSync(nextRef, account) {
  if (!chrome.identity?.getProfileUserInfo) return { status: 'not_checked', why: 'no_permission', findings: [] };
  const info = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }).catch(() => null);
  const synced = (info?.email || '').toLowerCase();
  if (!synced) return { status: 'checked', entries: 0, findings: [] };
  if (!account?.email) return { status: 'not_checked', why: 'nothing_to_compare', findings: [] };
  if (synced === account.email.toLowerCase()) return { status: 'checked', entries: 1, findings: [] };
  return {
    status: 'checked',
    entries: 1,
    findings: [{
      ref: nextRef(),
      code: 'chrome.sync.other_account',
      check: 'chrome.sync',
      service: 'chrome',
      group: 'browsing',
      label: `This browser syncs to ${synced}`,
      detail: `This Chrome is signed in to ${synced}, not ${account.email}. It may be sending your history and passwords to that account.`,
      howFound: 'reader',
      confidence: 'high',
      disagree: false,
      recency: 'now',
      access: ['browsing'],
      ownership: null,
      openUrl: 'chrome://settings/syncSetup',
      accountEmail: account.email,
    }],
  };
}
