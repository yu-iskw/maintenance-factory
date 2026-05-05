/** Minimal Projects v2 node id resolver; extend with full field queries in reconciler. */
export const projectV2ItemFieldsFragment = `
  fragment ItemFields on ProjectV2Item {
    id
    content {
      ... on PullRequest {
        number
        repository {
          nameWithOwner
        }
      }
      ... on Issue {
        number
        repository {
          nameWithOwner
        }
      }
    }
  }
`;

export type GraphqlExecutor = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
