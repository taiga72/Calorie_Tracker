/**
 * Lets the phone's back button / back-swipe close the open sheet instead of
 * leaving the app: each open sheet adds a browser history entry, and going
 * back closes the top one. Closing a sheet any other way (X, swipe down,
 * Escape) takes its entry back off.
 *
 * history.back() is asynchronous, so a sheet opening right after another
 * closed (e.g. search → day view) waits for that back step to land before
 * adding its own entry — otherwise the back step would remove the new one.
 */

const KEY = '__sheet';
let pendingBacks = 0;
let waiting: (() => void)[] = [];
let listening = false;
let seq = 0;

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', () => {
    if (pendingBacks === 0) return;
    pendingBacks--;
    if (pendingBacks === 0) {
      const run = waiting;
      waiting = [];
      run.forEach((f) => f());
    }
  });
}

function currentSheet(): number | undefined {
  const state = window.history.state as Record<string, unknown> | null;
  return typeof state?.[KEY] === 'number' ? (state[KEY] as number) : undefined;
}

/**
 * Call when a sheet opens; `onBack` runs if the user goes back while it's on
 * top. Returns the cleanup to call when it closes (for any reason).
 */
export function trackSheet(onBack: () => void): () => void {
  if (typeof window === 'undefined' || !window.history?.pushState) return () => {};
  ensureListener();
  const id = ++seq;
  let pushed = false;
  let closedByBack = false;
  let cancelled = false;

  const onPop = () => {
    // Our entry is gone (the user went back past it): close.
    if (pushed && !closedByBack && currentSheet() !== id && !isBelow(id)) {
      closedByBack = true;
      onBack();
    }
  };
  const push = () => {
    if (cancelled) return;
    window.history.pushState({ ...(window.history.state ?? {}), [KEY]: id }, '');
    pushed = true;
    window.addEventListener('popstate', onPop);
  };
  if (pendingBacks > 0) waiting.push(push);
  else push();

  return () => {
    cancelled = true;
    window.removeEventListener('popstate', onPop);
    if (pushed && !closedByBack && currentSheet() === id) {
      pendingBacks++;
      window.history.back();
    }
  };
}

// Sheets stack: a sheet opened on top of this one has a higher id, so while
// the current entry belongs to a later sheet, this one is still open below it.
function isBelow(id: number): boolean {
  const top = currentSheet();
  return top !== undefined && top > id;
}
