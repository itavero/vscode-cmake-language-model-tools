# CMake Language Model Tools

This Visual Studio Code extension provides language model tools to allow Copilot to interact with the [CMake Tools extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools).

## Work in progress

Still a work in progress. Just setting things up to get started.

## Provided tools

Below is a list of language model tools that are provided by this extension (or planned to be provided in the future).

### `#get_cmake_build_directory`

> State: Just an idea (not implemented yet)

This tool returns the build directory for the current CMake project. It is useful for understanding where the build artifacts are located.

### `#get_cmake_cache_variable`

> State: Just an idea (not implemented yet)

This tool retrieves a single value from the CMake cache. It is useful for getting configuration values that are kept in the CMake cache.

### `#get_cmake_cache`

> State: Just an idea (not implemented yet)

This tool retrieves the entire contents of the CMake cache.

### `#get_cmake_targets`

> State: Just an idea (not implemented yet)

This tool retrieves one or more CMake targets from the current project (or all if none specified).
It describes their type, source directory, artifacts, and other relevant information.

### `#get_active_cmake_build_type`

> State: Just an idea (not implemented yet)

This tool retrieves the CMake build type that is currently selected (e.g., Debug, Release).

### `#build_cmake_target`

> State: Just an idea (not implemented yet)

This tool builds the specified CMake target (or all targets if none is specified).
