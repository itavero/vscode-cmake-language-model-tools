# Change Log

All notable changes to the "cmake-language-model-tools" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Initial implementation of the following tools (thanks to Copilot for the help):
  - `get_cmake_project_info` - Returns comprehensive project information including source/build directories and targets with types
  - `get_cmake_cache_variable` - Retrieves a single value from the CMake cache
  - `get_cmake_cache` - Retrieves the entire contents of the CMake cache
  - `get_active_cmake_build_type` - Retrieves the currently selected build type
  - `build_cmake_target` - Builds specified CMake targets
  - `configure_cmake_project` - Configures/reconfigures the CMake project
  - `find_cmake_build_target_containing_file` - Finds CMake targets that contain or can access a specific file through source files or include directories
