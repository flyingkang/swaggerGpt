const DEFAULTS = Object.freeze({
  platform: 'app',
  versionLanguage: 'zh',
  country: 'CN',
  appVersion: '1.0.0',
  entrySource: 'unknown',
});

function decodeValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (['1', 'true', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildUrlFromOptions(rawOptions = {}, fallbackUrl = '') {
  if (typeof window !== 'undefined' && window.location && window.location.href) {
    return window.location.href;
  }

  const path = rawOptions.path || rawOptions.page || '';
  const query = rawOptions.query || rawOptions;
  const queryKeys = Object.keys(query || {}).filter(key =>
    !['path', 'page', 'query'].includes(key)
  );

  if (!path && !fallbackUrl) {
    return '';
  }

  if (!queryKeys.length) {
    return path || fallbackUrl;
  }

  const queryString = queryKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');
  return `${path}?${queryString}`;
}

async function detectNetworkType() {
  if (typeof uni === 'undefined' || typeof uni.getNetworkType !== 'function') {
    return 'unknown';
  }

  return new Promise(resolve => {
    uni.getNetworkType({
      success: res => resolve(res.networkType || 'unknown'),
      fail: () => resolve('unknown'),
    });
  });
}

export async function buildAnalyticsContext(rawOptions = {}, config = {}) {
  const {
    systemInfo = {},
    existingContext = {},
    currentUrl = '',
    networkDetector,
  } = config;

  const merged = { ...existingContext };

  const assignments = {
    userId:
      rawOptions.userId ||
      rawOptions.user_id ||
      rawOptions.smSubId ||
      rawOptions.sm_sub_id,
    pageUrl: decodeValue(
      rawOptions.pageUrl || rawOptions.url || currentUrl || existingContext.pageUrl || ''
    ),
    platform: rawOptions.platform,
    versionLanguage: rawOptions.versionLanguage || rawOptions.version_language,
    country: rawOptions.country,
    appVersion: rawOptions.appVersion || rawOptions.app_version,
    isMember: parseBoolean(rawOptions.isMember ?? rawOptions.is_member),
    freePlayDuration: parseNumber(
      rawOptions.freePlayDuration ?? rawOptions.free_play_duration
    ),
    entrySource: rawOptions.entrySource || rawOptions.entry_source,
    watchState: parseBoolean(rawOptions.watchState ?? rawOptions.watch_state),
    networkType: rawOptions.networkType || rawOptions.network_type,
    deviceModel: rawOptions.deviceModel || rawOptions.device_model,
    language: rawOptions.language,
    os: rawOptions.os,
    memberType: parseNumber(rawOptions.memberType ?? rawOptions.member_type),
  };

  Object.keys(assignments).forEach(key => {
    const value = assignments[key];
    if (value !== undefined && value !== null && value !== '') {
      merged[key] = value;
    }
  });

  Object.keys(DEFAULTS).forEach(key => {
    if (!merged[key]) {
      merged[key] = DEFAULTS[key];
    }
  });

  if (typeof merged.isMember === 'undefined') {
    merged.isMember = false;
  }

  if (typeof merged.freePlayDuration === 'undefined') {
    merged.freePlayDuration = 0;
  }

  if (!merged.language && systemInfo.language) {
    merged.language = systemInfo.language;
  }

  if (!merged.os && systemInfo.platform) {
    merged.os = systemInfo.platform;
  }

  if (!merged.deviceModel && systemInfo.model) {
    merged.deviceModel = systemInfo.model;
  }

  if (typeof merged.watchState === 'undefined') {
    merged.watchState = false;
  }

  if (!merged.pageUrl) {
    merged.pageUrl = buildUrlFromOptions(rawOptions, currentUrl);
  }

  if (!merged.networkType) {
    const detector = networkDetector || detectNetworkType;
    merged.networkType = await detector();
  }

  if (!merged.pageUrl) {
    merged.pageUrl = 'https://browserdev.hoorooplay.com';
  }

  return merged;
}

export { parseBoolean, parseNumber, decodeValue, detectNetworkType, buildUrlFromOptions };
