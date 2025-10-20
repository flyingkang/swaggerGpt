# Analytics SDK Integration Guide

This page summarises how the index page collects analytics data and how host
applications (including WebViews embedded in native clients) can provide the
required context parameters.

## Lifecycle overview

The `pages/index/index.vue` component initialises analytics during the
[`onLoad`](../pages/index/index.vue) lifecycle hook. It collects device
information via `uni.getSystemInfoSync`, enriches it with contextual data
provided by the host application, and then updates the tracker context via
`tracker.updateContext(...)`.

While the page is visible, the component tracks the following key events:

- `page_view` — emitted once per visit when the page is hidden or unloaded and
  includes the stay duration in seconds.
- `page_scroll_depth` — emitted when the user scrolls past 25%, 50%, 75% and
  100% of the content height.
- `page_banner_click` — emitted when a banner is tapped.
- `page_game_click` — emitted when a game card is tapped.

## Providing context parameters

The page expects analytics parameters via the `options` argument of
`onLoad(options)`. When the page is opened as a WebView inside a native client,
these options can be supplied as standard query parameters in the WebView URL,
for example:

```
https://browserdev.hoorooplay.com/index?userId=123&platform=ios&isMember=true
```

During `onLoad`, the component normalises the incoming values to ensure the
analytics context is consistent even when everything is provided as strings. It
also recognises both camelCase (`userId`) and snake_case (`user_id`) parameter
names so that different host platforms can reuse the same entry point without
extra mapping.

### Supported parameters

| Parameter             | Type      | Default                       | Notes                                           |
| --------------------- | --------- | ----------------------------- | ----------------------------------------------- |
| `userId` / `user_id`  | string    | `""`                          | Optional user identifier.                       |
| `pageUrl` / `url`     | string    | `https://browserdev.hoorooplay.com` | URL recorded for the page view.                 |
| `platform`            | string    | `"app"`                       | Host platform identifier (e.g. `ios`, `android`). |
| `versionLanguage` / `version_language` | string | `"zh"`           | Localised build version.                        |
| `country`             | string    | `"CN"`                        | Country/region code.                            |
| `appVersion` / `app_version` | string | `"1.0.0"`                 | Host app version string.                        |
| `isMember` / `is_member` | boolean/string | `false`              | Membership flag. Accepts `true`/`false` strings.|
| `freePlayDuration` / `free_play_duration` | number/string | `0` | Free play minutes remaining.                  |
| `entrySource` / `entry_source` | string | `"unknown"`             | Where the user came from.                       |
| `watchState` / `watch_state` | boolean/string | `false`            | Whether the user is in watch mode.              |

Any values not supplied default to the values shown in the table. The boolean
parameters accept native booleans or case-insensitive string literals `"true"`
/ `"false"`. Numeric parameters are converted with `Number(...)` and fall back
to `0` when parsing fails.

## Handling network information

Network type is resolved asynchronously via `uni.getNetworkType`. If the API is
not available or it fails, the context records `"unknown"` so that the page can
still load without crashing.

## Ensuring single stay-duration events

Stay duration is reported once per visit by guarding `reportStayDuration()`
with the `hasReportedStayDuration` flag. The flag resets in both `onLoad` and
`onShow`, ensuring each foreground session produces exactly one
`page_view` event even when the page is reopened from the background.
