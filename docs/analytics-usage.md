# Analytics SDK Integration Guide

This page summarises how the index page collects analytics data and how host
applications (including WebViews embedded in native clients) can provide the
required context parameters.

## Lifecycle overview

`App.vue` normalises analytics context as soon as the application launches (and
every time it returns to the foreground). It inspects the launch `options`,
decodes any query parameters appended to the WebView URL, merges them with the
last saved tracker context, and persists the result via
`tracker.updateContext(...)`. This ensures that shared parameters—such as the
user identifier, membership flag, and device metadata—are always present before
any page sends events.

The `pages/index/index.vue` component re-runs the normalisation during its
[`onLoad`](../pages/index/index.vue) hook so that page-specific information
(for example the exact `pageUrl` after navigation) is captured and any new
query parameters are stored immediately.

While the page is visible, the component tracks the following key events:

- `page_view` — emitted once per visit when the page is hidden or unloaded and
  includes the stay duration in seconds.
- `page_scroll_depth` — emitted when the user scrolls past 25%, 50%, 75% and
  100% of the content height.
- `page_banner_click` — emitted when a banner is tapped.
- `page_game_click` — emitted when a game card is tapped.
- `banner_impression` — emitted once when a banner is at least 50% visible in the viewport.
- `topic_impression` — emitted once when a topic module becomes visible (requires elements with the `.topic-item` selector).

### Impression instrumentation

Banner containers must expose a `data-banner-id` attribute so that
`banner_impression` events include the `page_banner_id` dimension.
Topic modules should use the `.topic-item` selector and provide a
`data-topic-id` attribute. The component automatically wires
intersection observers for these selectors and sends each impression only
once per foreground session, always including the current `page_name` in
the payload.

## Providing context parameters

Analytics parameters are accepted via WebView query parameters. Both
`App.vue` (during `onLaunch`/`onShow`) and `pages/index/index.vue` (during
`onLoad`) read the same values so the context is updated even if only one of
these lifecycle hooks runs with a full query payload. When the page is opened
inside a native client, parameters can be supplied as standard query parameters
in the WebView URL, for example:
https://browserdev.hoorooplay.com/index?userId=123&platform=ios&isMember=true

During `onLoad`, the component normalises the incoming values to ensure the
analytics context is consistent even when everything is provided as strings. It
also recognises both camelCase (`userId`) and snake_case (`user_id`) parameter
names so that different host platforms can reuse the same entry point without
extra mapping. The `userId` may also be provided as `smSubId`, matching the
existing client contract.

### Supported parameters

| Parameter             | Type      | Default                       | Notes                                           |
| --------------------- | --------- | ----------------------------- | ----------------------------------------------- |
| `userId` / `user_id` / `smSubId` | string | generated fallback | Optional user identifier supplied by the client. |
| `pageUrl` / `url`     | string    | `https://browserdev.hoorooplay.com` | URL recorded for the page view.                 |
| `platform`            | string    | `"app"`                       | Host platform identifier (e.g. `ios`, `android`). |
| `versionLanguage` / `version_language` | string | `"zh"`           | Localised build version.                        |
| `country`             | string    | `"CN"`                        | Country/region code.                            |
| `appVersion` / `app_version` | string | `"1.0.0"`                 | Host app version string.                        |
| `deviceModel`         | string    | `systemInfo.model`            | Device model supplied by the host.              |
| `networkType`         | string    | detected via `uni.getNetworkType` | Network type such as `Wi-Fi`, `4G`, or `5G`.   |
| `isMember` / `is_member` | boolean/string | `false`              | Membership flag. Accepts `true`/`false` strings.|
| `freePlayDuration` / `free_play_duration` | number/string | `0` | Free play minutes remaining.                  |
| `entrySource` / `entry_source` | string | `"unknown"`             | Where the user came from.                       |
| `watchState` / `watch_state` | boolean/string | `false`            | Whether the user's watch is connected.          |
| `memberType` / `member_type` | number/string  | derived from `isMember` | Explicit member type (0/1).               |

Any values not supplied default to the values shown in the table. The boolean
parameters accept native booleans or case-insensitive string literals `"true"`
/ `"false"`. Numeric parameters are converted with `Number(...)`; when parsing
fails the parameter is omitted so that existing values or defaults are reused.
When `userId` is not provided, the tracker synthesises an anonymous identifier
based on the current time and timezone and stores it for reuse.

All normalised parameters are saved in local storage so subsequent visits reuse
the last known context even if the WebView does not resend every field.

## Handling network information

If the host client passes `networkType`, that value takes precedence. Otherwise
the context resolver runs `uni.getNetworkType` asynchronously. If the API is
not available or it fails, the context records `"unknown"` so that the page can
still load without crashing. Because the context is initialised at the
application level, the detected value is shared across all events and pages.

## Event delivery API

Events are POSTed individually to `/smhl/outer/browser/web/track`. Each request
contains the merged context above plus the event-specific payload serialised as
`eventPara` (JSON string). Boolean flags such as `isMember` and `watchState` are
converted to `1`/`0` integers to match the server contract. The tracker keeps a
queue in storage and retries failed sends using the same endpoint, ensuring
reliability even when the device temporarily loses connectivity.

## Ensuring single stay-duration events

Stay duration is reported once per visit by guarding `reportStayDuration()`
with the `hasReportedStayDuration` flag. The flag resets in both `onLoad` and
`onShow`, ensuring each foreground session produces exactly one
`page_view` event even when the page is reopened from the background.

