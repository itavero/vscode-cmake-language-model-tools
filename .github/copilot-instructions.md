# Copilot instructions

This project aims to provide Visual Studio Code extension which uses the Language Model Tools API to provide tools that Copilot can use to interact with the CMake Tools extension.

In essence, it glues the CMake Tools API (which is a public API that the CMake Tools extension provides) to the Language Model Tools API (which is a public API that Copilot provides).
The CMake Tools API is described in the `vscode-cmake-tools` package, which you should be able to find in `node_modules/vscode-cmake-tools/out/api.d.ts`.

We use a CMake test project for running the tests, which is located in the `example` directory.

The extension itself is written in TypeScript and we use npm scripts to build and test the extension:

- Build: `npm run compile`
- Lint: `npm run lint`
- Test: `npm run test`

Note: as can be seen in the `package.json`, as a pre-test step both building and linting are run.
This means you can run `npm test` to build, lint and run the tests in one go.

When running tests in a headless environment (such as in CI or when not running in Agent mode in VS Code), you can use `xvfb` to provide a virtual display. If xvfb is available, you can run tests using:
`xvfb-run --auto-servernum npm test`
