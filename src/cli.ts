import type { CliOptions } from "./types.js";
import { runAddCommand } from "./commands/add.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runInitCommand } from "./commands/init.js";
import { DEVFORGE_VERSION } from "./version.js";

function readFlagValue(flag: string, args: string[]): string {
  const value = args.shift();

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readOptionalFlagValue(args: string[]): string | undefined {
  const value = args[0];

  if (!value || value.startsWith("-")) {
    return undefined;
  }

  args.shift();
  return value;
}

function assertInitOnlyFlag(currentCommand: CliOptions["command"], flag: string): void {
  if (currentCommand !== "init") {
    throw new Error(`${flag} can only be used with \`devforge init\`.`);
  }
}

function assertInitOrAddFlag(currentCommand: CliOptions["command"], flag: string): void {
  if (currentCommand !== "init" && currentCommand !== "add") {
    throw new Error(`${flag} can only be used with \`devforge init\` or \`devforge add\`.`);
  }
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "init",
    resume: false,
    skipInstall: false,
    preflightOnly: false,
    saveConfig: false,
    yes: false,
  };

  const args = [...argv];
  const firstArg = args[0];

  if (firstArg === "help" || firstArg === "--help" || firstArg === "-h") {
    options.command = "help";
    return options;
  }

  if (firstArg === "version" || firstArg === "--version" || firstArg === "-v") {
    options.command = "version";
    return options;
  }

  if (firstArg === "doctor") {
    options.command = "doctor";
    args.shift();
  } else if (firstArg === "add") {
    options.command = "add";
    args.shift();
    if (args[0] === "--help" || args[0] === "-h") {
      options.command = "help";
      return options;
    }
    const feature = args.shift();

    if (!feature || feature.startsWith("-")) {
      throw new Error("Missing feature for `devforge add`. Expected one of: testing, docker, github-actions, ai-rules.");
    }

    options.addFeature = feature as CliOptions["addFeature"];
  } else if (firstArg === "init") {
    args.shift();
  } else if (firstArg && !firstArg.startsWith("-")) {
    throw new Error(`Unknown command: ${firstArg}`);
  }

  while (args.length > 0) {
    const current = args.shift();

    switch (current) {
      case "--resume":
        assertInitOnlyFlag(options.command, "--resume");
        options.resume = true;
        break;
      case "--help":
      case "-h":
        options.command = "help";
        return options;
      case "--version":
      case "-v":
        options.command = "version";
        return options;
      case "--skip-install":
        assertInitOrAddFlag(options.command, "--skip-install");
        options.skipInstall = true;
        break;
      case "--preflight-only":
        assertInitOnlyFlag(options.command, "--preflight-only");
        options.preflightOnly = true;
        break;
      case "--config":
        assertInitOnlyFlag(options.command, "--config");
        options.configPath = readFlagValue("--config", args);
        break;
      case "--save-config":
        assertInitOnlyFlag(options.command, "--save-config");
        options.saveConfig = true;
        options.saveConfigPath = readOptionalFlagValue(args);
        break;
      case "--yes":
      case "-y":
        assertInitOnlyFlag(options.command, "--yes");
        options.yes = true;
        break;
      case "--output":
        assertInitOnlyFlag(options.command, "--output");
        options.outputDir = readFlagValue("--output", args);
        break;
      case "--name":
        assertInitOnlyFlag(options.command, "--name");
        options.projectName = readFlagValue("--name", args);
        break;
      default:
        if (current?.startsWith("-")) {
          throw new Error(`Unknown option: ${current}`);
        }

        throw new Error(`Unexpected argument: ${current}`);
    }
  }

  if (options.resume && options.configPath) {
    throw new Error("`--resume` cannot be used together with `--config`.");
  }

  return options;
}

function printHelp(): void {
  console.log(`DevForge CLI v${DEVFORGE_VERSION}

Usage:
  devforge
  devforge init
  devforge init --resume
  devforge init --config ./devforge.config.json
  devforge add testing
  devforge doctor

Commands:
  init            Start a new scaffold session
  add             Add a managed feature to an existing DevForge project
  doctor          Inspect local machine readiness for DevForge scaffolds
  help            Show command help
  version         Print the current CLI version

Flags:
  --resume         Resume the last saved init session
  --config <path>  Load a saved DevForge config and run non-interactively
  --save-config    Save the resolved scaffold plan as devforge.config.json
  --skip-install   Generate or update files without installing dependencies
  --preflight-only Stop after printing stack-aware readiness checks
  --yes, -y        Use defaults without prompts
  --output <dir>   Write the generated project to a custom directory
  --name <name>    Override the generated project name
  --help, -h       Show this help message
  --version, -v    Show the current CLI version

Examples:
  npx @ali-dev11/devforge@latest
  npx @ali-dev11/devforge@latest doctor
  npx @ali-dev11/devforge@latest init --config ./devforge.config.json --output ./my-app
  npx @ali-dev11/devforge@latest init --yes --save-config
  npx @ali-dev11/devforge@latest add docker
  npx @ali-dev11/devforge@latest init --yes --skip-install --output ./my-app
  devforge add testing --skip-install
  devforge init --preflight-only
  devforge init --resume
`);
}

function printVersion(): void {
  console.log(DEVFORGE_VERSION);
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);

  if (options.command === "help") {
    printHelp();
    return;
  }

  if (options.command === "version") {
    printVersion();
    return;
  }

  if (options.command === "doctor") {
    await runDoctorCommand();
    return;
  }

  if (options.command === "add") {
    await runAddCommand(options);
    return;
  }

  await runInitCommand(options);
}
