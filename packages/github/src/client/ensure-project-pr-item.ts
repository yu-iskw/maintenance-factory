import {
  MUTATION_ADD_PROJECT_V2_ITEM_BY_ID,
  type AddProjectV2ItemByIdVariables,
} from './projects-v2-mutations.js';

import type { GraphqlExecutor } from './projects-v2.js';

const QUERY_NODE_PROJECT_ITEMS = `
query PullRequestProjectItems($id: ID!) {
  node(id: $id) {
    ... on PullRequest {
      projectItems(first: 50) {
        nodes {
          id
          project {
            id
          }
        }
      }
    }
  }
}
`;

interface ProjectItemsQueryResult {
  node: {
    projectItems?: { nodes: Array<{ id: string; project: { id: string } }> };
  } | null;
}

interface AddItemMutationResult {
  addProjectV2ItemById?: { item?: { id: string } | null } | null;
}

/**
 * If this PR is already on the given Project, return that ProjectV2Item node id; else null.
 */
export async function findProjectV2ItemIdForContentInProject(
  graphql: GraphqlExecutor,
  args: { projectNodeId: string; contentNodeId: string },
): Promise<string | null> {
  const data = await graphql<ProjectItemsQueryResult>(QUERY_NODE_PROJECT_ITEMS, {
    id: args.contentNodeId,
  });
  const nodes = data.node?.projectItems?.nodes ?? [];
  for (const n of nodes) {
    if (n.project.id === args.projectNodeId) {
      return n.id;
    }
  }
  return null;
}

/**
 * Idempotently link a Pull Request (by GraphQL node id) to a Projects v2 board.
 * Returns the ProjectV2Item node id.
 */
export async function ensurePullRequestInProjectV2(
  graphql: GraphqlExecutor,
  args: { projectNodeId: string; contentNodeId: string },
): Promise<string> {
  const existing = await findProjectV2ItemIdForContentInProject(graphql, args);
  if (existing) {
    return existing;
  }
  const variables: AddProjectV2ItemByIdVariables = {
    input: {
      projectId: args.projectNodeId,
      contentId: args.contentNodeId,
    },
  };
  const out = await graphql<AddItemMutationResult>(
    MUTATION_ADD_PROJECT_V2_ITEM_BY_ID,
    variables as unknown as Record<string, unknown>,
  );
  const id = out.addProjectV2ItemById?.item?.id;
  if (!id) {
    throw new Error('addProjectV2ItemById did not return a project item id');
  }
  return id;
}
