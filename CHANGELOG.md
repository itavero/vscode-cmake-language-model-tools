# Change Log

All notable changes to the "cmake-language-model-tools" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Initial implementation of all planned CMake language model tools:
  - `get_cmake_build_directory` - Returns the build directory for the current CMake project
  - `get_cmake_cache_variable` - Retrieves a single value from the CMake cache
  - `get_cmake_cache` - Retrieves the entire contents of the CMake cache
  - `get_cmake_targets` - Retrieves CMake targets from the current project
  - `get_active_cmake_build_type` - Retrieves the currently selected build type
  - `build_cmake_target` - Builds specified CMake targets
- Integration with CMake Tools extension API
- Automatic activation when CMakeLists.txt is detected in workspace
- Comprehensive error handling and user feedback
- Support for input parameters where applicable
