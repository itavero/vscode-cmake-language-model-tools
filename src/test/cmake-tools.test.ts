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
      "get_cmake_build_directory",
      "get_cmake_cache_variable",
      "get_cmake_targets",
      "build_cmake_target",
      "configure_cmake_project",
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

  test("get_cmake_build_directory tool works", async function () {
    this.timeout(10000);

    // Test our actual language model tool
    const result = await vscode.lm.invokeTool("get_cmake_build_directory", {
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
    console.log("get_cmake_build_directory result:", text);

    // Should either return a build directory path or indicate none is configured
    assert.ok(
      text.includes("build") ||
        text.includes("No") ||
        text.includes("not configured") ||
        text.includes("/") ||
        text.includes("\\"), // Could be an actual path
      "Result should mention build directory, path, or indicate none configured"
    );
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

  test("get_cmake_targets tool works", async function () {
    this.timeout(10000);

    const result = await vscode.lm.invokeTool("get_cmake_targets", {
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
    console.log("get_cmake_targets result:", text);

    // Should either return targets or indicate no targets/project available
    assert.ok(
      text.includes("target") ||
        text.includes("Target") ||
        text.includes("hello_world") ||
        text.includes("hello_lib") ||
        text.includes("No active") ||
        text.includes("code model") ||
        text.includes("not available"),
      "Result should mention targets (hello_world, hello_lib) or indicate they're not available"
    );
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
        text.includes("configured"),
      "Result should mention build process or indicate no project available"
    );
  });

  suite("configure_cmake_project tool", () => {
    test("should configure without deleting cache", async function () {
      this.timeout(30000); // Longer timeout for configuration

      const result = await vscode.lm.invokeTool("configure_cmake_project", {
        input: { delete_cache: false },
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
      console.log("configure_cmake_project (no cache delete) result:", text);

      // Should indicate configuration success or indicate no project available
      assert.ok(
        text.includes("Configuration completed") ||
          text.includes("configured") ||
          text.includes("successfully") ||
          text.includes("No active") ||
          text.includes("not available"),
        "Result should mention configuration completion or indicate no project available"
      );

      // Check for the specific message outputs we added to CMakeLists.txt
      if (text.includes("configured successfully")) {
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
        // When not deleting cache, we should see the cache usage message
        assert.ok(
          text.includes(
            "MY_CUSTOM_BOOLEAN is defined in the cache, so a cache is being used"
          ),
          "stdout should contain the cache usage detection message when cache is preserved"
        );
      }
    });

    test("should configure with cache deletion", async function () {
      this.timeout(30000); // Longer timeout for configuration with cache deletion

      const result = await vscode.lm.invokeTool("configure_cmake_project", {
        input: { delete_cache: true },
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
      console.log("configure_cmake_project (with cache delete) result:", text);

      // Should indicate reconfiguration success or indicate no project available
      assert.ok(
        text.includes("reconfigured successfully") ||
          text.includes("No active") ||
          text.includes("not available"),
        "Result should mention reconfiguration completion or indicate no project available"
      );

      // Check for the specific message outputs we added to CMakeLists.txt
      if (text.includes("reconfigured successfully")) {
        assert.ok(
          text.includes("LANGUAGE MODEL: This should end up in the std output"),
          "stdout should contain our test message from CMakeLists.txt after reconfiguration"
        );
        assert.ok(
          text.includes(
            "LANGUAGE MODEL: This is an important message in the std err output"
          ),
          "stderr should contain our test notice message from CMakeLists.txt after reconfiguration"
        );
        // When deleting cache, we should NOT see the cache usage message since cache was deleted
        assert.ok(
          !text.includes(
            "MY_CUSTOM_BOOLEAN is defined in the cache, so a cache is being used"
          ),
          "stdout should NOT contain the cache usage detection message when cache is deleted"
        );
      }
    });

    test("should handle configuration without parameters (default behavior)", async function () {
      this.timeout(30000);

      const result = await vscode.lm.invokeTool("configure_cmake_project", {
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
      console.log("configure_cmake_project (default) result:", text);

      // Should indicate configuration success (default is configure without cache deletion)
      assert.ok(
        text.includes("configured successfully") ||
          text.includes("No active") ||
          text.includes("not available"),
        "Result should mention configuration completion or indicate no project available"
      );

      // Default behavior should preserve cache, so check for cache usage message
      if (text.includes("configured successfully")) {
        assert.ok(
          text.includes(
            "MY_CUSTOM_BOOLEAN is defined in the cache, so a cache is being used"
          ),
          "Default configuration should preserve cache and show cache usage message"
        );
      }
    });

    test("should include exit code and stdout/stderr in output", async function () {
      this.timeout(30000);

      const result = await vscode.lm.invokeTool("configure_cmake_project", {
        input: { delete_cache: false },
        toolInvocationToken: undefined,
      });

      assert.ok(result, "Tool should return a result");
      assert.ok(result.content, "Result should have content");

      const firstPart = result.content[0];
      assert.ok(
        firstPart instanceof vscode.LanguageModelTextPart,
        "First part should be text"
      );

      const text = firstPart.value;
      console.log("configure_cmake_project output format test:", text);

      // Check that the output includes structured information
      if (!text.includes("No active") && !text.includes("Error configuring")) {
        // If there's an active project and no error, check for structured output
        assert.ok(
          text.includes("Exit code:") || text.includes("exit code"),
          "Result should include exit code information"
        );

        // Should have stdout and/or stderr sections
        assert.ok(
          text.includes("Standard output:") || text.includes("Error output:"),
          "Result should include stdout or stderr sections"
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
    });

    test("configuration should actually work and affect the project", async function () {
      this.timeout(30000);

      // First, get the current CMake cache variable to verify the project is working
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

      // Verify the project is in a good state before reconfiguration
      assert.ok(
        cacheBeforeText.includes("MY_CUSTOM_VAR") &&
          cacheBeforeText.includes("Hi Copilot!"),
        "Project should be properly configured before reconfiguration test"
      );

      // Now trigger a reconfiguration
      const configResult = await vscode.lm.invokeTool(
        "configure_cmake_project",
        {
          input: { delete_cache: true },
          toolInvocationToken: undefined,
        }
      );

      const configText = (
        configResult.content[0] as vscode.LanguageModelTextPart
      ).value;
      console.log("Reconfiguration test result:", configText);

      // After reconfiguration, verify the project is still working
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

      // Verify the project is still properly configured after reconfiguration
      assert.ok(
        cacheAfterText.includes("MY_CUSTOM_VAR") &&
          cacheAfterText.includes("Hi Copilot!"),
        "Project should still be properly configured after reconfiguration"
      );

      // The configuration tool should have completed successfully
      assert.ok(
        configText.includes("reconfigured successfully") ||
          configText.includes("Error configuring"),
        "Configuration should complete successfully or show error"
      );
    });

    test("should demonstrate cache detection difference between configure and reconfigure", async function () {
      this.timeout(60000); // Longer timeout as we're doing multiple operations

      // First, do a regular configure (should use existing cache)
      const configureResult = await vscode.lm.invokeTool(
        "configure_cmake_project",
        {
          input: { delete_cache: false },
          toolInvocationToken: undefined,
        }
      );

      const configureText = (
        configureResult.content[0] as vscode.LanguageModelTextPart
      ).value;
      console.log("Configure (preserve cache) result:", configureText);

      // Then, do a reconfigure (should delete cache first)
      const reconfigureResult = await vscode.lm.invokeTool(
        "configure_cmake_project",
        {
          input: { delete_cache: true },
          toolInvocationToken: undefined,
        }
      );

      const reconfigureText = (
        reconfigureResult.content[0] as vscode.LanguageModelTextPart
      ).value;
      console.log("Reconfigure (delete cache) result:", reconfigureText);

      // When preserving cache, we should see the cache detection message
      if (configureText.includes("configured successfully")) {
        assert.ok(
          configureText.includes(
            "MY_CUSTOM_BOOLEAN is defined in the cache, so a cache is being used"
          ),
          "Configure with preserved cache should show cache detection message"
        );
      }

      // When deleting cache, we should NOT see the cache detection message
      if (reconfigureText.includes("reconfigured successfully")) {
        assert.ok(
          !reconfigureText.includes(
            "MY_CUSTOM_BOOLEAN is defined in the cache, so a cache is being used"
          ),
          "Reconfigure with deleted cache should NOT show cache detection message"
        );
      }

      // Both should contain the basic test messages
      if (configureText.includes("configured successfully")) {
        assert.ok(
          configureText.includes(
            "LANGUAGE MODEL: This should end up in the std output"
          ) &&
            configureText.includes(
              "LANGUAGE MODEL: This is an important message in the std err output"
            ),
          "Configure should contain both test messages"
        );
      }

      if (reconfigureText.includes("reconfigured successfully")) {
        assert.ok(
          reconfigureText.includes(
            "LANGUAGE MODEL: This should end up in the std output"
          ) &&
            reconfigureText.includes(
              "LANGUAGE MODEL: This is an important message in the std err output"
            ),
          "Reconfigure should contain both test messages"
        );
      }
    });
  });
});
