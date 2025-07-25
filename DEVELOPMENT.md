# Development Guide

## Development

### Setting up the Development Environment

1. Clone this repository
2. Run `npm install` to install dependencies
3. Open in VS Code
4. Press `F5` to run the extension in a new Extension Development Host window

### Testing

Run the tests with:

```bash
npm test
```

This will compile the extension and run the test suite in a VS Code test environment.

### Building

To compile the TypeScript:

```bash
npm run compile
```

To watch for changes during development:

```bash
npm run watch
```

### Architecture

The extension provides language model tools by:

1. **Extension Activation**: Activates when CMakeLists.txt is detected in the workspace
2. **CMake Tools Integration**: Uses the CMake Tools extension API to access project information
3. **Tool Registration**: Registers language model tools with VS Code using `vscode.lm.registerTool`
4. **Tool Implementation**: Each tool interacts with the CMake Tools API or reads CMake cache files directly

### Tool Implementation Details

- **get_cmake_build_directory**: Uses `project.getBuildDirectory()` from CMake Tools API
- **get_cmake_cache_variable**: Reads and parses CMakeCache.txt file, can list all variables or return a specific one
- **get_cmake_targets**: Uses `project.getCodeModel()` from CMake Tools API to get target information  
- **build_cmake_target**: Uses `project.build()` from CMake Tools API

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Notes to self

More info on CI and automating the release from CI: <https://medium.com/@shaimendel/vs-code-extension-auto-ci-cd-in-github-actions-4f17cf61f7f7>
