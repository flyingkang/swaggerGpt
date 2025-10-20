import { getStorage, setStorage } from './storage';
import {
  BASE_ENDPOINT,
  PROJECT_ID,
  DEFAULT_CONTEXT,
  FLUSH_POLICY,
  SESSION_TIMEOUT,
} from './config';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Tracker {
  constructor(options = {}) {
    this.projectId = options.projectId || PROJECT_ID;
    this.endpoint = options.endpoint || BASE_ENDPOINT;
    this.contextKey = options.contextKey || 'tracker_persistent_context';
    const cachedContext = getStorage(this.contextKey) || {};
    this.context = {
      ...DEFAULT_CONTEXT,
      ...cachedContext,
      ...(options.context || {}),
    };
    this.queue = [];
    this.flushTimer = null;
    this.sessionKey = options.sessionKey || 'tracker_session_info';
    this.initSession();
  }

  initSession() {
    const now = Date.now();
    const cached = getStorage(this.sessionKey);
    if (cached && cached.sessionId && now - cached.lastActive < SESSION_TIMEOUT) {
      this.sessionId = cached.sessionId;
    } else {
      this.sessionId = generateUUID();
    }
    this.persistSession(now);
  }

  persistSession(lastActive) {
    setStorage(this.sessionKey, {
      sessionId: this.sessionId,
      lastActive,
    });
  }

  touchSession() {
    this.persistSession(Date.now());
  }

  updateContext(extra = {}) {
    this.context = { ...this.context, ...extra };
    this.persistContext();
  }

  getContext() {
    return { ...this.context };
  }

  track(eventName, payload = {}) {
    const event = {
      eventName,
      eventTime: Date.now(),
      sessionId: this.sessionId,
      projectId: this.projectId,
      context: this.getContext(),
      payload,
    };
    this.queue.push(event);
    this.touchSession();
    this.scheduleFlush();
    return event;
  }

  scheduleFlush() {
    if (this.queue.length >= FLUSH_POLICY.MAX_BATCH_SIZE) {
      this.flush(true);
      return;
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush(true);
    }, FLUSH_POLICY.MAX_WAITING_MS);
  }

  flush(force = false) {
    if (!force && this.queue.length === 0) return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return;

    batch.forEach(event => {
      this.dispatchEvent(event);
    });
  }

  resetSession() {
    this.sessionId = generateUUID();
    this.persistSession(Date.now());
  }

  persistContext() {
    setStorage(this.contextKey, this.context);
  }

  ensureUserId() {
    if (!this.context.userId) {
      const hasIntl = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';
      const timezone = hasIntl
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        : 'UTC';
      this.context.userId = `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}-${timezone}`;
      this.persistContext();
    }
    return this.context.userId;
  }

  dispatchEvent(event) {
    const payload = this.buildRequestPayload(event);
    uni.request({
      url: this.endpoint,
      method: 'POST',
      data: payload,
      success: () => {},
      fail: () => {
        this.queue.unshift(event);
        this.scheduleFlush();
      },
      complete: () => {
        this.flushTimer = null;
      },
    });
  }

  buildRequestPayload(event) {
    const {
      eventName,
      eventTime,
      sessionId,
      context = {},
      payload = {},
    } = event;

    const {
      userId,
      appVersion,
      country,
      deviceModel,
      entrySource,
      freePlayDuration,
      language,
      networkType,
      os,
      pageUrl,
      platform,
      versionLanguage,
      watchState,
      memberType,
      isMember,
    } = context;

    const resolveBoolean = value => {
      if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
      if (typeof value === 'number') {
        return value ? 1 : 0;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'y'].includes(normalized)) {
          return 1;
        }
      }
      return 0;
    };

    const toInteger = value => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      userId: userId || this.ensureUserId(),
      appVersion: appVersion,
      country,
      deviceModel,
      entrySource,
      eventName,
      eventPara: JSON.stringify(payload || {}),
      eventTime,
      freePlayDuration: toInteger(freePlayDuration),
      language,
      memberType:
        typeof memberType !== 'undefined'
          ? toInteger(memberType)
          : resolveBoolean(isMember),
      networkType,
      os,
      pageUrl,
      platform,
      sessionId,
      versionLanguage,
      watchState:
        typeof watchState === 'number'
          ? toInteger(watchState)
          : resolveBoolean(watchState),
    };
  }
}

const trackerSingleton = new Tracker();
export default trackerSingleton;
