// The page reader. It is injected into the scan tab with chrome.scripting.executeScript, so it must be one
// self-contained function: no imports, no outside variables. It only reads: it never clicks, scrolls, types or submits.
//
// What it reads is decided by the check's reader settings (extension/src/scan/catalogue.js), which Remote Config can
// change for every install when a site changes its pages:
//   waitFor     { selector?, text? }   the page is ready when these are present (text is a regular expression)
//   timeoutMs                          how long to wait for that
//   main        a selector for the page's main area (default main, [role="main"], then body)
//   item        a selector for one entry (a device, an app, a person, a filter)
//   patterns    regular expressions (sources); when no item matches, each match's smallest enclosing block is an entry
//   exclude     a regular expression; entries whose text matches are dropped (headings, "Learn more", the account itself)
//   account     selectors whose aria-label or text names the checked account
//   more        a regular expression for "Show all" style controls that mean more entries are hidden
//   errorText   a regular expression for an error page
//   emptyText   a regular expression for the page's own words when there is nothing to list ("You have no filters")
//
// Returns { ready, timedOut, errorPage, via, entries: [{ i, text, href }], account, moreHidden, mainText, title, waitedMs,
// withinFound, emptyConfirmed }. A page that lists nothing counts as empty only when it says so (emptyConfirmed) or the
// setting's own section was found (withinFound); otherwise the page may look different from what the reader knows.
// `doc` is the page to read: the scan tab's own document when injected, or a same-origin frame's document on the site's
// practice check.
export function readPage(cfg, doc = document) {
  const SHOW_TEXT = 4; // SHOW_TEXT, the same in every window
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rootOf = () => (cfg.main && doc.querySelector(cfg.main)) || doc.querySelector('main, [role="main"]') || doc.body;
  const visible = el => !el.checkVisibility || el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  // An element's visible text, one line per text node. innerText depends on layout and runs words together when two
  // inline elements touch ("Sam Porter" + "sam.porter@..." became "Portersam.porter@..."); text nodes do not.
  const textOf = el => {
    if (!el) return '';
    const parts = [];
    const walker = doc.createTreeWalker(el, SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(p.tagName) || !visible(p)) continue;
      const t = n.nodeValue.replace(/[\s ]+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join('\n');
  };
  const re = (source, flags = 'i') => { try { return source ? new RegExp(source, flags) : null; } catch { return null; } };

  const ready = () => {
    const root = rootOf();
    if (!root) return false;
    if (cfg.waitFor?.selector && !doc.querySelector(cfg.waitFor.selector)) return false;
    const want = re(cfg.waitFor?.text);
    if (want && !want.test(textOf(root))) return false;
    return true;
  };

  return (async () => {
    const t0 = performance.now();
    const timeout = Math.max(1000, Math.min(60000, cfg.timeoutMs || 15000));
    while (!ready() && performance.now() - t0 < timeout) await sleep(250);
    const isReady = ready();
    // Lists on single-page apps often fill in just after the heading appears.
    if (isReady) await sleep(cfg.settleMs ?? 700);
    let root = rootOf();
    const fullText = textOf(root);
    const mainText = fullText.slice(0, 20000);
    let withinFound = false;
    // within: read only the part of the page under one setting's heading ("Grant access to your account").
    const within = re(cfg.within);
    if (within) {
      const walker = doc.createTreeWalker(root, SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // Visible headings only: a real Google Photos page holds hidden "Partner sharing" text in a closed dialog, and
        // reading that as the section reported nothing found on a page that shows no partner sharing at all.
        if (!within.test(node.nodeValue || '') || !node.parentElement || !visible(node.parentElement)) continue;
        let el = node.parentElement;
        // Without a row, section or list item around it, the smallest box around the heading that holds more than the
        // heading is the section (a page rebuilt from plain boxes).
        const heading = (node.nodeValue || '').trim();
        let box = null;
        for (let up = node.parentElement; up && up !== root; up = up.parentElement) if (textOf(up).length > heading.length + 2) { box = up; break; }
        while (el && el !== root && !/^(TR|SECTION|FIELDSET|LI)$/.test(el.tagName) && !el.matches('[role="row"], [role="region"], [data-section]')) el = el.parentElement;
        if (el && el !== root) { root = el; withinFound = true; break; }
        if (box) { root = box; withinFound = true; break; }
      }
    }
    const errorPage = !!re(cfg.errorText || '(something went wrong|page not found|error 404|try again later|this page isn.t available)')?.test(`${doc.title}\n${mainText.slice(0, 2000)}`);
    const exclude = re(cfg.exclude);

    // The entries: by the item selector, or else by patterns.
    let via = 'none';
    let els = [];
    // A check that names its section ("within") reads only that section. If the section is not on the page, nothing is
    // read: reading the whole page instead picked up unrelated lines on a real Google Photos page (November 22, 2026).
    const sectionMissing = !!within && !withinFound;
    if (sectionMissing) via = 'section_missing';
    else if (cfg.item) {
      try { els = [...root.querySelectorAll(cfg.item)].filter(visible); } catch { els = []; }
      if (els.length) via = 'items';
    }
    if (!sectionMissing && !els.length && cfg.patterns?.length) {
      const found = new Set();
      const patterns = cfg.patterns.map(p => re(p, 'i')).filter(Boolean);
      const counters = cfg.patterns.map(p => re(p, 'gi'));
      const count = (k, el) => (textOf(el).match(counters[k]) || []).length;
      const walker = doc.createTreeWalker(root, SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const k = patterns.findIndex(p => p.test(node.nodeValue || ''));
        if (k < 0) continue;
        // Grow to the block around the match that still reads as one entry: stop at a list or table, at about 240
        // characters, or before taking in a second match of the same kind (two delegates in one cell are two entries).
        let el = node.parentElement;
        while (el && el !== root && el.parentElement && el.parentElement !== root && textOf(el.parentElement).length <= 240
          && !/^(UL|OL|TABLE|TBODY|SECTION|MAIN|FORM)$/.test(el.parentElement.tagName)
          // ARIA lists and tables are lists and tables too: many sites build them from plain boxes.
          && !el.parentElement.matches('[role="list"], [role="table"], [role="grid"], [role="rowgroup"], [role="listbox"], [role="region"]')
          && count(k, el.parentElement) <= count(k, el)) el = el.parentElement;
        if (el && visible(el)) found.add(el);
      }
      // Keep only the outermost of nested matches.
      els = [...found].filter(el => ![...found].some(o => o !== el && o.contains(el)));
      if (els.length) via = 'patterns';
    }
    // Form state inside an entry: which radio button is chosen and which option is selected. A settings page can list an
    // address while the setting itself is off ("Disable forwarding" chosen), and the text alone cannot say which.
    const stateOf = el => {
      const out = [];
      const labelFor = input => textOf(input.closest('label') || (input.id && doc.querySelector(`label[for="${(doc.defaultView || window).CSS.escape(input.id)}"]`)) || input.parentElement).slice(0, 120);
      for (const r of el.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, [role="radio"][aria-checked="true"]')) out.push(`chosen: ${labelFor(r)}`);
      for (const s of el.querySelectorAll('select')) if (s.selectedOptions[0]) out.push(`selected: ${s.selectedOptions[0].textContent.trim().slice(0, 120)}`);
      return out;
    };
    const seen = new Set();
    const entries = [];
    for (const el of els) {
      const text = textOf(el).slice(0, 300);
      if (!text || seen.has(text) || (exclude && exclude.test(text))) continue;
      seen.add(text);
      const a = el.matches('a[href]') ? el : el.querySelector('a[href]');
      entries.push({ i: entries.length, text, href: a ? a.href : '', state: stateOf(el) });
      if (entries.length >= 60) break;
    }

    // The checked account, from the page's own account control.
    let account = null;
    for (const sel of cfg.account || []) {
      let el = null;
      try { el = doc.querySelector(sel); } catch { /* bad selector from config */ }
      const label = el && (el.getAttribute('aria-label') || textOf(el));
      const email = label && (label.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0];
      if (email) {
        const name = (label.match(/:\s*([^(]+?)\s*\(/) || [])[1] || '';
        account = { email, name: name.trim() };
        break;
      }
    }

    const more = re(cfg.more || '(show all|see all|view all|show more|more devices)');
    const moreHidden = !!more && [...root.querySelectorAll('a, button, [role="button"]')].some(b => visible(b) && more.test(textOf(b)));

    return {
      ready: isReady,
      timedOut: !isReady,
      errorPage,
      via,
      entries,
      account,
      moreHidden,
      mainText,
      title: doc.title.slice(0, 200),
      waitedMs: Math.round(performance.now() - t0),
      withinFound,
      // More text than mainText holds: anything read from mainText alone is only part of the page.
      mainTextCut: fullText.length > mainText.length,
      emptyConfirmed: !!re(cfg.emptyText)?.test(mainText),
    };
  })();
}
