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
} from "vscode-cmake-tools";
import {
  getCMakeCache,
  findClosestVariableName,
  cacheVariableToString,
  CMakeCacheVariable,
} from "./cmake-cache-utils";

let cmakeToolsApi: CMakeToolsApi | undefined;

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
    registerGetCMakeBuildDirectoryTool(),
    registerGetCMakeCacheVariableTool(),
    registerGetCMakeTargetsTool(),
    registerBuildCMakeTargetTool(),
  ];

  context.subscriptions.push(...disposables);
}

function registerGetCMakeBuildDirectoryTool(): vscode.Disposable {
  return vscode.lm.registerTool("get_cmake_build_directory", {
    invoke: async (options, token) => {
      try {
        const project = await getCurrentProject();
        if (!project) {
          return {
            content: [
              new vscode.LanguageModelTextPart("No active CMake project found"),
            ],
          };
        }

        const buildDir = await project.getBuildDirectory();
        if (!buildDir) {
          return {
            content: [
              new vscode.LanguageModelTextPart(
                "Build directory not configured"
              ),
            ],
          };
        }

        return {
          content: [
            new vscode.LanguageModelTextPart(
              `CMake build directory: ${buildDir}`
            ),
          ],
        };
      } catch (error) {
        return {
          content: [
            new vscode.LanguageModelTextPart(
              `Error getting build directory: ${error}`
            ),
          ],
        };
      }
    },
  });
}

function escapeRegex(string: string): string {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
            } else {
              return {
                content: [
                  new vscode.LanguageModelTextPart(
                    `No variables found matching pattern \`${variable_name}\`.`
                  ),
                ],
              };
            }
          }
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
        return {
          content: [
            new vscode.LanguageModelTextPart(
              `Failed to get CMake cache variable due to an error: ${error}`
            ),
          ],
        };
      }
    },
  });
}

function registerGetCMakeTargetsTool(): vscode.Disposable {
  return vscode.lm.registerTool("get_cmake_targets", {
    invoke: async (options, token) => {
      try {
        const { targetNames } = options.input as { targetNames?: string[] };

        const project = await getCurrentProject();
        if (!project) {
          return {
            content: [
              new vscode.LanguageModelTextPart("No active CMake project found"),
            ],
          };
        }

        const codeModel = project.codeModel;
        if (!codeModel) {
          return {
            content: [
              new vscode.LanguageModelTextPart(
                "CMake code model not available. Try configuring the project first."
              ),
            ],
          };
        }

        let allTargets = codeModel.configurations.flatMap((config) =>
          config.projects.flatMap((proj) => proj.targets)
        );

        // Filter targets if specific names were requested
        if (targetNames && targetNames.length > 0) {
          allTargets = allTargets.filter((target) =>
            targetNames.includes(target.name)
          );
        }

        if (allTargets.length === 0) {
          const message =
            targetNames && targetNames.length > 0
              ? `No targets found matching: ${targetNames.join(", ")}`
              : "No targets found";
          return {
            content: [new vscode.LanguageModelTextPart(message)],
          };
        }

        const formattedTargets = allTargets
          .map((target) => {
            let result = `Target: ${target.name}\n`;
            result += `  Type: ${target.type}\n`;

            if (target.sourceDirectory) {
              result += `  Source Directory: ${target.sourceDirectory}\n`;
            }

            if (target.fullName) {
              result += `  Full Name: ${target.fullName}\n`;
            }

            if (target.artifacts && target.artifacts.length > 0) {
              result += `  Artifacts:\n${target.artifacts
                .map((a) => `    - ${a}`)
                .join("\n")}\n`;
            }

            if (target.fileGroups && target.fileGroups.length > 0) {
              result += `  File Groups: ${target.fileGroups.length}\n`;
              target.fileGroups.forEach((group, idx) => {
                result += `    Group ${idx + 1}:\n`;
                if (group.language) {
                  result += `      Language: ${group.language}\n`;
                }
                result += `      Sources: ${group.sources.length} files\n`;
                if (group.includePath && group.includePath.length > 0) {
                  result += `      Include Paths: ${group.includePath.length}\n`;
                }
              });
            }

            return result;
          })
          .join("\n");

        return {
          content: [
            new vscode.LanguageModelTextPart(
              `CMake Targets (${allTargets.length} found):\n\n${formattedTargets}`
            ),
          ],
        };
      } catch (error) {
        return {
          content: [
            new vscode.LanguageModelTextPart(`Error getting targets: ${error}`),
          ],
        };
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
        if (!project) {
          return {
            content: [
              new vscode.LanguageModelTextPart("No active CMake project found"),
            ],
          };
        }

        // Start the build
        const buildTargets =
          targets && targets.length > 0 ? targets : undefined;
        const targetText = buildTargets ? targets!.join(", ") : "all targets";

        try {
          await project.build(buildTargets);
          return {
            content: [
              new vscode.LanguageModelTextPart(
                `Successfully built ${targetText}`
              ),
            ],
          };
        } catch (buildError) {
          return {
            content: [
              new vscode.LanguageModelTextPart(
                `Build failed for ${targetText}: ${buildError}`
              ),
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            new vscode.LanguageModelTextPart(`Error building target: ${error}`),
          ],
        };
      }
    },
  });
}

async function getCurrentProject(): Promise<Project | undefined> {
  if (!cmakeToolsApi) {
    throw new Error("CMake Tools API not available");
  }

  const activeFolder = cmakeToolsApi.getActiveFolderPath();
  if (!activeFolder) {
    return undefined;
  }

  const folderUri = vscode.Uri.file(activeFolder);
  return await cmakeToolsApi.getProject(folderUri);
}

// This method is called when your extension is deactivated
export function deactivate() {}
