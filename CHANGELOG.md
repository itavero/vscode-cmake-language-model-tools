# Change Log

All notable changes to the "cmake-language-model-tools" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Changed

- Enhanced `find_cmake_build_target_containing_file` tool to prioritize targets by type when multiple matches are found, preferring executable and library targets over utility targets

### Notes

Starting with this release, the VSIX is also available via the [Releases](https://github.com/itavero/vscode-cmake-language-model-tools/releases) section on the GitHub repository.

## [0.2.1] - 2025-08-06

### Fixed

- Improved logic to convert absolute paths to relative paths within the workspace. (see [#7](https://github.com/itavero/vscode-cmake-language-model-tools/issues/7))

## [0.2.0] - 2025-08-05

### Added

- Initial implementation of the following tools (thanks to Copilot for the help):
  - `get_cmake_project_info` - Returns comprehensive project information including source/build directories and targets with types
  - `get_cmake_cache_variable` - Retrieves a single value from the CMake cache
  - `get_cmake_cache` - Retrieves the entire contents of the CMake cache
  - `get_active_cmake_build_type` - Retrieves the currently selected build type
  - `build_cmake_target` - Builds specified CMake targets
  - `configure_cmake_project` - Configures/reconfigures the CMake project
  - `find_cmake_build_target_containing_file` - Finds CMake targets that contain or can access a specific file through source files or include directories
