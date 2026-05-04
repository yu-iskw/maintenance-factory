import type { graphql } from '@octokit/graphql';

export type ProjectFieldCatalog = {
  projectNodeId: string;
  fieldsByName: Record<
    string,
    {
      fieldId: string;
      optionsByName?: Record<string, string>;
    }
  >;
};

type GraphqlFn = ReturnType<typeof graphql.defaults>;

const PROJECT_FIELDS_QUERY = `
  query ProjectFields($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        id
        fields(first: 100) {
          nodes {
            __typename
            ... on ProjectV2Field {
              id
              name
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchProjectFieldCatalog(
  gql: GraphqlFn,
  orgLogin: string,
  projectNumber: number,
): Promise<ProjectFieldCatalog> {
  const data = (await gql(PROJECT_FIELDS_QUERY, {
    org: orgLogin,
    number: projectNumber,
  })) as {
    organization?: {
      projectV2?: {
        id: string;
        fields?: {
          nodes: Array<{
            __typename: string;
            id?: string;
            name?: string;
            options?: Array<{ id: string; name: string }>;
          }>;
        };
      };
    };
  };

  const project = data.organization?.projectV2;
  if (!project?.id) {
    throw new Error(`Project not found for org=${orgLogin} number=${projectNumber}`);
  }

  const fieldsByName: ProjectFieldCatalog['fieldsByName'] = {};
  /* eslint-disable security/detect-object-injection -- field names from GitHub API response */
  for (const node of project.fields?.nodes ?? []) {
    const name = node.name;
    const id = node.id;
    if (!name || !id) {
      continue;
    }
    const optionsByName: Record<string, string> = {};
    if (node.options) {
      for (const opt of node.options) {
        optionsByName[opt.name] = opt.id;
      }
    }
    fieldsByName[name] = {
      fieldId: id,
      optionsByName: Object.keys(optionsByName).length > 0 ? optionsByName : undefined,
    };
  }
  /* eslint-enable security/detect-object-injection */

  return { projectNodeId: project.id, fieldsByName };
}

const ADD_DRAFT_MUTATION = `
  mutation AddDraft($input: AddProjectV2DraftIssueInput!) {
    addProjectV2DraftIssue(input: $input) {
      projectItem {
        id
      }
    }
  }
`;

export async function addDraftProjectItem(input: {
  gql: GraphqlFn;
  projectNodeId: string;
  title: string;
  body: string;
}): Promise<string> {
  const data = (await input.gql(ADD_DRAFT_MUTATION, {
    input: {
      projectId: input.projectNodeId,
      title: input.title,
      body: input.body,
    },
  })) as {
    addProjectV2DraftIssue?: { projectItem?: { id?: string } };
  };
  const itemId = data.addProjectV2DraftIssue?.projectItem?.id;
  if (!itemId) {
    throw new Error('addProjectV2DraftIssue did not return projectItem.id');
  }
  return itemId;
}

const UPDATE_FIELD_MUTATION = `
  mutation UpdateField($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
        id
      }
    }
  }
`;

export async function setProjectSingleSelect(input: {
  gql: GraphqlFn;
  projectNodeId: string;
  itemId: string;
  fieldId: string;
  optionId: string;
}): Promise<void> {
  await input.gql(UPDATE_FIELD_MUTATION, {
    input: {
      projectId: input.projectNodeId,
      itemId: input.itemId,
      fieldId: input.fieldId,
      value: { singleSelectOptionId: input.optionId },
    },
  });
}

export async function setProjectTextField(input: {
  gql: GraphqlFn;
  projectNodeId: string;
  itemId: string;
  fieldId: string;
  text: string;
}): Promise<void> {
  await input.gql(UPDATE_FIELD_MUTATION, {
    input: {
      projectId: input.projectNodeId,
      itemId: input.itemId,
      fieldId: input.fieldId,
      value: { text: input.text },
    },
  });
}

export async function setProjectBooleanField(input: {
  gql: GraphqlFn;
  projectNodeId: string;
  itemId: string;
  fieldId: string;
  value: boolean;
}): Promise<void> {
  await input.gql(UPDATE_FIELD_MUTATION, {
    input: {
      projectId: input.projectNodeId,
      itemId: input.itemId,
      fieldId: input.fieldId,
      value: { boolean: input.value },
    },
  });
}
