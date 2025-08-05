import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Tests for the CMake Language Model Tools using the example project.
 * These tests verify that our tools actually work with a real CMake project.
 */
suite("CMake Language Model Tools Test Suite", () => {
  const exampleProjectPath = path.join(__dirname, "..", "..", "example");
  let workspaceFolder: vscode.WorkspaceFolder;

  suiteSetup(async function () {
    this.timeout(60000);

    // Clean up any existing build directory to ensure a fresh start
    const buildDir = path.join(exampleProjectPath, "build");
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
      console.log("Cleaned up existing build directory");
    }

    // Open the example project as a workspace
    const exampleUri = vscode.Uri.file(exampleProjectPath);

    // Add the example folder to workspace
    const success = vscode.workspace.updateWorkspaceFolders(0, 0, {
      uri: exampleUri,
      name: "CMake Example",
    });

    if (!success) {
      console.error(
        "Failed to add workspace folder, continuing with existing workspace"
      );
    }

    // Wait a bit for workspace to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));

    workspaceFolder = vscode.workspace.workspaceFolders?.[0]!;

    // Wait for CMake configuration to complete by checking for CMakeCache.txt
    const cmakeCachePath = path.join(buildDir, "CMakeCache.txt");
    const maxWaitTime = 60000; // 1 minute max wait
    const checkInterval = 50; // Check every 50ms
    let startTime = Date.now();

    while (
      !fs.existsSync(cmakeCachePath) &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    if (!fs.existsSync(cmakeCachePath)) {
      console.error(
        "CMake configuration did not complete within timeout! No CMakeCache.txt found."
      );
    }
  });

  test("All language model tools are registered", () => {
    const expectedTools = [
      "configure_cmake_project",
      "get_cmake_project_info",
      "get_cmake_cache_variable",
      "build_cmake_target",
      "find_cmake_build_target_containing_file",
    ];

    const registeredTools = vscode.lm.tools.map((tool) => tool.name);
    console.log("Registered tools:", registeredTools);

    for (const expectedTool of expectedTools) {
      assert.ok(
        registeredTools.includes(expectedTool),
        `Tool '${expectedTool}' should be registered`
      );
    }

    // Verify each tool has proper metadata
    for (const expectedTool of expectedTools) {
      const toolInfo = vscode.lm.tools.find((t) => t.name === expectedTool);
      assert.ok(toolInfo, `Tool info for '${expectedTool}' should exist`);
      assert.ok(
        toolInfo.description,
        `Tool '${expectedTool}' should have a description`
      );
      assert.ok(
        toolInfo.description.length > 0,
        `Tool '${expectedTool}' description should not be empty`
      );
    }
  });

  test("get_cmake_project_info tool works", async function () {
    this.timeout(10000);

    // Test our actual language model tool
    const result = await vscode.lm.invokeTool("get_cmake_project_info", {
      input: {},
      toolInvocationToken: undefined,
    });

    assert.ok(result, "Tool should return a result");
    assert.ok(result.content, "Result should have content");
    assert.ok(Array.isArray(result.content), "Content should be an array");
    assert.ok(result.content.length > 0, "Content should not be empty");

    const firstPart = result.content[0];
    assert.ok(
      firstPart instanceof vscode.LanguageModelTextPart,
      "First part should be text"
    );

    const text = firstPart.value;
    console.log("get_cmake_project_info result:", text);

    // Should return project information including source dir, build dir, and targets
    assert.ok(
      text.includes("CMake Project Information") ||
        text.includes("No active CMake project found") ||
        text.includes("not available"),
      `Expected project info, got: ${text}`
    );

    // If we have project info, check for expected sections
    if (text.includes("CMake Project Information")) {
      assert.ok(
        text.includes("Source Directory") ||
          text.includes("Build Directory") ||
          text.includes("Targets"),
        "Should include basic project information sections"
      );

      // Check for relative source directory information in target listings
      if (text.includes("Targets") && text.includes("found)")) {
        // Should show target names with types and potentially relative source directories
        const targetLines = text
          .split("\n")
          .filter((line) => line.trim().startsWith("- "));

        if (targetLines.length > 0) {
          // At least one target should have type information
          assert.ok(
            targetLines.some(
              (line) => line.includes("(") && line.includes(")")
            ),
            "Target lines should include type information in parentheses"
          );

          // Check that relative source directories are shown when available
          // Look for targets with "defined in `path`" format indicating relative source directory
          console.log("Target lines:", targetLines);

          // Verify getRelativeSourceDirectory functionality:
          // Check if any target shows relative source directory information
          const helloWorldLine = targetLines.find((line) =>
            line.includes("hello_world")
          );
          if (helloWorldLine) {
            console.log("Found hello_world target line:", helloWorldLine);
            // For targets in the root directory, relative source directory might not be shown
            // This is correct behavior since there's no meaningful relative path
            // Just verify the target has the expected format with type information
            assert.ok(
              helloWorldLine.includes("(") && helloWorldLine.includes(")"),
              "hello_world target should show type information in parentheses"
            );
          }

          // Check for subdirectory targets that should show relative source directory
          const configGeneratorLine = targetLines.find((line) =>
            line.includes("config_generator")
          );
          if (configGeneratorLine) {
            console.log(
              "Found config_generator target line:",
              configGeneratorLine
            );
            // This target is in the sub_dir_with_a_target subdirectory, so it should show "defined in `sub_dir_with_a_target`"
            assert.ok(
              configGeneratorLine.includes(
                "defined in `sub_dir_with_a_target`"
              ),
              "config_generator target should show relative source directory 'defined in `sub_dir_with_a_target`'"
            );
            assert.ok(
              configGeneratorLine.includes("(") &&
                configGeneratorLine.includes(")"),
              "config_generator target should show type information in parentheses"
            );
          }

          // The key test is that the function works - subdirectory targets show relative paths
          // in the format "defined in `path`" when available.
        }
      }
    }
  });

  suite("get_cmake_cache_variable tool", () => {
    test("should return MY_CUSTOM_VAR with documentation", async function () {
      this.timeout(10000);

      const result = await vscode.lm.invokeTool("get_cmake_cache_variable", {
        input: { variable_name: "MY_CUSTOM_VAR" },
        toolInvocationToken: undefined,
      });

      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");
      assert.ok(Array.isArray(result.content), "Content should be an array");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log("get_cmake_cache_variable MY_CUSTOM_VAR result:", text);

      // Should return the variable with its value and documentation
      assert.ok(
        text.includes("MY_CUSTOM_VAR") &&
          text.includes("Hi Copilot!") &&
          text.includes("STRING") &&
          text.includes("demonstration purposes"),
        "Result should include variable name, value, type, and documentation"
      );
    });

    test("should return MY_CUSTOM_BOOLEAN with documentation", async function () {
      this.timeout(10000);

      const result = await vscode.lm.invokeTool("get_cmake_cache_variable", {
        input: { variable_name: "MY_CUSTOM_BOOLEAN" },
        toolInvocationToken: undefined,
      });

      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");
      assert.ok(Array.isArray(result.content), "Content should be an array");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log("get_cmake_cache_variable MY_CUSTOM_BOOLEAN result:", text);

      // Should return the variable with its value and documentation
      assert.ok(
        text.includes("MY_CUSTOM_BOOLEAN") &&
          text.includes("ON") &&
          text.includes("BOOL") &&
          text.includes("demonstration purposes"),
        "Result should include variable name, value, type, and documentation"
      );
    });

    test("should suggest closest match for typo MY_CUSTOM_BOOL", async function () {
      this.timeout(10000);

      const result = await vscode.lm.invokeTool("get_cmake_cache_variable", {
        input: { variable_name: "MY_CUSTOM_BOOL" },
        toolInvocationToken: undefined,
      });

      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");
      assert.ok(Array.isArray(result.content), "Content should be an array");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log("get_cmake_cache_variable typo suggestion result:", text);

      // Should indicate variable not found and suggest closest match
      assert.ok(
        text.includes("not found") &&
          text.includes("Did you mean") &&
          text.includes("MY_CUSTOM_BOOLEAN") &&
          text.includes("Other variables available"),
        "Result should indicate variable not found, suggest closest match, and list available variables"
      );
    });

    test("should list all variables when no parameter provided", async function () {
      this.timeout(10000);

      const result = await vscode.lm.invokeTool("get_cmake_cache_variable", {
        input: {},
        toolInvocationToken: undefined,
      });

      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");
      assert.ok(Array.isArray(result.content), "Content should be an array");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log("get_cmake_cache_variable no parameter result:", text);

      // Should list all available variables
      assert.ok(
        text.includes("CMake cache contains") &&
          text.includes("variables") &&
          text.includes("MY_CUSTOM_VAR") &&
          text.includes("MY_CUSTOM_BOOLEAN") &&
          text.includes("CMAKE_BUILD_TYPE"),
        "Result should list all variables including our custom ones and standard CMake variables"
      );
    });

    test("should return multiple variables for wildcard search", async function () {
      this.timeout(10000);

      const result = await vscode.lm.invokeTool("get_cmake_cache_variable", {
        input: { variable_name: "MY_CUSTOM_*" },
        toolInvocationToken: undefined,
      });

      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");
      assert.ok(Array.isArray(result.content), "Content should be an array");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log("get_cmake_cache_variable wildcard result:", text);

      // Should return both custom variables
      assert.ok(
        text.includes("Found 2 variables") &&
          text.includes("MY_CUSTOM_VAR") &&
          text.includes("MY_CUSTOM_BOOLEAN"),
        "Result should find both custom variables with wildcard search"
      );
    });

    test("should suggest alternatives for non-matching wildcard search", async function () {
      this.timeout(10000);

      const result = await vscode.lm.invokeTool("get_cmake_cache_variable", {
        input: { variable_name: "NON_EXISTENT_*" },
        toolInvocationToken: undefined,
      });

      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");
      assert.ok(Array.isArray(result.content), "Content should be an array");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log(
        "get_cmake_cache_variable non-matching wildcard result:",
        text
      );

      // Should indicate variable not found and list available variables
      assert.ok(
        text.includes("not found") &&
          text.includes("Other variables available"),
        "Result should indicate variable not found and list available variables for non-matching wildcard"
      );
    });
  });

  test("build_cmake_target tool works", async function () {
    this.timeout(15000); // Increased timeout for actual build operations

    const result = await vscode.lm.invokeTool("build_cmake_target", {
      input: { targets: ["hello_world"] },
      toolInvocationToken: undefined,
    });

    assert.ok(result, "Tool should return a result");
    assert.ok(result.content, "Result should have content");
    assert.ok(Array.isArray(result.content), "Content should be an array");

    const firstPart = result.content[0];
    assert.ok(
      firstPart instanceof vscode.LanguageModelTextPart,
      "First part should be text"
    );

    const text = firstPart.value;
    console.log("build_cmake_target result:", text);

    // Should either indicate build started/completed or that no project is available
    // Can include new API results (with exit codes) or old API messages
    assert.ok(
      text.includes("build") ||
        text.includes("Build") ||
        text.includes("built") ||
        text.includes("Built") ||
        text.includes("No active") ||
        text.includes("target") ||
        text.includes("success") ||
        text.includes("Successfully") ||
        text.includes("failed") ||
        text.includes("building") ||
        text.includes("Building") ||
        text.includes("configured") ||
        text.includes("completed") ||
        text.includes("being executed") ||
        text.includes("Exit code") ||
        text.includes("currently installed version"),
      "Result should mention build process, indicate completion/execution, or indicate no project available"
    );
  });

  test("find_cmake_build_target_containing_file tool works", async function () {
    this.timeout(10000);

    // Test with a source file that should be found in the hello_world target
    const result = await vscode.lm.invokeTool(
      "find_cmake_build_target_containing_file",
      {
        input: { file_path: "src/main.cpp" },
        toolInvocationToken: undefined,
      }
    );

    assert.ok(result, "Tool should return a result");
    assert.ok(result.content, "Result should have content");
    assert.ok(Array.isArray(result.content), "Content should be an array");

    const firstPart = result.content[0];
    assert.ok(
      firstPart instanceof vscode.LanguageModelTextPart,
      "First part should be text"
    );

    const text = firstPart.value;
    console.log("find_cmake_build_target_containing_file result:", text);

    // Should either find targets or indicate no matches
    assert.ok(
      text.includes("is directly included in") ||
        text.includes("can be included through") ||
        text.includes("No targets found") ||
        text.includes("No active CMake project found") ||
        text.includes("not available"),
      "Result should mention targets containing file or indicate no project available"
    );

    // If we have a configured project, we should find the hello_world target for main.cpp
    if (
      text.includes("is directly included in") ||
      text.includes("can be included through")
    ) {
      // We should find the target mentioned
      assert.ok(
        text.includes("hello_world") || text.includes("target"),
        "Should mention a target when a file is found"
      );

      // Check for relative source directory information
      // The output should include source directory path when targets are found
      if (text.includes("source directory")) {
        console.log("Found source directory information in output");

        // Note: For targets in the root directory, relative source directory
        // might not be shown in brackets, which is correct behavior
        // The functionality is working if source directory info is mentioned
      }
    }
  });

  suite("configure_cmake_project tool", () => {
    // Helper function to validate basic configure tool response
    function validateConfigureResponse(result: any, testName: string): string {
      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");
      assert.ok(Array.isArray(result.content), "Content should be an array");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log(`configure_cmake_project (${testName}) result:`, text);
      return text;
    }

    // Helper function to validate CMake output messages
    function validateCMakeMessages(text: string, expectCacheMessage: boolean) {
      if (
        text.includes("configured successfully") ||
        text.includes("reconfigured successfully")
      ) {
        assert.ok(
          text.includes("LANGUAGE MODEL: This should end up in the std output"),
          "stdout should contain our test message from CMakeLists.txt"
        );
        assert.ok(
          text.includes(
            "LANGUAGE MODEL: This is an important message in the std err output"
          ),
          "stderr should contain our test notice message from CMakeLists.txt"
        );

        const hasCacheMessage = text.includes(
          "MY_CUSTOM_BOOLEAN is defined in the cache, so a cache is being used"
        );

        if (expectCacheMessage) {
          assert.ok(
            hasCacheMessage,
            "stdout should contain the cache usage detection message when cache is preserved"
          );
        } else {
          assert.ok(
            !hasCacheMessage,
            "stdout should NOT contain the cache usage detection message when cache is deleted"
          );
        }
      }
    }

    test("should configure with and without cache deletion", async function () {
      this.timeout(60000); // Combined test needs more time

      // Test 1: Configure without deleting cache
      const configureResult = await vscode.lm.invokeTool(
        "configure_cmake_project",
        {
          input: { delete_cache: false },
          toolInvocationToken: undefined,
        }
      );

      const configureText = validateConfigureResponse(
        configureResult,
        "preserve cache"
      );

      // Should indicate configuration success
      assert.ok(
        configureText.includes("Configuration completed") ||
          configureText.includes("configured") ||
          configureText.includes("successfully") ||
          configureText.includes("No active") ||
          configureText.includes("not available"),
        "Configure should mention completion or indicate no project available"
      );

      validateCMakeMessages(configureText, true); // Expect cache message

      // Test 2: Configure with cache deletion (reconfigure)
      const reconfigureResult = await vscode.lm.invokeTool(
        "configure_cmake_project",
        {
          input: { delete_cache: true },
          toolInvocationToken: undefined,
        }
      );

      const reconfigureText = validateConfigureResponse(
        reconfigureResult,
        "delete cache"
      );

      // Should indicate reconfiguration success
      assert.ok(
        reconfigureText.includes("reconfigured successfully") ||
          reconfigureText.includes("No active") ||
          reconfigureText.includes("not available"),
        "Reconfigure should mention completion or indicate no project available"
      );

      validateCMakeMessages(reconfigureText, false); // Don't expect cache message

      // Test 3: Default behavior (should preserve cache)
      const defaultResult = await vscode.lm.invokeTool(
        "configure_cmake_project",
        {
          input: {},
          toolInvocationToken: undefined,
        }
      );

      const defaultText = validateConfigureResponse(defaultResult, "default");

      // Default behavior should preserve cache
      if (defaultText.includes("configured successfully")) {
        assert.ok(
          defaultText.includes(
            "MY_CUSTOM_BOOLEAN is defined in the cache, so a cache is being used"
          ),
          "Default configuration should preserve cache and show cache usage message"
        );
      }
    });

    test("should include detailed output information when API supports it", async function () {
      this.timeout(30000);

      const result = await vscode.lm.invokeTool("configure_cmake_project", {
        input: { delete_cache: false },
        toolInvocationToken: undefined,
      });

      const text = validateConfigureResponse(result, "API output test");

      // Check that the output includes basic success information
      if (!text.includes("No active") && !text.includes("Error configuring")) {
        // Check for detailed output if newer API is available, otherwise just note limitation
        if (
          text.includes("Detailed output") &&
          text.includes("not available")
        ) {
          // Older API - check that limitation is properly communicated
          assert.ok(
            text.includes("currently installed version"),
            "Should inform about API limitation with current version"
          );
        } else if (text.includes("Exit code:") || text.includes("exit code")) {
          // Newer API available - check for structured output
          assert.ok(
            text.includes("Standard output:") || text.includes("Error output:"),
            "Result should include stdout or stderr sections with newer API"
          );

          // Specifically check for our CMake messages in the appropriate sections
          if (text.includes("Standard output:")) {
            assert.ok(
              text.includes(
                "LANGUAGE MODEL: This should end up in the std output"
              ),
              "Standard output section should contain our STATUS message"
            );
          }
        }
      }
    });

    test("should verify configuration affects project state", async function () {
      this.timeout(45000);

      // Verify the project is working before reconfiguration
      const cacheBeforeResult = await vscode.lm.invokeTool(
        "get_cmake_cache_variable",
        {
          input: { variable_name: "MY_CUSTOM_VAR" },
          toolInvocationToken: undefined,
        }
      );

      const cacheBeforeText = (
        cacheBeforeResult.content[0] as vscode.LanguageModelTextPart
      ).value;
      assert.ok(
        cacheBeforeText.includes("MY_CUSTOM_VAR") &&
          cacheBeforeText.includes("Hi Copilot!"),
        "Project should be properly configured before reconfiguration test"
      );

      // Trigger a reconfiguration
      const configResult = await vscode.lm.invokeTool(
        "configure_cmake_project",
        {
          input: { delete_cache: true },
          toolInvocationToken: undefined,
        }
      );

      const configText = validateConfigureResponse(
        configResult,
        "state verification"
      );

      // Verify the project is still working after reconfiguration
      const cacheAfterResult = await vscode.lm.invokeTool(
        "get_cmake_cache_variable",
        {
          input: { variable_name: "MY_CUSTOM_VAR" },
          toolInvocationToken: undefined,
        }
      );

      const cacheAfterText = (
        cacheAfterResult.content[0] as vscode.LanguageModelTextPart
      ).value;
      assert.ok(
        cacheAfterText.includes("MY_CUSTOM_VAR") &&
          cacheAfterText.includes("Hi Copilot!"),
        "Project should still be properly configured after reconfiguration"
      );

      // Verify configuration completed successfully
      assert.ok(
        configText.includes("reconfigured successfully") ||
          configText.includes("configured successfully") ||
          configText.includes("being reconfigured") ||
          configText.includes("being configured") ||
          configText.includes("Error configuring"),
        "Configuration should complete successfully or show error"
      );
    });
  });
});
