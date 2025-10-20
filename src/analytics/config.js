export const BASE_ENDPOINT = 'https://api.mock-analytics.com/smhl/outer/browser/web/track';
export const PROJECT_ID = 'h5-somatosensory';

export const EVENTS = Object.freeze({
  PAGE_VIEW: 'page_view',
  BANNER_CLICK: 'banner_click',
  BANNER_IMPRESSION: 'banner_impression',
  PAGE_GAME_IMPRESSION: 'page_game_impression',
  PAGE_GAME_CLICK: 'page_game_click',
  PAGE_SCROLL_DEPTH: 'page_scroll_depth',
  PAGE_MORE_CLICK: 'page_more_click',
  GAME_DETAIL_VIEW: 'game_detail_view',
  START_GAME_CLICK: 'start_game_click',
  CATEGORY_PAGE_VIEW: 'category_page_view',
  CATEGORY_CLICK: 'category_click',
  TOPIC_GAME_IMPRESSION: 'topic_game_impression',
  TOPIC_IMPRESSION: 'topic_impression',
  CATEGORY_GAME_CLICK: 'category_game_click',
  GAME_SESSION_END: 'game_session_end',
  PAYMENT_POPUP_VIEW: 'payment_popup_view',
  PAYMENT_POPUP_CLICK: 'payment_popup_click',
  PAYMENT_SUCCESS: 'payment_success',
});

export const DEFAULT_CONTEXT = Object.freeze({
  platform: 'app',
  language: 'zh-CN',
  versionLanguage: 'zh',
  country: 'CN',
  os: 'other',
  deviceModel: '',
  networkType: '',
  appVersion: '1.0.0',
  isMember: false,
  freePlayDuration: 0,
  entrySource: 'unknown',
  watchState: false,
  pageUrl: '',
});

export const FLUSH_POLICY = Object.freeze({
  MAX_BATCH_SIZE: 10,
  MAX_WAITING_MS: 5000,
});

export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
