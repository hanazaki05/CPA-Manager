import { describe, expect, it } from 'vitest';
import type { MonitoringAccountRow } from './hooks/useMonitoringData';
import {
  ACCOUNT_OVERVIEW_CARD_PAGE_SIZE_OPTIONS,
  ACCOUNT_OVERVIEW_CARD_METRIC_KEYS,
  DEFAULT_ACCOUNT_SORT,
  buildMonitoringAccountAuthState,
  normalizeAccountOverviewPageSize,
  normalizeAccountOverviewMode,
  normalizeAccountOverviewUiState,
  normalizeAccountSortState,
  sortAccountRows,
} from './accountOverviewState';
import type { AuthFileItem } from '@/types';

const createAccountRow = (
  overrides: Partial<MonitoringAccountRow> = {}
): MonitoringAccountRow => ({
  id: overrides.id ?? 'account',
  account: overrides.account ?? 'account@example.com',
  displayAccount: overrides.displayAccount ?? overrides.account ?? 'account@example.com',
  accountMasked: overrides.accountMasked ?? 'acc***@example.com',
  authLabels: overrides.authLabels ?? [],
  authIndices: overrides.authIndices ?? [],
  channels: overrides.channels ?? [],
  totalCalls: overrides.totalCalls ?? 0,
  successCalls: overrides.successCalls ?? 0,
  failureCalls: overrides.failureCalls ?? 0,
  successRate: overrides.successRate ?? 1,
  inputTokens: overrides.inputTokens ?? 0,
  outputTokens: overrides.outputTokens ?? 0,
  cachedTokens: overrides.cachedTokens ?? 0,
  totalTokens: overrides.totalTokens ?? 0,
  totalCost: overrides.totalCost ?? 0,
  averageLatencyMs: overrides.averageLatencyMs ?? null,
  lastSeenAt: overrides.lastSeenAt ?? 0,
  recentPattern: overrides.recentPattern ?? [],
  models: overrides.models ?? [],
});

describe('accountOverviewState', () => {
  it('defaults invalid overview modes to table', () => {
    expect(normalizeAccountOverviewMode(undefined)).toBe('table');
    expect(normalizeAccountOverviewMode('grid')).toBe('table');
    expect(normalizeAccountOverviewMode('card')).toBe('card');
  });

  it('normalizes persisted overview ui state', () => {
    expect(
      normalizeAccountOverviewUiState({
        mode: 'card',
        sort: { key: 'totalCost', direction: 'asc' },
      })
    ).toEqual({
      mode: 'card',
      sort: { key: 'totalCost', direction: 'asc' },
    });

    expect(normalizeAccountOverviewUiState({ mode: 'grid', sort: { key: 'bad' } })).toEqual({
      mode: 'table',
      sort: DEFAULT_ACCOUNT_SORT,
    });
  });

  it('keeps the existing default account sort contract', () => {
    expect(DEFAULT_ACCOUNT_SORT).toEqual({ key: 'lastSeenAt', direction: 'desc' });
    expect(normalizeAccountSortState(undefined)).toEqual(DEFAULT_ACCOUNT_SORT);
  });

  it('sorts rows by the shared account sort state', () => {
    const slowAccount = createAccountRow({
      id: 'slow',
      account: 'slow@example.com',
      totalCalls: 4,
      totalCost: 3,
      lastSeenAt: 10,
    });
    const busyAccount = createAccountRow({
      id: 'busy',
      account: 'busy@example.com',
      totalCalls: 25,
      totalCost: 1,
      lastSeenAt: 2,
    });

    expect(
      sortAccountRows([slowAccount, busyAccount], { key: 'totalCalls', direction: 'desc' }).map(
        (row) => row.id
      )
    ).toEqual(['busy', 'slow']);

    expect(
      sortAccountRows([slowAccount, busyAccount], { key: 'lastSeenAt', direction: 'asc' }).map(
        (row) => row.id
      )
    ).toEqual(['busy', 'slow']);
  });

  it('exposes the requested metric keys for card mode', () => {
    expect(ACCOUNT_OVERVIEW_CARD_METRIC_KEYS).toEqual([
      'total-tokens',
      'input-tokens',
      'output-tokens',
      'cached-tokens',
    ]);
  });

  it('uses 3-based page sizes for card mode and normalizes invalid values', () => {
    expect(ACCOUNT_OVERVIEW_CARD_PAGE_SIZE_OPTIONS).toEqual([9, 12, 18, 24]);
    expect(normalizeAccountOverviewPageSize(10, 'card')).toBe(9);
    expect(normalizeAccountOverviewPageSize(18, 'card')).toBe(18);
    expect(normalizeAccountOverviewPageSize(12, 'table')).toBe(10);
  });

  it('builds merged auth state for an account card', () => {
    const authFilesByIndex = new Map<string, AuthFileItem>([
      [
        '1',
        {
          name: 'alpha.json',
          authIndex: '1',
          disabled: false,
          recent_requests: [{ success: 2, failed: 1 }],
        },
      ],
      [
        '2',
        {
          name: 'beta.json',
          authIndex: '2',
          disabled: true,
          recent_requests: [{ success: 1, failed: 0 }],
        },
      ],
    ]);

    const result = buildMonitoringAccountAuthState(['1', '2'], authFilesByIndex);

    expect(result.enabledState).toBe('mixed');
    expect(result.files.map((file) => file.name)).toEqual(['alpha.json', 'beta.json']);
    expect(result.toggleableFileNames).toEqual(['alpha.json', 'beta.json']);
    expect(result.statusData.totalSuccess).toBe(3);
    expect(result.statusData.totalFailure).toBe(1);
  });
});
