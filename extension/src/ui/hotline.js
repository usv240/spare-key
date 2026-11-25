// The hotline and its backup line. Bundled numbers first; Remote Config's `hotline` key replaces them when it is well
// formed (shared/config.js hotlinesFrom), so a changed number reaches every install with no store update.
import { hotlinesFrom, EMERGENCY } from '../../../shared/config.js';

let lines = hotlinesFrom(null);
export const hotlines = () => lines;
export { EMERGENCY };

/** Uses the lines from Remote Config and repaints every [data-hotline] link on the page. */
export function useHotlines(remote) {
  lines = hotlinesFrom(remote);
  const set = (key, href, strongs) => document.querySelectorAll(`[data-hotline="${key}"]`).forEach(a => {
    a.setAttribute('href', href);
    a.querySelectorAll('strong').forEach((s, i) => { if (strongs[i] != null) s.textContent = strongs[i]; });
  });
  set('call', lines.main.tel, [lines.main.call]);
  set('text', lines.main.sms, [lines.main.word, lines.main.to]);
  set('backup-call', lines.backup.tel, [lines.backup.call]);
  set('backup-text', lines.backup.sms, [lines.backup.word, lines.backup.to]);
}
