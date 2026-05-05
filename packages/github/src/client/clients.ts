import { graphql } from '@octokit/graphql';
import { Octokit } from '@octokit/rest';

/**
 * REST client using a PAT or installation access token.
 */
export function createOctokit(authToken: string): Octokit {
  return new Octokit({ auth: authToken });
}

/**
 * GraphQL client bound to the same token (Projects v2, etc.).
 */
export function createGraphqlClient(authToken: string) {
  return graphql.defaults({
    headers: {
      authorization: `token ${authToken}`,
    },
  });
}
