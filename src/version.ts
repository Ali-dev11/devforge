import { readFileSync } from "node:fs";

type PackageMetadata = {
  version?: string;
};

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageMetadata;

export const DEVFORGE_VERSION = packageMetadata.version ?? "0.0.0";
