/* eslint-disable no-console */
import debug from 'debug';
import * as vscode from "vscode";

const HYPERLANE_NS = 'hyperlane';

let out;

// Default root logger for use in utils/scripts
// export const logger = debug(HYPERLANE_NS);
// export const error = debug(`${HYPERLANE_NS}:ERROR`);
export const logger = {
  log: (...args: any[]) => out.appendLine(args),
}

export function createLogger(namespace: string, isError = false) {
  out = vscode.window.createOutputChannel("Hyperlane");
  return out;
  // return isError ? error.extend(namespace) : logger.extend(namespace);
}

// Ensure hyperlane logging is enabled
const activeNamespaces = debug.disable();
const otherNamespaces = activeNamespaces
  .split(',')
  .filter((ns) => ns.includes(HYPERLANE_NS));
const hypNamespaces = `${HYPERLANE_NS},${HYPERLANE_NS}:*`;
debug.enable(
  otherNamespaces ? `${otherNamespaces},${hypNamespaces}` : `${hypNamespaces}`,
);
