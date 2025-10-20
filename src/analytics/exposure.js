import tracker from './tracker';
import { EVENTS } from './config';

const observedSelectors = new Map();

function observeExposure({
  vm,
  selector,
  pageName,
  eventName,
  minRatio = 0.5,
  getPayload,
  getCacheKey,
}) {
  if (!vm || !selector) {
    console.warn('observeExposure requires vm and selector');
    return null;
  }

  const observer = uni.createIntersectionObserver(vm, {
    thresholds: [minRatio],
  });

  observer.relativeToViewport().observe(selector, res => {
    const { intersectionRatio } = res;
    if (intersectionRatio < minRatio) {
      return;
    }

    const payload = typeof getPayload === 'function' ? getPayload(res) : {};
    if (!payload) {
      return;
    }

    const cacheKey =
      typeof getCacheKey === 'function'
        ? getCacheKey(res, payload)
        : `${selector}-${JSON.stringify(payload)}`;

    if (observedSelectors.has(cacheKey)) {
      return;
    }

    observedSelectors.set(cacheKey, true);
    tracker.track(eventName, {
      page_name: pageName,
      ...payload,
    });
  });

  return observer;
}

export function observeGameExposure(context) {
  const {
    vm,
    selector,
    pageName,
    section,
    impressionEvent = EVENTS.PAGE_GAME_IMPRESSION,
    minRatio = 0.5,
  } = context;

  return observeExposure({
    vm,
    selector,
    pageName,
    eventName: impressionEvent,
    minRatio,
    getPayload: res => {
      const {
        dataset: { gameId, position } = {},
      } = res;

      if (!gameId) {
        return null;
      }

      return {
        game_id: gameId,
        position,
        section,
      };
    },
    getCacheKey: (res, payload) => {
      const {
        dataset: { gameId, position } = {},
      } = res;
      return `${selector}-${gameId}-${position || ''}`;
    },
  });
}

export function observeBannerExposure({
  vm,
  selector = '.banner',
  pageName,
  minRatio = 0.5,
} = {}) {
  return observeExposure({
    vm,
    selector,
    pageName,
    eventName: EVENTS.BANNER_IMPRESSION,
    minRatio,
    getPayload: res => {
      const {
        dataset: { bannerId } = {},
      } = res;

      if (!bannerId) {
        return null;
      }

      return {
        page_banner_id: bannerId,
      };
    },
  });
}

export function observeTopicExposure({
  vm,
  selector = '.topic-item',
  pageName,
  minRatio = 0.5,
} = {}) {
  return observeExposure({
    vm,
    selector,
    pageName,
    eventName: EVENTS.TOPIC_IMPRESSION,
    minRatio,
    getPayload: res => {
      const {
        dataset: { topicId } = {},
      } = res;

      if (!topicId) {
        return null;
      }

      return {
        page_topic_id: topicId,
      };
    },
  });
}

export function resetExposureCache() {
  observedSelectors.clear();
}
