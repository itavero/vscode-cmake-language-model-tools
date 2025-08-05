import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getCMakeToolsApi, Version, CMakeToolsApi } from "vscode-cmake-tools";

/**
 * Represents a CMake cache variable with its metadata
 */
export interface CMakeCacheVariable {
  name: string;
  type: string;
  value: string;
  documentation?: string;
}

/**
 * Regex for valid CMake variable names according to CMP0053:
 * - Variable names must start with a letter (A-Z, a-z) or underscore (_)
 * - Subsequent characters may be letters, digits (0-9), underscore (_), hyphen (-), dot (.), slash (/), or plus (+)
 * - This matches the rules described in CMake's CMP0053 policy:
 *   https://cmake.org/cmake/help/latest/policy/CMP0053.html
 * - The regex also captures TYPE and VALUE fields, and excludes -ADVANCED variables (which are metadata)
 * Example valid names: MY_VAR, _my-var, Path/To.File+Name
 */
const variableRegex = /^([A-Za-z_][A-Za-z0-9_\-./+]*):([^=]+)=(.*)$/;

/**
 * Parses a CMakeCache.txt file and extracts all cache variables into a Map
 * Uses CMP0053-compliant regex to validate variable names during parsing
 */
export function parseCMakeCache(
  cacheContent: string
): Map<string, CMakeCacheVariable> {
  const variables = new Map<string, CMakeCacheVariable>();
  const lines = cacheContent.split("\n");

  let currentDocumentation: string | undefined;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      currentDocumentation = undefined;
      continue;
    }

    // Handle documentation comments
    if (trimmedLine.startsWith("//")) {
      currentDocumentation = trimmedLine.substring(2).trim();
      continue;
    }

    // Parse variable entries using CMP0053-compliant regex
    const match = trimmedLine.match(variableRegex);
    if (match) {
      const [, name, type, value] = match;

      // Skip -ADVANCED variables as they are metadata
      if (name.endsWith("-ADVANCED")) {
        currentDocumentation = undefined;
        continue;
      }

      variables.set(name, {
        name,
        type,
        value,
        documentation: currentDocumentation,
      });

      // Reset documentation after processing a variable
      currentDocumentation = undefined;
    } else {
      // Reset documentation if we encounter a line that's not a comment or variable
      currentDocumentation = undefined;
    }
  }

  return variables;
}

/**
 * Gets the parsed CMake cache as a Map for efficient lookups
 */
export async function getCMakeCache(): Promise<
  Map<string, CMakeCacheVariable>
> {
  try {
    const cmakeApi = await getCMakeToolsApi(Version.latest);
    if (!cmakeApi) {
      return new Map();
    }

    const activeFolder = cmakeApi.getActiveFolderPath();
    if (!activeFolder) {
      return new Map();
    }

    const cacheContent = await readCMakeCacheFile(activeFolder);
    if (!cacheContent) {
      return new Map();
    }

    return parseCMakeCache(cacheContent);
  } catch (error) {
    console.error("Error getting CMake cache:", error);
    return new Map();
  }
}

/**
 * Calculates the Levenshtein distance between two strings
 */
export function calculateStringDistance(a: string, b: string): number {
  // Make both names uppercase and trimmed to ensure case-insensitive comparison
  a = a.toUpperCase().trim();
  b = b.toUpperCase().trim();

  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1, // deletion
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Finds the closest variable name using Levenshtein distance
 */
export async function findClosestVariableName(
  targetName: string,
  allVariableNames: string[]
): Promise<string | undefined> {
  let closestMatch: string | undefined;
  let distanceOfClosest = Infinity;

  for (const name of allVariableNames) {
    const distance = calculateStringDistance(targetName, name);
    if (distance < distanceOfClosest) {
      closestMatch = name;
      distanceOfClosest = distance;
    }
  }

  return closestMatch;
}

/**
 * Converts a CMakeCacheVariable to a readable string representation
 */
export function cacheVariableToString(variable: CMakeCacheVariable): string {
  let result = `Variable \`${variable.name}\` has type \`${variable.type}\` and is set to value \`${variable.value}\` in the CMake cache.`;
  if (variable.documentation) {
    result += `\nThe following documentation is provided for the variable:\n\`\`\`\n${variable.documentation}\n\`\`\``;
  }
  return result;
}

/**
 * Reads the CMakeCache.txt file for the given folder using CMake Tools API
 */
async function readCMakeCacheFile(folderPath: string): Promise<string | null> {
  try {
    const cmakeApi = await getCMakeToolsApi(Version.latest);
    if (!cmakeApi) {
      console.error("CMake Tools API not available");
      return null;
    }

    const folderUri = vscode.Uri.file(folderPath);
    const project = await cmakeApi.getProject(folderUri);
    if (!project) {
      console.error("No CMake project found for folder:", folderPath);
      return null;
    }

    const buildDirectory = await project.getBuildDirectory();
    if (!buildDirectory) {
      console.error("No build directory configured for CMake project");
      return null;
    }

    const cachePath = path.join(buildDirectory, "CMakeCache.txt");
    if (!fs.existsSync(cachePath)) {
      console.error("CMakeCache.txt not found at:", cachePath);
      return null;
    }

    return fs.readFileSync(cachePath, "utf8");
  } catch (error) {
    console.error("Error reading CMakeCache.txt:", error);
    return null;
  }
}
