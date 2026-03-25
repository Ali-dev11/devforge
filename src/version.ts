import { readFileSync } from "node:fs";

type PackageMetadata = {
  name?: string;
  author?: string;
  version?: string;
};

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageMetadata;

export const DEVFORGE_VERSION = packageMetadata.version ?? "0.0.0";
export const DEVFORGE_PACKAGE_NAME = packageMetadata.name ?? "@ali-dev11/devforge";
export const DEVFORGE_AUTHOR = packageMetadata.author ?? "Ali-dev11";
