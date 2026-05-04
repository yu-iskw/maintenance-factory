export interface RepoIdentifier {
  owner: string;
  name: string;
  fullName: string;
}

export interface PullRequest {
  number: number;
  url: string;
  title: string;
  state: 'open' | 'closed' | 'merged';
  headRef: string;
  baseRef: string;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
  checksConclusion?: CheckConclusion;
  mergeable?: boolean;
}

export type CheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | 'pending';

export interface CheckStatus {
  state: 'pending' | 'success' | 'failure' | 'error';
  conclusion: CheckConclusion | null;
  totalCount: number;
  failedCount: number;
  pendingCount: number;
}

export interface DependabotAlert {
  number: number;
  state: 'open' | 'dismissed' | 'fixed' | 'auto_dismissed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  packageName: string;
  packageEcosystem: string;
  manifestPath: string;
  fixedIn?: string;
  advisoryUrl?: string;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeScanningAlert {
  number: number;
  state: 'open' | 'closed' | 'dismissed' | 'fixed';
  severity: 'note' | 'warning' | 'error' | 'critical' | 'high' | 'medium' | 'low';
  ruleName: string;
  ruleDescription: string;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepoMetadata {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  language: string | null;
  isArchived: boolean;
  isPrivate: boolean;
  visibility: 'public' | 'private' | 'internal';
  topics: string[];
  pushedAt: Date | null;
  updatedAt: Date;
}
