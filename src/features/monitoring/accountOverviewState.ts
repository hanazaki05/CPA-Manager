import type { AuthFileItem } from '@/types';
import {
  mergeRecentRequestBucketGroups,
  normalizeRecentRequestAuthIndex,
  normalizeRecentRequestBuckets,
  statusBarDataFromRecentRequests,
  type StatusBarData,
} from '@/utils/recentRequests';
import type { MonitoringAccountRow } from './hooks/useMonitoringData';

export type MonitoringAccountOverviewMode = 'table' | 'card';

export type AccountSortKey =
  | 'totalCalls'
  | 'successCalls'
  | 'failureCalls'
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'cachedTokens'
  | 'totalCost'
  | 'lastSeenAt';

export type AccountSortDirection = 'asc' | 'desc';

export type AccountSortState = {
  key: AccountSortKey;
  direction: AccountSortDirection;
};

export const ACCOUNT_OVERVIEW_MODE_STORAGE_KEY = 'monitoring.accountOverviewMode';
export const ACCOUNT_OVERVIEW_UI_STATE_STORAGE_KEY = 'monitoring.accountOverviewUiState';
export const ACCOUNT_OVERVIEW_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const ACCOUNT_OVERVIEW_CARD_PAGE_SIZE_OPTIONS = [9, 12, 18, 24] as const;

export const ACCOUNT_OVERVIEW_CARD_METRIC_KEYS = [
  'total-tokens',
  'input-tokens',
  'output-tokens',
  'cached-tokens',
] as const;

export const DEFAULT_ACCOUNT_SORT: AccountSortState = {
  key: 'lastSeenAt',
  direction: 'desc',
};

export type MonitoringAccountEnabledState = 'enabled' | 'disabled' | 'mixed' | 'unavailable';
export type MonitoringAccountOverviewUiState = {
  mode: MonitoringAccountOverviewMode;
  sort: AccountSortState;
};

export type MonitoringAccountAuthState = {
  files: AuthFileItem[];
  toggleableFileNames: string[];
  enabledState: MonitoringAccountEnabledState;
  statusData: StatusBarData;
};

const ACCOUNT_SORT_KEYS = [
  'totalCalls',
  'successCalls',
  'failureCalls',
  'totalTokens',
  'inputTokens',
  'outputTokens',
  'cachedTokens',
  'totalCost',
  'lastSeenAt',
] as const;
const ACCOUNT_SORT_KEY_SET = new Set<AccountSortKey>(ACCOUNT_SORT_KEYS);
const ACCOUNT_SORT_DIRECTION_SET = new Set<AccountSortDirection>(['asc', 'desc']);

export const normalizeAccountOverviewMode = (
  value: unknown
): MonitoringAccountOverviewMode => (value === 'card' ? 'card' : 'table');

export const normalizeAccountSortKey = (value: unknown): AccountSortKey | null =>
  typeof value === 'string' && ACCOUNT_SORT_KEY_SET.has(value as AccountSortKey)
    ? (value as AccountSortKey)
    : null;

export const normalizeAccountSortDirection = (
  value: unknown
): AccountSortDirection | null =>
  typeof value === 'string' && ACCOUNT_SORT_DIRECTION_SET.has(value as AccountSortDirection)
    ? (value as AccountSortDirection)
    : null;

export const normalizeAccountSortState = (value: unknown): AccountSortState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_ACCOUNT_SORT;
  }

  const record = value as Record<string, unknown>;
  const key = normalizeAccountSortKey(record.key);
  const direction = normalizeAccountSortDirection(record.direction);

  if (!key || !direction) {
    return DEFAULT_ACCOUNT_SORT;
  }

  return {
    key,
    direction,
  };
};

export const normalizeAccountOverviewUiState = (
  value: unknown
): MonitoringAccountOverviewUiState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      mode: 'table',
      sort: DEFAULT_ACCOUNT_SORT,
    };
  }

  const record = value as Record<string, unknown>;
  return {
    mode: normalizeAccountOverviewMode(record.mode),
    sort: normalizeAccountSortState(record.sort),
  };
};

export const normalizeAccountOverviewPageSize = (
  value: number,
  mode: MonitoringAccountOverviewMode
) => {
  const options: readonly number[] =
    mode === 'card'
      ? ACCOUNT_OVERVIEW_CARD_PAGE_SIZE_OPTIONS
      : ACCOUNT_OVERVIEW_TABLE_PAGE_SIZE_OPTIONS;
  return options.includes(value) ? value : options[0];
};

