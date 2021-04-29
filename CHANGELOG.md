# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
## [Unreleased]
### Added
- Agent mode that can be used to indicate an app is running in the background
- Support for DIDs.
### Changed
- **BREAKING**: Renamed property `debugMode` to `debug` in `Agent` constructor. \
`debug` will also accept a callback function that is called for all log messages.

---

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