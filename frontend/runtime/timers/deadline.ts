// A timer that is computed from timestamps, not from counting ticks (SDD 7.7, 9.6 "TimerSource"). Browsers throttle or
// pause timers in background tabs; a worker who returns to a tab must find an overdue deadline fired, not still waiting.
// When the tab becomes visible again, an overdue deadline fires immediately.
export function startDeadline(ms: number, callback: () => void, now: () => number = Date.now): () => void {
  const due = now() + ms;
  let done = false;

  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    callback();
  };
  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && now() >= due) fire();
  };
  const handle = setTimeout(fire, ms);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

  function cleanup() {
    clearTimeout(handle);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
  }
  return () => {
    done = true;
    cleanup();
  };
}
