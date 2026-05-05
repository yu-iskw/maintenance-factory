/**
 * GitHub Projects (v2) GraphQL mutations — RFC §19.1 item create/update.
 * Callers resolve `projectId`, `contentId` (Issue/PR node id), and field/option IDs via config or prior queries.
 *
 * @see https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
 */

/** Link an existing Issue or Pull Request to a Project board. */
export const MUTATION_ADD_PROJECT_V2_ITEM_BY_ID = `
mutation AddProjectV2ItemById($input: AddProjectV2ItemByIdInput!) {
  addProjectV2ItemById(input: $input) {
    item {
      id
    }
  }
}
`;

export interface AddProjectV2ItemByIdVariables {
  input: {
    projectId: string;
    contentId: string;
  };
}

/** Update a single field on a Project item (text, number, date, or single-select option id). */
export const MUTATION_UPDATE_PROJECT_V2_ITEM_FIELD_VALUE = `
mutation UpdateProjectV2ItemFieldValue($input: UpdateProjectV2ItemFieldValueInput!) {
  updateProjectV2ItemFieldValue(input: $input) {
    projectV2Item {
      id
    }
  }
}
`;

export type ProjectV2FieldValueInput =
  | { text: string }
  | { number: number }
  | { date: string }
  | { singleSelectOptionId: string }
  | { iterationId: string }
  | { milestoneId: string }
  | { userIds: string[] }
  | { labelIds: string[] }
  | { repositoryId: string };

export interface UpdateProjectV2ItemFieldValueVariables {
  input: {
    projectId: string;
    itemId: string;
    fieldId: string;
    value: ProjectV2FieldValueInput;
  };
}
