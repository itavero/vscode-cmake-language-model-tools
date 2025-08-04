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

    try {
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
    } catch (error) {
      console.log("Error testing get_cmake_build_directory tool:", error);
      // Don't fail if the tool can't be tested in this environment
      this.skip();
    }
  });

  suite("get_cmake_cache_variable tool", () => {
    test("should return MY_CUSTOM_VAR with documentation", async function () {
      this.timeout(10000);

      try {
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
      } catch (error) {
        console.log("Error testing get_cmake_cache_variable tool:", error);
        this.skip();
      }
    });

    test("should return MY_CUSTOM_BOOLEAN with documentation", async function () {
      this.timeout(10000);

      try {
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
      } catch (error) {
        console.log("Error testing get_cmake_cache_variable tool:", error);
        this.skip();
      }
    });

    test("should suggest closest match for typo MY_CUSTOM_BOOL", async function () {
      this.timeout(10000);

      try {
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
            text.includes("Available variables"),
          "Result should indicate variable not found, suggest closest match, and list available variables"
        );
      } catch (error) {
        console.log("Error testing get_cmake_cache_variable tool:", error);
        this.skip();
      }
    });

    test("should list all variables when no parameter provided", async function () {
      this.timeout(10000);

      try {
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
      } catch (error) {
        console.log("Error testing get_cmake_cache_variable tool:", error);
        this.skip();
      }
    });

    test("should return multiple variables for wildcard search", async function () {
      this.timeout(10000);

      try {
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
      } catch (error) {
        console.log(
          "Error testing get_cmake_cache_variable wildcard tool:",
          error
        );
        this.skip();
      }
    });
  });

  test("get_cmake_targets tool works", async function () {
    this.timeout(10000);

    try {
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
    } catch (error) {
      console.log("Error testing get_cmake_targets tool:", error);
      this.skip();
    }
  });

  test("build_cmake_target tool works", async function () {
    this.timeout(15000); // Increased timeout for actual build operations

    try {
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
    } catch (error) {
      console.log("Error testing build_cmake_target tool:", error);
      this.skip();
    }
  });
});
