import { describe, expect, it } from 'vitest';

import { fieldUpdatesToProjectV2Mutations } from './apply-project-field-updates.js';

describe('fieldUpdatesToProjectV2Mutations', () => {
  it('maps text fields and skips unknown names', () => {
    const calls = fieldUpdatesToProjectV2Mutations(
      'PVTI_item',
      [
        { fieldName: 'Status', value: 'Blocked' },
        { fieldName: 'Unknown', value: 'x' },
      ],
      {
        projectNodeId: 'PVT_proj',
        customFieldIdsByName: { Status: 'FIELD_status' },
        singleSelectOptionIdsByFieldAndLabel: {
          Status: { Blocked: 'opt_blocked' },
        },
      },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].variables.input.fieldId).toBe('FIELD_status');
    expect(calls[0].variables.input.value).toEqual({ singleSelectOptionId: 'opt_blocked' });
  });

  it('falls back to text when no option map matches', () => {
    const calls = fieldUpdatesToProjectV2Mutations(
      'PVTI_item',
      [{ fieldName: 'Last Run Summary', value: 'done' }],
      {
        projectNodeId: 'PVT_proj',
        customFieldIdsByName: { 'Last Run Summary': 'FIELD_summary' },
      },
    );
    expect(calls[0].variables.input.value).toEqual({ text: 'done' });
  });
});
