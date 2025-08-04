# CMake Language Model Tools

This Visual Studio Code extension provides language model tools to allow Copilot to interact with the [CMake Tools extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools).

## Features

This extension provides several language model tools that enable Copilot to access CMake project information and perform build operations. These tools work with the CMake Tools extension to provide a seamless experience.

## Provided tools

Below is a list of language model tools that are provided by this extension.

### `#get_cmake_build_directory`

> State: ✅ **Implemented**

This tool returns the build directory for the current CMake project. It is useful for understanding where the build artifacts are located. Especially useful if you have multiple configurations with different build directories, and you want to know which one is currently active.

### `#get_cmake_cache_variable`

> State: ✅ **Implemented**

This tool retrieves one or more values from the CMake cache. It supports exact name matching, wildcard (`*`) searches, or listing all variables when no parameter is provided. It is useful for getting configuration values that are kept in the CMake cache.

**Parameters:**

- `variableName` (optional): The name of the CMake cache variable to retrieve. This can be an exact name or a pattern containing a wildcard (`*`). If not specified, returns a list of all cache variables.

### `#get_cmake_targets`

> State: ✅ **Implemented**

This tool retrieves one or more CMake targets from the current project (or all if none specified).
It describes their type, source directory, artifacts, and other relevant information.

**Parameters:**

- `targetNames` (optional): Array of specific target names to retrieve. If not specified, returns all targets.

### `#build_cmake_target`

> State: ✅ **Implemented**

This tool builds the specified CMake target (or all targets if none is specified).

**Parameters:**

- `targets` (optional): Array of target names to build. If not specified, builds all targets.

## Requirements

- VS Code 1.102.0 or later
- [CMake Tools extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools)
- A workspace with a CMake project (containing CMakeLists.txt)

## Usage

Once installed, the language model tools will be automatically available when you have a CMake project open. You can reference these tools in Copilot Chat using the `#` syntax (e.g., `#get_cmake_targets`).

The extension automatically activates when it detects a CMakeLists.txt file in your workspace.
Of course, it will only provide real data as soon as the CMake Tools extension has configured the project and can provide the necessary information.

## Example Usage

- "Show me the CMake build directory" → Uses `#get_cmake_build_directory`
- "What targets are available in this project?" → Uses `#get_cmake_targets`
- "Get the value of CMAKE_BUILD_TYPE from the cache" → Uses `#get_cmake_cache_variable`
- "Build the main target" → Uses `#build_cmake_target`

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
