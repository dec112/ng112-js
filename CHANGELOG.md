# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased
---
## Unreleased - [2.0.0]
### Changed
- **BREAKING**: `JsSIP` is no longer a direct dependency, but a peer dependency of `ng112-js`. \
This is due to the added compatibility with `sip.js`. \
You can now can choose which SIP library they want to use. \
The new property `sipAdapterFactory` has been introduced on `Agent`. \
You need to pass a factory function that returns an appropriate SIP adapter. \
This also means you can write your own adapter and use any SIP library of your choice in combination with ng112-js. \
`JsSIP` and `SIP.js` are supported by default. Examples can be found under `./example/snippets/`.
- **BREAKING**: New object for message send errors: `MessageError` instead of former object `MessageFailedEvent` \
Object has different properties!
- **BREAKING**: `DEC112Specifics` constructor uses object `DEC112Config` instead of individual parameters for initialization.
- **BREAKING**: Updating `Agent`'s heartbeat interval with invalid values will not result in an exception, but will rather log an error message.
- **BREAKING**: `Agent`'s `debug` is now an object. This way, separate log-levels and handlers for in-library log messages and log messages created by the SIP adapter can be specified.
- Improved build process, enabling better tree shaking for dependency `pidf-lo`.
### Added
- Agent mode that can be used to indicate an app is running in the background.
- Support for DIDs.
- Support for binaries.
- Support for parsing extra multiparts.
- Support for History-Info header.
- Ability to remove message listeners.

---

## [1.2.1] - 2021-06-03
### Added:
- Logging for heartbeat messages.
 
## [1.2.0] - 2021-05-29
### Added:
- BACKPORT [2.0.0]: Support for History-Info header.

## [1.1.0] - 2021-05-07
### Changed
- Fixed behaviour for incoming conversations, if no conversation listeners are registered. \
These incoming SIP messages will be dropped as they could lead to unexpected agent states, where a conversation is opened that was not expected.
### Added
- Missing export for `LogLevel`
- Boolean as possible value for `Agent`'s `debug` property for specifying verbose logging

## [1.0.0] - 2021-05-05
### Changed
- **BREAKING**: Renamed property `debugMode` to `debug` in `Agent` constructor. \
`debug` will now also accept a callback function that is called for all log messages. \
This allows for the connection of any other logging facility.
- **BREAKING**: Unified `Conversation`'s `start`, `stop` and `sendMessage` function. \
All of these functions now use the same arguments as `sendMessage` already did. \
This allows for the use of `extraParts`, `uris` and other properties for `start` and `stop` function calls.
- **BREAKING**: The agent's `conversation` property contains only calls that are not in state `STOPPED`. \
Once calls are stopped they are removed from this list. \
This should limit memory consumption if ng112-js is used in long running applications with heavy load.
- The agent's `conversation` property only contains open calls. Stopped calls are removed from this list. \
`debug` will now also accept a callback function that is called for all log messages. \
This allows for the connection of any other logging facility.
### Added
- Property `uniqueId` in messages that is unique across all messages and conversations within ng112-js
- Auto-close of open calls on agent disposal
- Configurable grace period for agent disposal
- More detailled logging on message errors.
- More extensive VCard tests

---

## [0.11.21] - 2021-04-24
### Added
- Missing export for `AgentState`

## [0.11.19] - 2021-04-19
### Added
- JsSIP version in UserAgent string
- Expose package version

## [0.11.18] - 2021-04-18
### Fixed
- Fixed heartbeat for continued conversations

## [0.11.17] - 2021-04-18
### Fixed
- Unfixed version for JsSIP. Bug with Expo was fixed in version 3.7.3

## [0.11.16] - 2021-04-17
### Fixed
- DEC112 language header

## [0.11.15] - 2021-04-16
### Added
- TypeDoc for VCard helper methods
- TypeDoc for DEC112Specifics
- Handling of unknown VCard elements
- Updated README

## [0.11.14] - 2021-04-02
### Added
- Ability to send custom MIME parts

## [0.11.13] - 2021-04-02
### Fixed
- VCard's XML implementation. DOM standard (used by `xmldom`) uses only supports `childNodes` not `children`

## [0.11.12] - 2021-04-01
### Added
- Note in VCards

## [0.11.11] - 2021-03-30
### Fixed
- Typo in agent's `setHeartbeatInterval`

## [0.11.10] - 2021-03-29
### Fixed
- Heartbeat can also be enabled/disabled/updated while a conversation is already ongoing

## [0.11.9] - 2021-03-29
### Changed
- Less restrictive heartbeat interval settings
### Added
- Ability to call `setHeartbeatInterval` without parameter, thus resetting it to the default value

## [0.11.8] - 2021-03-18
### Fixed
- Fixed jssip version to 3.5.11. This is due to an incompatibility of JsSIP 3.7.3 with Expo.

## [0.11.7] - 2021-03-17
### Changed
- Only send location updates if they are really updated on DEC112 environments
### Fixed
- Correct multipart message if no multiparts are available

## [0.11.6] - 2021-03-17
### Fixed
- More resilient handling of invalid SimpleLocations

## [0.11.5] - 2021-03-16
### Changed
- Always send location updates on DEC112 environments
### Added
- Optionally load jssip-node-websocket, if available, on node environments
### Fixed
- Send empty multipart body if no changes to location or VCard happened and if text and URIs are empty

## [0.11.4] - 2021-03-16
### Added
- Export for `MessageState`

## [0.11.3] - 2021-03-16
### Fixed
- Included `jssip-node-websocket` as peer dependency and re-enabled differentiation for websocket implementation (node vs. browser)

## [0.11.2] - 2021-03-15
### Fixed
- Unhandled promise error while messages with invalid location or VCard

## [0.11.1] - 2021-03-15
### Fixed
- JsSIP version in user agent 

## [0.11.0] - 2021-03-15
### Removed
- Legacy PIDF-LO support for DEC112 environments
### Changed
- BREAKING CHANGE: MessageOrigin renamed to Origin
- BREAKING CHANGE: Conversation state is reflected by a new object rather than `ConversationState` alone (introduces new interface `StateObject`)
- Empty text message is sent in Multipart MIME body if no other part is specified
### Added
- Agent states and listener for agent states
- Message states
- Origin to conversation states
- Support for remote display name
- Support for only sending updated location or VCard information
- Custom ng112-js user agent
### Fixed
- Agent disposal
- Heartbeats stopping a conversation