#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const WEBSITE_ROOT = path.resolve(__dirname, "..");
const PYTHON_DIR = path.resolve(WEBSITE_ROOT, "..", "python");
const APP_DIR = path.resolve(WEBSITE_ROOT, "app");

const MARKDOWN_PATTERN = /\.md$/i;

// SYNC PYTHON MARKDOWN LINKS
/**
 * Creates or updates symlinks in app/ for each markdown file in ../python.
 */
function syncPythonMarkdownLinks() {
  const entries = fs.readdirSync(PYTHON_DIR, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && MARKDOWN_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (!fs.existsSync(APP_DIR)) {
    throw new Error(`App directory not found: ${APP_DIR}`);
  }

  // create or replace the expected symlink for each markdown file
  for (const fileName of markdownFiles) {
    const sourcePath = path.join(PYTHON_DIR, fileName);
    const targetPath = path.join(APP_DIR, fileName);

    if (fs.existsSync(targetPath) || fs.lstatSync(targetPath, { throwIfNoEntry: false })) {
      fs.rmSync(targetPath, { force: true, recursive: true });
    }

    fs.symlinkSync(sourcePath, targetPath);
    console.log(`linked ${targetPath} -> ${sourcePath}`);
  }

  console.log(`synced ${markdownFiles.length} markdown links`);
}

// RUN SCRIPT
/**
 * Executes link synchronization and exits with a failure code if it errors.
 */
function runScript() {
  try {
    syncPythonMarkdownLinks();
  } catch (error) {
    console.error("failed to sync python markdown links");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

runScript();
