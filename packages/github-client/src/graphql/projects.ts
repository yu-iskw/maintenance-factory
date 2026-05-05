import type { ProjectItem, TaskStatus, TaskType } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

const PROJECT_ITEM_FRAGMENT = `
  fragment ProjectItemFields on ProjectV2Item {
    id
    type
    fieldValues(first: 30) {
      nodes {
        ... on ProjectV2ItemFieldTextValue {
          text
          field { ... on ProjectV2FieldCommon { name } }
        }
        ... on ProjectV2ItemFieldSingleSelectValue {
          name
          field { ... on ProjectV2FieldCommon { name } }
        }
      }
    }
    content {
      ... on PullRequest { url number }
      ... on Issue { url number }
      ... on DraftIssue { title body }
    }
  }
`;

interface FieldNode {
  text?: string;
  name?: string;
  field?: { name?: string };
}

function extractFields(item: { fieldValues?: { nodes?: FieldNode[] } }): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const node of item.fieldValues?.nodes ?? []) {
    const fieldName = node.field?.name;
    const value = node.text ?? node.name;
    if (fieldName && value) {
      // eslint-disable-next-line security/detect-object-injection
      fields[fieldName] = value;
    }
  }
  return fields;
}

function mapToProjectItem(item: {
  id: string;
  fieldValues?: { nodes?: FieldNode[] };
}): ProjectItem {
  const fields = extractFields(item);
  return {
    id: item.id,
    repoFullName: fields['Repository'] ?? '',
    status: (fields['Status'] ?? 'Inbox') as TaskStatus,
    maintenanceType: (fields['Maintenance Type'] ?? 'repo_hygiene_scan') as TaskType,
    severity: (fields['Severity'] ?? 'Low') as ProjectItem['severity'],
    risk: (fields['Risk'] ?? 'Low') as ProjectItem['risk'],
    repoCriticality: (fields['Repo Criticality'] ?? 'standard') as ProjectItem['repoCriticality'],
    agentEligible: fields['Agent Eligible'] === 'true',
    scheduledEligible: fields['Scheduled Eligible'] === 'true',
    agentStatus: (fields['Agent Status'] ?? 'Not Run') as ProjectItem['agentStatus'],
    requiredReview: [],
    compositeKey: fields['Composite Key'] ?? '',
    prUrl: fields['PR'] ?? undefined,
    cursorRunId: fields['Cursor Run ID'] ?? undefined,
    lastRunSummary: fields['Last Run Summary'] ?? undefined,
    lastValidation: fields['Last Validation'] ?? undefined,
    blockedReason: fields['Blocked Reason'] ?? undefined,
  };
}

export async function getProjectItems(
  octokit: Octokit,
  projectId: string,
  statusFilter?: TaskStatus[],
): Promise<ProjectItem[]> {
  const query = `
    query GetProjectItems($projectId: ID!, $cursor: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { ${PROJECT_ITEM_FRAGMENT} }
          }
        }
      }
    }
    ${PROJECT_ITEM_FRAGMENT}
  `;

  type GraphqlResult = {
    node: {
      items: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        nodes: Array<{ id: string; fieldValues?: { nodes?: FieldNode[] } }>;
      };
    };
  };

  const items: ProjectItem[] = [];
  let cursor: string | null = null;

  do {
    const result: GraphqlResult = await octokit.graphql<GraphqlResult>(query, {
      projectId,
      cursor,
    });

    const { nodes, pageInfo } = result.node.items;
    for (const node of nodes) {
      const item = mapToProjectItem(node);
      if (!statusFilter || statusFilter.includes(item.status)) {
        items.push(item);
      }
    }
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  return items;
}

export async function createProjectItem(
  octokit: Octokit,
  projectId: string,
  contentId: string,
): Promise<string> {
  const result = await octokit.graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
    `mutation AddItem($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId },
  );
  return result.addProjectV2ItemById.item.id;
}

export async function updateProjectItemTextField(
  octokit: Octokit,
  projectId: string,
  itemId: string,
  fieldId: string,
  value: string,
): Promise<void> {
  await octokit.graphql(
    `mutation UpdateTextField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { text: $value }
      }) { projectV2Item { id } }
    }`,
    { projectId, itemId, fieldId, value },
  );
}
