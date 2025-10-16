import tracker from './tracker';
import { EVENTS } from './config';

const observedSelectors = new Map();

export function observeGameExposure(context) {
  const {
    vm,
    selector,
    pageName,
    section,
    impressionEvent = EVENTS.PAGE_GAME_IMPRESSION,
    minRatio = 0.5,
  } = context;

  if (!vm || !selector) {
    console.warn('observeGameExposure requires vm and selector');
    return null;
  }

  const observer = uni.createIntersectionObserver(vm, {
    thresholds: [minRatio],
  });

  observer.relativeToViewport().observe(selector, res => {
    const {
      intersectionRatio,
      dataset: { gameId, position },
    } = res;
    if (intersectionRatio >= minRatio && gameId) {
      const key = `${selector}-${gameId}-${position}`;
      if (observedSelectors.has(key)) return;
      observedSelectors.set(key, true);
      tracker.track(impressionEvent, {
        page_name: pageName,
        game_id: gameId,
        position,
        section,
      });
    }
  });

  return observer;
}

export function resetExposureCache() {
  observedSelectors.clear();
}