const getAccountSortValue = (row: MonitoringAccountRow, key: AccountSortKey) => {
  switch (key) {
    case 'totalCalls':
      return row.totalCalls;
    case 'successCalls':
      return row.successCalls;
    case 'failureCalls':
      return row.failureCalls;
    case 'totalTokens':
      return row.totalTokens;
    case 'inputTokens':
      return row.inputTokens;
    case 'outputTokens':
      return row.outputTokens;
    case 'cachedTokens':
      return row.cachedTokens;
    case 'totalCost':
      return row.totalCost;
    case 'lastSeenAt':
    default:
      return row.lastSeenAt;
  }
};

export const compareAccountRowsByDefault = (
  left: MonitoringAccountRow,
  right: MonitoringAccountRow
) =>
  right.lastSeenAt - left.lastSeenAt ||
  right.totalCalls - left.totalCalls ||
  right.totalCost - left.totalCost ||
  left.account.localeCompare(right.account);

export const sortAccountRows = (
  rows: MonitoringAccountRow[],
  sortState: AccountSortState = DEFAULT_ACCOUNT_SORT
) => {
  const directionFactor = sortState.direction === 'desc' ? -1 : 1;

  return [...rows].sort((left, right) => {
    const valueDiff =
      getAccountSortValue(left, sortState.key) - getAccountSortValue(right, sortState.key);
    if (valueDiff !== 0) {
      return valueDiff * directionFactor;
    }

    return compareAccountRowsByDefault(left, right);
  });
};

const readStoredModeValue = () => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNT_OVERVIEW_MODE_STORAGE_KEY);
    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    try {
      return window.localStorage.getItem(ACCOUNT_OVERVIEW_MODE_STORAGE_KEY);
    } catch {
      return null;
    }
  }
};

export const readAccountOverviewMode = (): MonitoringAccountOverviewMode =>
  normalizeAccountOverviewMode(readStoredModeValue());

export const readAccountOverviewUiState = (): MonitoringAccountOverviewUiState => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {
      mode: 'table',
      sort: DEFAULT_ACCOUNT_SORT,
    };
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNT_OVERVIEW_UI_STATE_STORAGE_KEY);
    if (raw) {
      return normalizeAccountOverviewUiState(JSON.parse(raw));
    }
  } catch {
    // Ignore storage failures and fall back to legacy mode key.
  }

  return {
    mode: readAccountOverviewMode(),
    sort: DEFAULT_ACCOUNT_SORT,
  };
};

export const writeAccountOverviewMode = (mode: MonitoringAccountOverviewMode) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      ACCOUNT_OVERVIEW_MODE_STORAGE_KEY,
      JSON.stringify(normalizeAccountOverviewMode(mode))
    );
  } catch {
    // Ignore storage failures and keep the runtime mode in memory only.
  }
};

export const writeAccountOverviewUiState = (state: MonitoringAccountOverviewUiState) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  const normalizedState = normalizeAccountOverviewUiState(state);

  try {
    window.localStorage.setItem(
      ACCOUNT_OVERVIEW_UI_STATE_STORAGE_KEY,
      JSON.stringify(normalizedState)
    );
  } catch {
    // Ignore storage failures and keep the runtime state in memory only.
  }

  writeAccountOverviewMode(normalizedState.mode);
};

const isRuntimeOnlyAuthFile = (file: AuthFileItem) => {
  const value = file.runtimeOnly ?? file['runtime_only'];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
};

export const buildMonitoringAccountAuthState = (
  authIndices: string[],
  authFilesByAuthIndex: Map<string, AuthFileItem>
): MonitoringAccountAuthState => {
  const files = Array.from(
    authIndices.reduce<Map<string, AuthFileItem>>((map, authIndex) => {
      const normalizedAuthIndex = normalizeRecentRequestAuthIndex(authIndex);
      if (!normalizedAuthIndex) return map;

      const file = authFilesByAuthIndex.get(normalizedAuthIndex);
      if (!file || map.has(file.name)) return map;

      map.set(file.name, file);
      return map;
    }, new Map())
  )
    .map(([, file]) => file)
    .sort((left, right) => left.name.localeCompare(right.name));

  const toggleableFiles = files.filter((file) => !isRuntimeOnlyAuthFile(file));
  const disabledCount = toggleableFiles.filter((file) => file.disabled === true).length;
  const enabledState: MonitoringAccountEnabledState =
    toggleableFiles.length === 0
      ? 'unavailable'
      : disabledCount === toggleableFiles.length
        ? 'disabled'
        : disabledCount === 0
          ? 'enabled'
          : 'mixed';

  const mergedRecentRequests = mergeRecentRequestBucketGroups(
    files.map((file) => normalizeRecentRequestBuckets(file.recent_requests ?? file.recentRequests))
  );

  return {
    files,
    toggleableFileNames: toggleableFiles.map((file) => file.name),
    enabledState,
    statusData: statusBarDataFromRecentRequests(mergedRecentRequests),
  };
};
