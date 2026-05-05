import type { AgentOptions, RunResult } from '@cursor/sdk';

export interface MaintenanceSdkLaunchOptions {
  /** Full rendered prompt (RFC §12). */
  prompt: string;
  /** Defaults to `process.env.CURSOR_API_KEY`. */
  apiKey?: string;
  name?: string;
  model?: AgentOptions['model'];
  cloud?: AgentOptions['cloud'];
  local?: AgentOptions['local'];
}

/**
 * Launch a single-shot Cursor agent run for maintenance (branch/PR only — no merge).
 * Requires cloud or local agent configuration per Cursor SDK docs.
 */
export async function runMaintenanceCursorPrompt(
  options: MaintenanceSdkLaunchOptions,
): Promise<RunResult> {
  const apiKey = options.apiKey ?? process.env.CURSOR_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'CURSOR_API_KEY or options.apiKey is required to launch a Cursor maintenance run',
    );
  }
  const { Agent } = await import('@cursor/sdk');
  return Agent.prompt(options.prompt, {
    apiKey,
    name: options.name ?? 'maintenance-factory',
    model: options.model,
    cloud: options.cloud,
    local: options.local,
  });
}
