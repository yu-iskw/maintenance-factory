import { describe, expect, it, vi } from 'vitest';

import {
  ensurePullRequestInProjectV2,
  findProjectV2ItemIdForContentInProject,
} from './ensure-project-pr-item.js';

import type { GraphqlExecutor } from './projects-v2.js';

describe('ensurePullRequestInProjectV2', () => {
  it('returns existing item when PR is already on the project', async () => {
    const graphql = vi.fn(async () => ({
      node: {
        projectItems: {
          nodes: [{ id: 'PVTI_existing', project: { id: 'PVT_project' } }],
        },
      },
    })) as unknown as GraphqlExecutor;

    const id = await ensurePullRequestInProjectV2(graphql, {
      projectNodeId: 'PVT_project',
      contentNodeId: 'PR_kw',
    });
    expect(id).toBe('PVTI_existing');
    expect(graphql).toHaveBeenCalledTimes(1);
  });

  it('adds PR to project when not yet linked', async () => {
    const graphql = vi.fn(async (query: string): Promise<Record<string, unknown>> => {
      if (query.includes('PullRequestProjectItems')) {
        return { node: { projectItems: { nodes: [] } } };
      }
      return { addProjectV2ItemById: { item: { id: 'PVTI_new' } } };
    }) as unknown as GraphqlExecutor;

    const id = await ensurePullRequestInProjectV2(graphql, {
      projectNodeId: 'PVT_project',
      contentNodeId: 'PR_kw',
    });
    expect(id).toBe('PVTI_new');
    expect(graphql).toHaveBeenCalledTimes(2);
  });
});

describe('findProjectV2ItemIdForContentInProject', () => {
  it('returns null when no matching project', async () => {
    const graphql = vi.fn(async () => ({
      node: {
        projectItems: {
          nodes: [{ id: 'PVTI_x', project: { id: 'PVT_other' } }],
        },
      },
    })) as unknown as GraphqlExecutor;

    const id = await findProjectV2ItemIdForContentInProject(graphql, {
      projectNodeId: 'PVT_project',
      contentNodeId: 'PR_kw',
    });
    expect(id).toBeNull();
  });
});
