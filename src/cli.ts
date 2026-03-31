import type { CliOptions } from "./types.js";
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

function assertInitOnlyFlag(currentCommand: CliOptions["command"], flag: string): void {
  if (currentCommand !== "init") {
    throw new Error(`${flag} can only be used with \`devforge init\`.`);
  }
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "init",
    resume: false,
    skipInstall: false,
    preflightOnly: false,
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
  } else
  if (firstArg === "init") {
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
        assertInitOnlyFlag(options.command, "--skip-install");
        options.skipInstall = true;
        break;
      case "--preflight-only":
        assertInitOnlyFlag(options.command, "--preflight-only");
        options.preflightOnly = true;
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

  return options;
}

function printHelp(): void {
  console.log(`DevForge CLI v${DEVFORGE_VERSION}

Usage:
  devforge
  devforge init
  devforge init --resume
  devforge doctor

Commands:
  init            Start a new scaffold session
  doctor          Inspect local machine readiness for DevForge scaffolds
  help            Show command help
  version         Print the current CLI version

Flags:
  --resume         Resume the last saved init session
  --skip-install   Generate files without installing dependencies
  --preflight-only Stop after printing stack-aware readiness checks
  --yes, -y        Use defaults without prompts
  --output <dir>   Write the generated project to a custom directory
  --name <name>    Override the generated project name
  --help, -h       Show this help message
  --version, -v    Show the current CLI version

Examples:
  npx @ali-dev11/devforge@latest
  npx @ali-dev11/devforge@latest doctor
  npx @ali-dev11/devforge@latest init --yes --skip-install --output ./my-app
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

  await runInitCommand(options);
}
