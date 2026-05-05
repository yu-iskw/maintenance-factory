import {
  MUTATION_UPDATE_PROJECT_V2_ITEM_FIELD_VALUE,
  type ProjectV2FieldValueInput,
  type UpdateProjectV2ItemFieldValueVariables,
} from './projects-v2-mutations.js';

/** Shape produced by the reconciler (`ProjectFieldUpdate`); kept local to avoid package cycles. */
export interface ProjectFieldUpdateLike {
  fieldName: string;
  value: string | boolean;
}

export interface ResolvedProjectFields {
  projectNodeId: string;
  /** Reconciler `fieldName` -> Projects V2 custom field node id */
  customFieldIdsByName: Record<string, string>;
  /**
   * Single-select fields: `fieldName` -> (board label as emitted by reconciler -> option node id).
   * When present for a field, matching string values use `singleSelectOptionId`; otherwise `text` is used.
   */
  singleSelectOptionIdsByFieldAndLabel?: Record<string, Record<string, string>>;
}

export interface ProjectV2FieldMutationCall {
  query: typeof MUTATION_UPDATE_PROJECT_V2_ITEM_FIELD_VALUE;
  variables: UpdateProjectV2ItemFieldValueVariables;
}

function toFieldValue(
  fieldName: string,
  raw: string | boolean,
  resolved: ResolvedProjectFields,
): ProjectV2FieldValueInput {
  const valueStr = typeof raw === 'boolean' ? (raw ? 'true' : 'false') : raw;
  /* eslint-disable security/detect-object-injection -- keys come from reconciler field names and operator-supplied option maps */
  const labelMap = resolved.singleSelectOptionIdsByFieldAndLabel?.[fieldName];
  if (labelMap) {
    const opt = labelMap[valueStr];
    /* eslint-enable security/detect-object-injection */
    if (opt !== undefined) {
      return { singleSelectOptionId: opt };
    }
  }
  return { text: valueStr };
}

/**
 * Turn reconciler-style field updates into Projects v2 `updateProjectV2ItemFieldValue` calls.
 * Skips updates when `fieldName` is unknown in `customFieldIdsByName`.
 */
export function fieldUpdatesToProjectV2Mutations(
  itemNodeId: string,
  updates: ProjectFieldUpdateLike[],
  resolved: ResolvedProjectFields,
): ProjectV2FieldMutationCall[] {
  const out: ProjectV2FieldMutationCall[] = [];
  for (const u of updates) {
    const fieldId = resolved.customFieldIdsByName[u.fieldName];
    if (!fieldId) {
      continue;
    }
    const value = toFieldValue(u.fieldName, u.value, resolved);
    out.push({
      query: MUTATION_UPDATE_PROJECT_V2_ITEM_FIELD_VALUE,
      variables: {
        input: {
          projectId: resolved.projectNodeId,
          itemId: itemNodeId,
          fieldId,
          value,
        },
      },
    });
  }
  return out;
}
