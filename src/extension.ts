// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  getCMakeToolsApi,
  Version,
  CMakeToolsApi,
  Project,
  CodeModel,
} from "vscode-cmake-tools";
import {
  getCMakeCache,
  findClosestVariableName,
  cacheVariableToString,
  CMakeCacheVariable,
} from "./cmake-cache-utils";

let cmakeToolsApi: CMakeToolsApi | undefined;

// Type that guarantees codeModel is available
interface ProjectWithCodeModel extends Project {
  readonly codeModel: CodeModel.Content;
}

// Standardized error handling for language model tools
function createErrorResponse(
  toolName: string,
  error: unknown
): vscode.LanguageModelToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    content: [
      new vscode.LanguageModelTextPart(`Error in ${toolName}: ${errorMessage}`),
    ],
  };
}

// Standardized parameter validation
function validateRequiredParameter(
  value: any,
  paramName: string,
  toolName: string
): void {
  if (!value) {
    throw new Error(`${paramName} parameter is required for ${toolName}`);
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("CMake Language Model Tools extension is now active!");

  // Get the CMake Tools API
  try {
    cmakeToolsApi = await getCMakeToolsApi(Version.latest);
    if (!cmakeToolsApi) {
      console.warn("CMake Tools API not available");
    }
  } catch (error) {
    console.error("Failed to get CMake Tools API:", error);
  }

  // Register all the language model tools
  const disposables = [
    registerConfigureCMakeProjectTool(),
    registerGetCMakeProjectInfoTool(),
    registerGetCMakeCacheVariableTool(),
    registerBuildCMakeTargetTool(),
    registerFindCMakeBuildTargetContainingFileTool(),
  ];

  context.subscriptions.push(...disposables);
}

/**
 * Converts a string from UPPER_SNAKE_CASE to Pascal Case with spaces.
 * For example: "STATIC_LIBRARY" => "Static Library"
 * @param type The UPPER_SNAKE_CASE string to convert.
 * @returns The converted string in Pascal Case with spaces.
 */
function formatTargetType(type: string): string {
  // Convert UPPER_SNAKE_CASE to "Pascal Case" with spaces
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function registerGetCMakeProjectInfoTool(): vscode.Disposable {
  return vscode.lm.registerTool("get_cmake_project_info", {
    invoke: async (options, token) => {
      try {
        const project = await getCurrentProject();
        const codeModel = project.codeModel; // No need for ! since type guarantees it exists

        let result = "CMake Project Information:\n\n";

        // Get workspace root
        const workspaceRoot = getWorkspaceRoot();
        if (workspaceRoot) {
          result += `Source Directory: ${workspaceRoot}\n`;
        }

        // Get build directory
        const buildDir = await project.getBuildDirectory();
        if (buildDir) {
          result += `Build Directory: ${buildDir}\n`;
        } else {
          result += `Build Directory: Not configured\n`;
        }

        // Get targets information (summary)
        const allTargets = codeModel.configurations.flatMap((config) =>
          config.projects.flatMap((proj) => proj.targets)
        );

        result += `\nTargets (${allTargets.length} found):\n`;

        if (allTargets.length > 0) {
          // Sort targets alphabetically by name
          const sortedTargets = allTargets
            .map((target) => {
              return {
                name: target.name,
                type: formatTargetType(target.type),
                sourcePath: getRelativeOrAbsoluteSourcePath(
                  target.sourceDirectory,
                  workspaceRoot
                ),
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

          sortedTargets.forEach((target) => {
            let targetInfo = `  - ${target.name} (${target.type} defined in \`${target.sourcePath}\`)`;
            result += targetInfo + "\n";
          });
        } else {
          result += "  No targets found\n";
        }

        return {
          content: [new vscode.LanguageModelTextPart(result)],
        };
      } catch (error) {
        return createErrorResponse("get_cmake_project_info", error);
      }
    },
  });
}

function escapeRegex(string: string): string {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the root directory of the current workspace for CMake operations.
 *
 * Attempts to obtain the active folder path from the CMake Tools API first.
 * If unavailable, falls back to the first workspace folder in VS Code.
 * If no workspace is available, returns an empty string.
 *
 * @returns {string} The workspace root directory path, or an empty string if not available.
 */
function getWorkspaceRoot(): string {
  // Try to get the active folder path from CMake Tools API first
  const activeFolderPath = cmakeToolsApi?.getActiveFolderPath();
  if (activeFolderPath) {
    return activeFolderPath;
  }

  // Fallback to the first workspace folder if available
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }

  // Final fallback to empty string (will be handled gracefully by path functions)
  return "";
}

/**
 * Gets the best display path for a source directory - relative if possible, absolute as fallback.
 *
 * @param sourceDirectory The absolute or relative path to the source directory.
 * @param workspaceRoot The absolute path to the workspace root.
 * @returns The relative path if within workspace, absolute path otherwise. Never returns undefined.
 */
function getRelativeOrAbsoluteSourcePath(
  sourceDirectory: string | undefined,
  workspaceRoot: string
): string {
  if (!sourceDirectory) {
    // If no source directory is provided, return the workspace root as fallback
    return workspaceRoot;
  }

  try {
    // Resolve sourceDirectory relative to workspaceRoot if it's not absolute
    const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
    const resolvedSourceDir = path.resolve(
      resolvedWorkspaceRoot,
      sourceDirectory
    );

    // Try to calculate relative path
    if (resolvedSourceDir.startsWith(resolvedWorkspaceRoot)) {
      const relativePath = path.relative(
        resolvedWorkspaceRoot,
        resolvedSourceDir
      );

      // If it's not the root directory (empty string), return relative path
      if (relativePath) {
        return relativePath;
      }
    }

    // Fallback to absolute path if relative calculation fails or is root
    return resolvedSourceDir;
  } catch (error) {
    console.warn("Error calculating source directory path:", error);
    // Last fallback - return the original path or workspace root
    return sourceDirectory || workspaceRoot;
  }
}

function registerGetCMakeCacheVariableTool(): vscode.Disposable {
  return vscode.lm.registerTool("get_cmake_cache_variable", {
    invoke: async (options, token) => {
      try {
        const { variable_name } = options.input as { variable_name?: string };

        const cmakeCache = await getCMakeCache();

        const variable_name_is_provided =
          variable_name !== undefined && variable_name.trim().length > 0;

        if (variable_name_is_provided) {
          if (variable_name.includes("*")) {
            // Wildcard search
            const pattern = new RegExp(
              `^${variable_name.split("*").map(escapeRegex).join(".*")}$`
            );

            const matchingVariables: CMakeCacheVariable[] = [];
            for (const [name, variable] of cmakeCache.entries()) {
              if (pattern.test(name)) {
                matchingVariables.push(variable);
              }
            }

            if (matchingVariables.length > 0) {
              const result = `Found ${
                matchingVariables.length
              } variables matching \`${variable_name}\`:\n\n${matchingVariables
                .map(cacheVariableToString)
                .join("\n\n")}`;
              return {
                content: [new vscode.LanguageModelTextPart(result)],
              };
            }
            // If no matches, we will fall through to the "variable not found" logic below
          } else {
            // Check if the variable name is in the cmakeCache map
            const varFromCache = cmakeCache.get(variable_name);
            if (varFromCache) {
              return {
                content: [
                  new vscode.LanguageModelTextPart(
                    cacheVariableToString(varFromCache)
                  ),
                ],
              };
            }
          }
        }

        // Variable not found or not provided, get all variables.
        if (cmakeCache.size === 0) {
          return {
            content: [
              new vscode.LanguageModelTextPart(
                "No variables found in CMake cache. Perhaps the project is not configured yet."
              ),
            ],
          };
        }

        const varNames = Array.from(cmakeCache.keys()).sort();
        if (!variable_name_is_provided) {
          // If no variable name was provided, return all variable names
          const result = `CMake cache contains ${
            varNames.length
          } variables:\n\n${varNames.map((n) => `- \`${n}\``).join("\n")}`;
          return {
            content: [new vscode.LanguageModelTextPart(result)],
          };
        }

        // Variable not found, provide suggestions
        const closestMatch = await findClosestVariableName(
          variable_name,
          varNames
        );
        let result = `Variable \`${variable_name}\` was not found in CMake cache.`;

        if (closestMatch) {
          const closestMatchInfo = cmakeCache.get(closestMatch);
          result += `\n\nDid you mean \`${closestMatch}\`?\n\n`;
          result += cacheVariableToString(closestMatchInfo!);
        }

        if (varNames.length > 1) {
          result += `\n\nOther variables available in CMake cache:\n`;
          result += varNames
            .filter((n) => n !== closestMatch)
            .map((n) => `- \`${n}\`\n`)
            .join();
        }

        return {
          content: [new vscode.LanguageModelTextPart(result)],
        };
      } catch (error) {
        return createErrorResponse("get_cmake_cache_variable", error);
      }
    },
  });
}

function registerBuildCMakeTargetTool(): vscode.Disposable {
  return vscode.lm.registerTool("build_cmake_target", {
    invoke: async (options, token) => {
      try {
        const { targets } = options.input as { targets?: string[] };

        const project = await getCurrentProject();

        // Start the build
        const buildTargets =
          targets && targets.length > 0 ? targets : undefined;
        const targetText = buildTargets ? targets!.join(", ") : "all targets";

        // Check if the newer API method with result is available
        const hasBuildWithResult =
          typeof (project as any).buildWithResult === "function";

        if (hasBuildWithResult) {
          // Use newer API that returns result with stdout/stderr
          try {
            const result = await (project as any).buildWithResult(
              buildTargets,
              token
            );

            const statusText =
              result.exitCode === 0 ? "successfully" : "with errors";
            let responseText = `Build for ${targetText} completed **${statusText}**. Exit code: \`${result.exitCode}\`\n\n`;

            // Include stderr if present
            if (result.stderr) {
              responseText += `\n\nError output:\n\`\`\`\n${result.stderr}\n\`\`\`\n\n`;
            }

            // Include stdout if present
            if (result.stdout) {
              responseText += `\n\nStandard output:\n\`\`\`\n${result.stdout}\n\`\`\``;
            }

            return {
              content: [new vscode.LanguageModelTextPart(responseText)],
            };
          } catch (buildError) {
            return {
              content: [
                new vscode.LanguageModelTextPart(
                  `Build failed for ${targetText}: ${buildError}\n\n` +
                    `*Note: This error occurred with the enhanced CMake Tools API.*`
                ),
              ],
            };
          }
        } else {
          // Fallback to older API method without result
          try {
            await project.build(buildTargets);

            let responseText = `Build for ${targetText} is being executed.\n`;
            responseText += `Detailed output (stdout/stderr) and exit code are not available with the currently installed version of the CMake Tools extension.\n`;

            return {
              content: [new vscode.LanguageModelTextPart(responseText)],
            };
          } catch (buildError) {
            return {
              content: [
                new vscode.LanguageModelTextPart(
                  `Build failed for ${targetText}: ${buildError}\n\n` +
                    `*Note: Detailed output information is not available with the currently installed version of the CMake Tools extension.*`
                ),
              ],
            };
          }
        }
      } catch (error) {
        return createErrorResponse("build_cmake_target", error);
      }
    },
  });
}

function registerConfigureCMakeProjectTool(): vscode.Disposable {
  return vscode.lm.registerTool("configure_cmake_project", {
    invoke: async (options, token) => {
      try {
        const { delete_cache } = options.input as { delete_cache?: boolean };

        // Note: For configuration, we shouldn't require codeModel to exist since
        // configuration is what creates the codeModel. So we'll create a simpler version
        // of getCurrentProject for this specific case.
        if (!cmakeToolsApi) {
          throw new Error("CMake Tools API not available");
        }

        const activeFolder = cmakeToolsApi.getActiveFolderPath();
        if (!activeFolder) {
          throw new Error("No active CMake project found");
        }

        const folderUri = vscode.Uri.file(activeFolder);
        const project = await cmakeToolsApi.getProject(folderUri);

        if (!project) {
          throw new Error("No active CMake project found");
        }

        // Determine which method to use based on delete_cache parameter
        const shouldDeleteCache = delete_cache === true;
        const configAction = shouldDeleteCache ? "reconfigured" : "configured";

        // Check if the newer API methods with result are available
        const hasResultMethods = shouldDeleteCache
          ? typeof (project as any).reconfigureWithResult === "function"
          : typeof (project as any).configureWithResult === "function";

        if (hasResultMethods) {
          // Use newer API that returns result with stdout/stderr
          let result;
          if (shouldDeleteCache) {
            result = await (project as any).reconfigureWithResult(token);
          } else {
            result = await (project as any).configureWithResult(token);
          }

          const statusText =
            result.exitCode === 0 ? "successfully" : "with errors";
          let responseText = `CMake project ${configAction} **${statusText}**. Exit code: \`${result.exitCode}\`\n\n`;

          // Include stderr if present
          if (result.stderr) {
            responseText += `\n\nError output:\n\`\`\`\n${result.stderr}\n\`\`\`\n\n`;
          }

          // Include stdout if present
          if (result.stdout) {
            responseText += `\n\nStandard output:\n\`\`\`\n${result.stdout}\n\`\`\``;
          }

          return {
            content: [new vscode.LanguageModelTextPart(responseText)],
          };
        } else {
          // Fallback to older API methods without result
          try {
            if (shouldDeleteCache) {
              await (project as any).reconfigure();
            } else {
              await (project as any).configure();
            }

            let responseText = `CMake project is being ${configAction}.\n`;
            responseText += `Detailed output (stdout/stderr) and exit code are not available with the currently installed version of the CMake Tools extension.\n`;

            return {
              content: [new vscode.LanguageModelTextPart(responseText)],
            };
          } catch (configError) {
            return {
              content: [
                new vscode.LanguageModelTextPart(
                  `CMake project configuration failed: ${configError}\n\n` +
                    `*Note: Detailed output information is not available with the currently installed version of the CMake Tools extension.*`
                ),
              ],
            };
          }
        }
      } catch (error) {
        return createErrorResponse("configure_cmake_project", error);
      }
    },
  });
}

function registerFindCMakeBuildTargetContainingFileTool(): vscode.Disposable {
  return vscode.lm.registerTool("find_cmake_build_target_containing_file", {
    invoke: async (options, token) => {
      try {
        const { file_path } = options.input as { file_path?: string };
        validateRequiredParameter(
          file_path?.trim(),
          "file_path",
          "find_cmake_build_target_containing_file"
        );

        // Type assertion is safe here because validateRequiredParameter throws if file_path is falsy
        const filePath = file_path as string;

        const project = await getCurrentProject();
        const codeModel = project.codeModel; // No need for ! since type guarantees it exists
        const workspaceRoot = getWorkspaceRoot();

        // Get all targets from all configurations
        const allTargets = codeModel.configurations.flatMap((config) =>
          config.projects.flatMap((proj) => proj.targets)
        );

        // Normalize the input file path for comparison
        const normalizedFilePath = path.resolve(filePath);

        // Find targets that directly contain the file in their sources
        const directMatches: Array<CodeModel.Target> = [];

        // Find targets that can access the file via include directories
        const includeMatches: Array<{
          target: CodeModel.Target;
          withinSourceDir: boolean;
        }> = [];

        // Find targets that have a source directory that matches the file path
        const sourceDirMatches: Array<CodeModel.Target> = [];

        for (const target of allTargets) {
          // Check direct source file matches
          if (target.fileGroups) {
            for (const fileGroup of target.fileGroups) {
              for (const source of fileGroup.sources) {
                const normalizedSource = path.resolve(source);
                if (normalizedSource === normalizedFilePath) {
                  directMatches.push(target);
                  break;
                }
              }
            }
          }

          // Check include directory matches
          if (target.fileGroups) {
            for (const fileGroup of target.fileGroups) {
              if (fileGroup.includePath) {
                for (const includePathObj of fileGroup.includePath) {
                  const includePath = path.resolve(includePathObj.path);
                  const fileDir = path.dirname(normalizedFilePath);

                  // Check if the file's directory is within this include path
                  if (fileDir.startsWith(includePath)) {
                    const isWithinSourceDir =
                      target.sourceDirectory !== undefined &&
                      includePath.startsWith(
                        path.resolve(target.sourceDirectory)
                      );

                    includeMatches.push({
                      target: target,
                      withinSourceDir: isWithinSourceDir,
                    });
                  }
                }
              }
            }
          }

          // Check if the file path matches the target's source directory
          if (target.sourceDirectory) {
            const normalizedSourceDir = path.resolve(target.sourceDirectory);
            if (normalizedFilePath.startsWith(normalizedSourceDir)) {
              sourceDirMatches.push(target);
            }
          }
        }

        // Sort include matches to prefer those within source directory
        includeMatches.sort((a, b) => {
          if (a.withinSourceDir && !b.withinSourceDir) {
            return -1;
          }
          if (!a.withinSourceDir && b.withinSourceDir) {
            return 1;
          }
          return a.target.name.localeCompare(b.target.name);
        });

        // Sort source directory matches on the longest source directory first
        sourceDirMatches.sort((a, b) => {
          const aLength = a.sourceDirectory?.length ?? 0;
          const bLength = b.sourceDirectory?.length ?? 0;
          return bLength - aLength; // Sort descending by length
        });

        // Direct matches first
        if (directMatches.length === 1) {
          const target = directMatches[0];
          const sourceDir = getRelativeOrAbsoluteSourcePath(
            target.sourceDirectory,
            workspaceRoot
          );
          let message = `The file \`${file_path}\` is directly included in the \`${
            target.name
          }\` target, which has type ${formatTargetType(target.type)}.`;
          message += ` The target's source directory is at \`${sourceDir}\`.`;
          return {
            content: [new vscode.LanguageModelTextPart(message)],
          };
        }

        if (directMatches.length > 1) {
          let result = `Multiple targets seem to directly include \`${file_path}\`:\n\n`;
          for (const match of directMatches) {
            const sourceDir = getRelativeOrAbsoluteSourcePath(
              match.sourceDirectory,
              workspaceRoot
            );
            let targetInfo = `  - ${match.name} (${formatTargetType(
              match.type
            )}) [${sourceDir}]`;
            result += targetInfo + "\n";
          }

          return {
            content: [new vscode.LanguageModelTextPart(result)],
          };
        }

        // Include matches
        if (includeMatches.length > 0) {
          // Find the match in source directory with the longest path
          const matchInSourceDir =
            includeMatches
              .filter((match) => match.withinSourceDir)
              .sort((a, b) => {
                const aLength = a.target.sourceDirectory?.length ?? 0;
                const bLength = b.target.sourceDirectory?.length ?? 0;
                return bLength - aLength; // Sort descending by length
              })[0]?.target ?? undefined;

          let result = `Found ${includeMatches.length} targets that can potentially include file \`${file_path}\`.\n`;

          if (matchInSourceDir !== undefined) {
            const sourceDir = getRelativeOrAbsoluteSourcePath(
              matchInSourceDir.sourceDirectory,
              workspaceRoot
            );
            let message = `It is likely part of the \`${
              matchInSourceDir.name
            }\` target, which has type ${formatTargetType(
              matchInSourceDir.type
            )}, as it was found within its source directory at \`${sourceDir}\`.`;
            result += message + "\n\n";
          }

          const targetNames = includeMatches
            .filter((match) => match.target.name !== matchInSourceDir?.name)
            .map((m) => {
              const sourceDir = getRelativeOrAbsoluteSourcePath(
                m.target.sourceDirectory,
                workspaceRoot
              );
              let targetInfo = `${m.target.name} (${formatTargetType(
                m.target.type
              )}) [${sourceDir}]`;
              return targetInfo;
            })
            .sort();

          if (targetNames.length > 0) {
            if (matchInSourceDir !== undefined) {
              result += `Other targets that can access this file via include paths:\n`;
            } else {
              result += `Targets that can access this file via include paths:\n`;
            }
            result +=
              targetNames.map((name) => `  - ${name}`).join("\n") + "\n\n";
          }

          return {
            content: [new vscode.LanguageModelTextPart(result)],
          };
        }

        // Source directory matches
        if (sourceDirMatches.length > 0) {
          const target = sourceDirMatches[0];
          const sourceDir = getRelativeOrAbsoluteSourcePath(
            target.sourceDirectory,
            workspaceRoot
          );

          let message = `The file \`${file_path}\` is located within the source directory of the \`${
            target.name
          }\` target, which has type ${formatTargetType(
            target.type
          )} at \`${sourceDir}\`. This seems the most likely target to own this file.`;

          return {
            content: [new vscode.LanguageModelTextPart(message)],
          };
        }

        return {
          content: [
            new vscode.LanguageModelTextPart(
              `Unable to find any targets that include the file \`${file_path}\`.\nThis does not mean that the file is not included by any target, it just means that this tool is unable to find the relation.`
            ),
          ],
        };
      } catch (error) {
        return createErrorResponse(
          "find_cmake_build_target_containing_file",
          error
        );
      }
    },
  });
}

/**
 * Retrieves the current active CMake project with a valid code model.
 *
 * This function uses the CMake Tools API to get the active folder and project.
 * It throws an error if the API is unavailable, if there is no active project,
 * or if the project's code model is not available (e.g., before configuration).
 *
 * The returned project is type-asserted to `ProjectWithCodeModel` because the
 * function ensures that the `codeModel` property is present before returning.
 *
 * @throws {Error} If the CMake Tools API is not available.
 * @throws {Error} If there is no active CMake project.
 * @throws {Error} If the project's code model is not available.
 * @returns {Promise<ProjectWithCodeModel>} The current project with a code model.
 */
async function getCurrentProject(): Promise<ProjectWithCodeModel> {
  if (!cmakeToolsApi) {
    throw new Error("CMake Tools API not available");
  }

  const activeFolder = cmakeToolsApi.getActiveFolderPath();
  if (!activeFolder) {
    throw new Error("No active CMake project found");
  }

  const folderUri = vscode.Uri.file(activeFolder);
  const project = await cmakeToolsApi.getProject(folderUri);

  if (!project) {
    throw new Error("No active CMake project found");
  }

  // Also validate that the code model is available
  if (!project.codeModel) {
    throw new Error(
      "CMake code model not available. Try configuring the project first."
    );
  }

  return project as ProjectWithCodeModel;
}

// This method is called when your extension is deactivated
export function deactivate() {}
