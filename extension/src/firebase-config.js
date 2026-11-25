// Firebase web app configuration for the "spare-key-app" project (Spark plan: no billing account, so nothing here
// can cost money). These values identify the project; they are not secrets. Access is controlled by App Check and
// security rules, not by hiding this object.
export const firebaseConfig = {
  apiKey: 'AIzaSyBH5gSf0VxJhqCPmmt5KQULCxW0tEX8d-4',
  authDomain: 'spare-key-app.firebaseapp.com',
  projectId: 'spare-key-app',
  storageBucket: 'spare-key-app.firebasestorage.app',
  messagingSenderId: '1028727441035',
  appId: '1:1028727441035:web:6d7665f5e8ac785791b68e',
};

// App Check. Both values are public by design.
//   site:       reCAPTCHA Enterprise, score-based key (allowed domains: spare-key-app.web.app, .firebaseapp.com, localhost)
//   extension:  Chrome extensions have no attestation provider of their own, so the extension asks a small page on the
//               site for tokens (appcheck-bridge.html). That page answers only these extension ids, and firebase.json
//               lets only them frame it. The id is fixed by the "key" in manifest.json.
export const recaptchaSiteKey = '6LcA6SouAAAAAC0dXkvRkUvbFIbuZYL3QaOt1x0N';
export const extensionIds = ['opmpimgddnahhbmhioookicpekibjahl'];

/* global __BRIDGE_URL__ */
// A local build can point at a bridge served from localhost (tools/serve.mjs); releases use the site's own page, and
// the same page on the project's second Hosting domain if the first does not answer. Both domains are on the
// reCAPTCHA key, and both send the header that lets only this extension frame the page.
export const appCheckBridgeUrls = typeof __BRIDGE_URL__ === 'string' && __BRIDGE_URL__
  ? [__BRIDGE_URL__]
  : ['https://spare-key-app.web.app/appcheck-bridge.html', 'https://spare-key-app.firebaseapp.com/appcheck-bridge.html'];
export const appCheckBridgeUrl = appCheckBridgeUrls[0];
