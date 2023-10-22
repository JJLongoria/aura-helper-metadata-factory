# Change Log
All notable changes to this project will be documented in this file.

## [2.1.5 - 2023-10-22]
### Fixed
- Fixed a little error in some cases when detecting chages in some Metadata Types like Assignment Rules.

## [2.1.1 - 2022-06-21]
### Fixed
- Fixed the Email template group problem when create metadata types from records.

## [2.1.0 - 2021-12-14]
### Added
- Better support to metadata api to get git changes from gitDiffs
- Prevent errors when XML are malformed.

## [2.0.0 - 2021-12-13]
### Added
- Changed to Typescript
- Added support to API 53.0
- Added support to Metadata API format

### Fixed
- Fix all minor errors


## [1.0.0 - 2021-09-18]
### Added
- Created class **Factory** to create Metadata JSON File from too many sources
- Added methods to created Metadata from Git Diffs, File System or Package file
- Added methods to deserialize a JSON file or JS Object into Metadata Types Objects
- Added method to create Metadata Details
- Added method to create a Metadata Folder map to link the file system folder with the metadata type