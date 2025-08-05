import * as assert from "assert";
import {
  parseCMakeCache,
  calculateStringDistance,
  cacheVariableToString,
  CMakeCacheVariable,
} from "../cmake-cache-utils";

suite("CMake Cache Utils Test Suite", () => {
  suite("parseCMakeCache", () => {
    test("should parse simple cache variables into a Map", () => {
      const cacheContent = `
# This is a comment
CMAKE_BUILD_TYPE:STRING=Debug
MY_CUSTOM_VAR:STRING=Hello World
CMAKE_CXX_COMPILER:FILEPATH=/usr/bin/c++
`;
      const variables = parseCMakeCache(cacheContent);

      assert.strictEqual(variables.size, 3);
      assert.strictEqual(variables.get("CMAKE_BUILD_TYPE")?.type, "STRING");
      assert.strictEqual(variables.get("CMAKE_BUILD_TYPE")?.value, "Debug");

      assert.strictEqual(variables.get("MY_CUSTOM_VAR")?.type, "STRING");
      assert.strictEqual(variables.get("MY_CUSTOM_VAR")?.value, "Hello World");
    });

    test("should parse variables with documentation", () => {
      const cacheContent = `
//A custom variable for demonstration
MY_CUSTOM_VAR:STRING=Hello

//Another variable
//with multiline documentation
MY_OTHER_VAR:BOOL=ON
`;
      const variables = parseCMakeCache(cacheContent);

      assert.strictEqual(variables.size, 2);
      assert.strictEqual(
        variables.get("MY_CUSTOM_VAR")?.documentation,
        "A custom variable for demonstration"
      );
      assert.strictEqual(
        variables.get("MY_OTHER_VAR")?.documentation,
        "with multiline documentation"
      );
    });

    test("should filter out -ADVANCED variables", () => {
      const cacheContent = `
CMAKE_BUILD_TYPE:STRING=Debug
CMAKE_BUILD_TYPE-ADVANCED:BOOL=ON
MY_VAR:STRING=value
MY_VAR-ADVANCED:BOOL=OFF
`;
      const variables = parseCMakeCache(cacheContent);

      assert.strictEqual(variables.size, 2);
      assert.ok(variables.has("CMAKE_BUILD_TYPE"));
      assert.ok(variables.has("MY_VAR"));
      assert.ok(!variables.has("CMAKE_BUILD_TYPE-ADVANCED"));
      assert.ok(!variables.has("MY_VAR-ADVANCED"));
    });

    test("should only accept valid variable names (CMP0053 compliant)", () => {
      const cacheContent = `
CMAKE_BUILD_TYPE:STRING=Debug
MY.VAR:STRING=value1
MY/VAR:STRING=value2
MY+VAR:STRING=value3
123INVALID:STRING=value4
MY@INVALID:STRING=value5
MY_VALID_VAR:STRING=value6
`;
      const variables = parseCMakeCache(cacheContent);

      // Should have 5 valid variables (excluding the invalid ones)
      assert.strictEqual(variables.size, 5);
      assert.ok(variables.has("CMAKE_BUILD_TYPE"));
      assert.ok(variables.has("MY.VAR"));
      assert.ok(variables.has("MY/VAR"));
      assert.ok(variables.has("MY+VAR"));
      assert.ok(variables.has("MY_VALID_VAR"));
      assert.ok(!variables.has("123INVALID"));
      assert.ok(!variables.has("MY@INVALID"));
    });

    test("should handle empty values and special characters", () => {
      const cacheContent = `
EMPTY_VAR:STRING=
PATH_VAR:PATH=/usr/local/bin:/usr/bin
MULTILINE_VAR:STRING=line1;line2;line3
`;
      const variables = parseCMakeCache(cacheContent);

      assert.strictEqual(variables.size, 3);
      assert.strictEqual(variables.get("EMPTY_VAR")?.value, "");
      assert.strictEqual(
        variables.get("PATH_VAR")?.value,
        "/usr/local/bin:/usr/bin"
      );
      assert.strictEqual(
        variables.get("MULTILINE_VAR")?.value,
        "line1;line2;line3"
      );
    });
  });

  suite("calculateStringDistance", () => {
    test("should calculate Levenshtein distance correctly", () => {
      assert.strictEqual(calculateStringDistance("", ""), 0);
      assert.strictEqual(calculateStringDistance("abc", ""), 3);
      assert.strictEqual(calculateStringDistance("", "abc"), 3);
      assert.strictEqual(calculateStringDistance("abc", "abc"), 0);
      assert.strictEqual(calculateStringDistance("abc", "ab"), 1);
      assert.strictEqual(calculateStringDistance("abc", "abcd"), 1);
      assert.strictEqual(calculateStringDistance("kitten", "sitting"), 3);
      assert.strictEqual(
        calculateStringDistance("MY_CUSTOM_BOOL", "MY_CUSTOM_BOOLEAN"),
        3
      );
    });
  });

  suite("cacheVariableToString", () => {
    test("should format variable without documentation", () => {
      const variable: CMakeCacheVariable = {
        name: "CMAKE_BUILD_TYPE",
        type: "STRING",
        value: "Debug",
      };

      const result = cacheVariableToString(variable);
      const expected =
        "Variable `CMAKE_BUILD_TYPE` has type `STRING` and is set to value `Debug` in the CMake cache.";

      assert.strictEqual(result, expected);
    });

    test("should format variable with documentation", () => {
      const variable: CMakeCacheVariable = {
        name: "MY_CUSTOM_VAR",
        type: "STRING",
        value: "Hello World",
        documentation: "A custom variable for demonstration purposes",
      };

      const result = cacheVariableToString(variable);
      const expected =
        "Variable `MY_CUSTOM_VAR` has type `STRING` and is set to value `Hello World` in the CMake cache.\nThe following documentation is provided for the variable:\n```\nA custom variable for demonstration purposes\n```";

      assert.strictEqual(result, expected);
    });

    test("should handle empty and special values", () => {
      const variable: CMakeCacheVariable = {
        name: "EMPTY_VAR",
        type: "STRING",
        value: "",
      };

      const result = cacheVariableToString(variable);
      const expected =
        "Variable `EMPTY_VAR` has type `STRING` and is set to value `` in the CMake cache.";

      assert.strictEqual(result, expected);
    });
  });
});
