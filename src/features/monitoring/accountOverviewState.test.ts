import { describe, expect, it } from 'vitest';
import type { MonitoringAccountRow, MonitoringEventRow } from './hooks/useMonitoringData';
import {
  ACCOUNT_OVERVIEW_CARD_PAGE_SIZE_OPTIONS,
  ACCOUNT_OVERVIEW_CARD_METRIC_KEYS,
  DEFAULT_ACCOUNT_SORT,
  buildMonitoringAccountAuthState,
  buildMonitoringAccountStatusDataMap,
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

const createEventRow = (overrides: Partial<MonitoringEventRow> = {}): MonitoringEventRow => ({
  id: overrides.id ?? 'row-1',
  timestamp: overrides.timestamp ?? '2026-05-10T00:00:00.000Z',
  timestampMs: overrides.timestampMs ?? Date.UTC(2026, 4, 10, 0, 0, 0),
  dayKey: overrides.dayKey ?? '2026-05-10',
  hourLabel: overrides.hourLabel ?? '00:00',
  model: overrides.model ?? 'gpt-4.1',
  endpoint: overrides.endpoint ?? '/v1/chat/completions',
  endpointMethod: overrides.endpointMethod ?? 'POST',
  endpointPath: overrides.endpointPath ?? '/v1/chat/completions',
  sourceKey: overrides.sourceKey ?? 'source-1',
  source: overrides.source ?? 'source-1',
  sourceMasked: overrides.sourceMasked ?? 'source-1',
  account: overrides.account ?? 'account@example.com',
  accountMasked: overrides.accountMasked ?? 'acc***@example.com',
  authIndex: overrides.authIndex ?? '1',
  authIndexMasked: overrides.authIndexMasked ?? '1',
  authLabel: overrides.authLabel ?? 'account@example.com',
  provider: overrides.provider ?? 'codex',
  planType: overrides.planType ?? 'plus',
  channel: overrides.channel ?? 'default',
  channelHost: overrides.channelHost ?? 'localhost',
  channelDisabled: overrides.channelDisabled ?? false,
  failed: overrides.failed ?? false,
  statsIncluded: overrides.statsIncluded ?? true,
  latencyMs: overrides.latencyMs ?? 120,
  inputTokens: overrides.inputTokens ?? 10,
  outputTokens: overrides.outputTokens ?? 5,
  reasoningTokens: overrides.reasoningTokens ?? 0,
  cachedTokens: overrides.cachedTokens ?? 0,
  totalTokens: overrides.totalTokens ?? 15,
  totalCost: overrides.totalCost ?? 0.1,
  taskKey: overrides.taskKey ?? 'task-1',
  searchText: overrides.searchText ?? 'account@example.com codex gpt-4.1 default',
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
  });

  it('builds account health status from filtered monitoring rows within the selected range', () => {
    const startMs = Date.UTC(2026, 4, 10, 0, 0, 0);
    const endMs = Date.UTC(2026, 4, 17, 0, 0, 0) - 1;
    const rows = [
      createEventRow({
        id: 'start-success',
        timestampMs: startMs,
        failed: false,
        authIndex: '1',
      }),
      createEventRow({
        id: 'late-failure',
        timestampMs: endMs,
        failed: true,
        authIndex: '1',
      }),
      createEventRow({
        id: 'out-of-range-success',
        timestampMs: startMs - 60_000,
        failed: false,
        authIndex: '1',
      }),
      createEventRow({
        id: 'other-account',
        timestampMs: startMs + 30 * 60_000,
        account: 'other@example.com',
        authLabel: 'other@example.com',
        authIndex: '2',
      }),
    ];

    const result = buildMonitoringAccountStatusDataMap(rows, { startMs, endMs });
    const accountStatus = result.get('account@example.com');
    const otherStatus = result.get('other@example.com');

    expect(accountStatus).toBeDefined();
    expect(accountStatus?.totalSuccess).toBe(1);
    expect(accountStatus?.totalFailure).toBe(1);
    expect(accountStatus?.blockDetails).toHaveLength(20);
    expect(accountStatus?.blockDetails[0]).toMatchObject({ success: 1, failure: 0 });
    expect(accountStatus?.blockDetails[19]).toMatchObject({ success: 0, failure: 1 });

    expect(otherStatus?.totalSuccess).toBe(1);
    expect(otherStatus?.totalFailure).toBe(0);
  });
});
