import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@cursor/sdk', () => ({
  Agent: {
    prompt: vi.fn().mockResolvedValue({ status: 'completed' }),
  },
}));

describe('runMaintenanceCursorPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('throws when API key is missing', async () => {
    const { runMaintenanceCursorPrompt } = await import('./sdk-run.js');
    await expect(runMaintenanceCursorPrompt({ prompt: 'x' })).rejects.toThrow(/CURSOR_API_KEY/);
  });

  it('calls Agent.prompt when API key is set', async () => {
    const { Agent } = await import('@cursor/sdk');
    vi.stubEnv('CURSOR_API_KEY', 'test-key');
    const { runMaintenanceCursorPrompt } = await import('./sdk-run.js');
    await runMaintenanceCursorPrompt({ prompt: 'do maintenance' });
    expect(Agent.prompt).toHaveBeenCalledWith(
      'do maintenance',
      expect.objectContaining({ apiKey: 'test-key', name: 'maintenance-factory' }),
    );
  });
});
