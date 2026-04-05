"use strict";

// CHECK NPM CWD
/**
 * Exits with a clear error when Windows npm is invoked with a UNC working directory.
 * cmd.exe cannot use UNC paths as CWD, which breaks package install lifecycle scripts.
 */

const process = require("node:process");

// detect unc-style cwd on windows
const cwd = process.cwd();
if (process.platform === "win32" && cwd.startsWith("\\\\")) {
    console.error(`
npm was started with a Windows UNC path as the current directory:
  ${cwd}

cmd.exe cannot use UNC paths as the current directory, so install scripts fail
(for example they resolve to C:\\Windows\\... instead of your project).

Fix: run npm from a shell inside WSL using the Linux filesystem path, for example:
  cd /Ice-AI/website && npm ci

Alternatively, clone or copy the project to a Windows drive (e.g. C:\\dev\\Ice-AI\\website)
and use Windows Node/npm there only.
`);
    process.exit(1);
}
