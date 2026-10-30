/* Madhav design system: the shared header's color scheme button (.md-theme), the one theme control on sbmadhav.com.
   Load with <script src="/design-system/v/<version>/header.js" defer>, after the pre-paint snippet in <head>.

   Pages follow the system setting (prefers-color-scheme) by default. A click switches between Daybreak and
   Deep Space. A choice that differs from the system is saved in localStorage "theme" ("light" or "dark") and set
   as <html data-theme>; switching back to match the system clears both, so the page follows the system again.
   It also keeps <meta name="theme-color"> on the current --bg and names the button after what it will do.

   Hooks for pages: a "sitetheme" event on document ({ detail: { theme, following } }) after each switch,
   window.siteTheme.get() for the scheme in effect, and data-track="<area>" on the button to record the switch
   as siteTrack('<area>/theme/<scheme>') (default area: none, so the event is "theme/<scheme>"). */
(() => {
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const store = {
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: not remembered */ } },
  };
  const system = () => (mq.matches ? 'dark' : 'light');
  const current = () => root.dataset.theme || system();
  const calm = () => root.classList.contains('motion-paused') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sync() {
    const t = current(), following = !root.dataset.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (meta && bg) meta.setAttribute('content', bg);
    const label = t === 'dark' ? 'Switch to Daybreak (light) scheme' : 'Switch to Deep Space (dark) scheme';
    document.querySelectorAll('.md-theme').forEach(b => {
      b.setAttribute('aria-label', label);
      b.title = label + (following ? ' (following your system)' : '');
    });
  }

  function set(next, btn) {
    if (next === system()) { delete root.dataset.theme; store.set('theme', ''); }
    else { root.dataset.theme = next; store.set('theme', next); }
    if (!calm()) {
      root.classList.add('md-theme-anim');
      setTimeout(() => root.classList.remove('md-theme-anim'), 700);
    }
    sync();
    const area = btn && btn.dataset.track;
    try { if (window.siteTrack) window.siteTrack((area ? area + '/' : '') + 'theme/' + next, 'Color scheme switched'); } catch (e) { /* analytics is optional */ }
    document.dispatchEvent(new CustomEvent('sitetheme', { detail: { theme: next, following: !root.dataset.theme } }));
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.md-theme');
    if (btn) set(current() === 'dark' ? 'light' : 'dark', btn);
  });
  if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync);
  window.siteTheme = { get: current, set: t => set(t === 'dark' ? 'dark' : 'light') };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
