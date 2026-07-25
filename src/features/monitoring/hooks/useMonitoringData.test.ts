import { describe, expect, it } from 'vitest';
import {
  buildAccountRows,
  buildApiKeyRows,
  buildApiKeyDisplayMap,
  buildProviderAliasDisplayMapForMonitoring,
  buildAccountRowsFromPageItemsForMonitoring,
  buildMonitoringFilterFacetsFromSummary,
  buildRangeFilteredRows,
  buildMonitoringAuthMetaMap,
  getRangeBounds,
  type MonitoringEventRow,
} from './useMonitoringData';
import { sha256Hex } from '@/utils/apiKeyHash';
import type { AuthFileItem } from '@/types';
import { buildProviderAliasKey } from '@/utils/providerAliases';
import { buildModelPriceIndex } from '@/utils/usage';

const createMonitoringEventRow = (
  overrides: Partial<MonitoringEventRow> = {}
): MonitoringEventRow => ({
  id: overrides.id ?? 'row-1',
  timestamp: overrides.timestamp ?? '2026-05-09T01:12:43.000Z',
  timestampMs: overrides.timestampMs ?? Date.parse('2026-05-09T01:12:43.000Z'),
  dayKey: overrides.dayKey ?? '2026-05-09',
  hourLabel: overrides.hourLabel ?? '01:00',
  model: overrides.model ?? 'gpt-4.1',
  endpoint: overrides.endpoint ?? '/v1/chat/completions',
  endpointMethod: overrides.endpointMethod ?? 'POST',
  endpointPath: overrides.endpointPath ?? '/v1/chat/completions',
  sourceKey: overrides.sourceKey ?? 'source:alpha',
  source: overrides.source ?? 'alpha.json',
  sourceMasked: overrides.sourceMasked ?? 'a***',
  account: overrides.account ?? 'amount-myth-resend@duck.com',
  accountMasked: overrides.accountMasked ?? 'amo***@duck.com',
  authIndex: overrides.authIndex ?? 'auth-123456',
  authIndexMasked: overrides.authIndexMasked ?? 'auth...3456',
  authLabel: overrides.authLabel ?? 'alpha.json',
  apiKeyHash: overrides.apiKeyHash ?? 'api-key-hash',
  apiKeyLabel: overrides.apiKeyLabel ?? 'ak********sh',
  apiKeyMasked: overrides.apiKeyMasked ?? 'ak********sh',
  provider: overrides.provider ?? 'codex',
  projectId: overrides.projectId ?? '',
  planType: overrides.planType ?? 'pro',
  channel: overrides.channel ?? 'codex',
  channelHost: overrides.channelHost ?? 'example.com',
  channelDisabled: overrides.channelDisabled ?? false,
  failed: overrides.failed ?? false,
  outcome: overrides.outcome ?? (overrides.failed ? 'failed' : 'success'),
  requestCount: overrides.requestCount ?? 1,
  successCalls:
    overrides.successCalls ?? (overrides.failed || overrides.outcome === 'canceled' ? 0 : 1),
  failureCalls: overrides.failureCalls ?? (overrides.failed ? 1 : 0),
  statsIncluded: overrides.statsIncluded ?? true,
  latencyMs: overrides.latencyMs ?? 1200,
  latencySumMs: overrides.latencySumMs ?? overrides.latencyMs ?? 1200,
  latencyCount: overrides.latencyCount ?? 1,
  inputTokens: overrides.inputTokens ?? 10,
  outputTokens: overrides.outputTokens ?? 5,
  reasoningTokens: overrides.reasoningTokens ?? 0,
  cachedTokens: overrides.cachedTokens ?? 3,
  totalTokens: overrides.totalTokens ?? 18,
  totalCost: overrides.totalCost ?? 0.12,
  taskKey: overrides.taskKey ?? 'task-1',
  searchText: overrides.searchText ?? 'amount myth resend',
});

describe('getRangeBounds', () => {
  it('returns the previous local day for yesterday', () => {
    const nowMs = new Date(2026, 4, 9, 12, 34, 56, 789).getTime();
    const bounds = getRangeBounds('yesterday', nowMs);

    expect(bounds).toEqual({
      startMs: new Date(2026, 4, 8, 0, 0, 0, 0).getTime(),
      endMs: new Date(2026, 4, 9, 0, 0, 0, 0).getTime(),
    });
  });
});

describe('buildAccountRows', () => {
  it('keeps raw auth indices for account-level auth file linking', () => {
    const rows = buildAccountRows([
      createMonitoringEventRow(),
      createMonitoringEventRow({
        id: 'row-2',
        timestampMs: Date.parse('2026-05-09T02:12:43.000Z'),
        authIndex: 'auth-999999',
        authIndexMasked: 'auth...9999',
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].authIndices).toEqual(['auth-123456', 'auth-999999']);
  });

  it('keeps canceled rows out of account success rates and recent patterns', () => {
    const rows = buildAccountRows([
      createMonitoringEventRow(),
      createMonitoringEventRow({
        id: 'row-canceled',
        timestampMs: Date.parse('2026-05-09T04:12:43.000Z'),
        failed: false,
        outcome: 'canceled',
        statsIncluded: false,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].totalCalls).toBe(2);
    expect(rows[0].successCalls).toBe(1);
    expect(rows[0].failureCalls).toBe(0);
    expect(rows[0].successRate).toBe(1);
    expect(rows[0].recentPattern).toEqual([true]);
  });
});

describe('buildApiKeyRows', () => {
  it('groups rows by api key and prefers alias labels in the summary row', () => {
    const rows = buildApiKeyRows([
      createMonitoringEventRow({
        apiKeyHash: 'hash-1',
        apiKeyLabel: 'sk-***-1',
        apiKeyMasked: 'sk-***-1',
        model: 'gpt-5',
        totalCost: 0.25,
      }),
      createMonitoringEventRow({
        id: 'row-2',
        timestampMs: Date.parse('2026-05-09T03:12:43.000Z'),
        apiKeyHash: 'hash-1',
        apiKeyLabel: 'Team Alpha',
        apiKeyMasked: 'sk-***-1',
        model: 'gpt-4.1',
        failed: true,
        totalCost: 0.4,
        inputTokens: 30,
        outputTokens: 12,
        cachedTokens: 5,
        totalTokens: 47,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].apiKeyLabel).toBe('Team Alpha');
    expect(rows[0].apiKeyMasked).toBe('sk-***-1');
    expect(rows[0].totalCalls).toBe(2);
    expect(rows[0].successCalls).toBe(1);
    expect(rows[0].failureCalls).toBe(1);
    expect(rows[0].totalCost).toBeCloseTo(0.65);
    expect(rows[0].successRate).toBe(0.5);
    expect(rows[0].lastSeenAt).toBe(Date.parse('2026-05-09T03:12:43.000Z'));
    expect(rows[0].models.map((model) => model.model)).toEqual(['gpt-4.1', 'gpt-5']);
  });

  it('uses stable fallback groups for unknown client api keys', () => {
    const rows = buildApiKeyRows([
      createMonitoringEventRow({
        sourceKey: 'source:alpha',
        authIndex: 'auth-a',
        authLabel: 'alpha',
        apiKeyHash: '',
        apiKeyLabel: '',
        apiKeyMasked: '',
      }),
      createMonitoringEventRow({
        id: 'row-2',
        sourceKey: 'source:beta',
        authIndex: 'auth-b',
        authLabel: 'beta',
        apiKeyHash: '',
        apiKeyLabel: '',
        apiKeyMasked: '',
        model: 'gpt-5.5',
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.isUnknown)).toBe(true);
    expect(rows[0].authLabels.length).toBeGreaterThan(0);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it('keeps canceled rows out of api key success rates', () => {
    const rows = buildApiKeyRows([
      createMonitoringEventRow({ apiKeyHash: 'hash-1' }),
      createMonitoringEventRow({
        id: 'row-canceled',
        apiKeyHash: 'hash-1',
        failed: false,
        outcome: 'canceled',
        statsIncluded: false,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].totalCalls).toBe(2);
    expect(rows[0].successCalls).toBe(1);
    expect(rows[0].failureCalls).toBe(0);
    expect(rows[0].successRate).toBe(1);
  });
});

describe('buildAccountRowsFromPageItemsForMonitoring', () => {
  it('uses provider aliases for server-paginated account rows', () => {
    const providerConfig = {
      apiKey: 'sk-provider-alias-test-key',
      prefix: 'team-codex',
      baseUrl: 'https://example.test/v1',
      authIndex: 'auth-provider-1',
    };
    const providerKey = buildProviderAliasKey('codex', providerConfig, 0);
    const providerAliasMap = buildProviderAliasDisplayMapForMonitoring(
      { codexApiKeys: [providerConfig] },
      [{ provider: 'codex', providerKey, alias: 'Fast Pool', updatedAtMs: 1 }]
    );

    const rows = buildAccountRowsFromPageItemsForMonitoring(
      [
        {
          id: 'm:sk-...-key',
          key: 'm:sk-...-key',
          account: 'm:sk-...-key',
          account_label: 'm:sk-...-key',
          auth_indices: ['auth-provider-1'],
          channels: ['codex'],
          total_requests: 3,
          success_count: 3,
          failure_count: 0,
          models: [],
        },
      ],
      buildModelPriceIndex({}),
      providerAliasMap
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].account).toBe('m:sk-...-key');
    expect(rows[0].displayAccount).toBe('Fast Pool');
  });
});

describe('buildRangeFilteredRows', () => {
  it('applies api key hash filtering even when the search query is empty', () => {
    const rows = buildRangeFilteredRows(
      [
        createMonitoringEventRow({ apiKeyHash: 'hash-a' }),
        createMonitoringEventRow({ id: 'row-2', apiKeyHash: 'hash-b' }),
      ],
      'all',
      null,
      '',
      'hash-b'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].apiKeyHash).toBe('hash-b');
  });

  it('matches text search when the derived api key hash does not match', () => {
    const rows = buildRangeFilteredRows(
      [
        createMonitoringEventRow({ apiKeyHash: 'hash-a', searchText: 'kongwenpeng codex' }),
        createMonitoringEventRow({ id: 'row-2', apiKeyHash: 'hash-b', searchText: 'other alias' }),
      ],
      'all',
      null,
      'KongWenpeng',
      sha256Hex('KongWenpeng')
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].apiKeyHash).toBe('hash-a');
  });
});

describe('buildMonitoringAuthMetaMap', () => {
  it('maps legacy auth indices to current auth metadata', () => {
    const authFiles: AuthFileItem[] = [
      {
        name: 'alice.json',
        provider: 'codex',
        authIndex: 'current-auth-index',
        path: '/tmp/auths/alice.json',
        account: 'alice@example.com',
      },
    ];

    const map = buildMonitoringAuthMetaMap(authFiles);

    expect(map.get('current-auth-index')?.account).toBe('alice@example.com');
    expect(map.get('6bf749cb7db0e15c')?.account).toBe('alice@example.com');
  });
});

describe('buildApiKeyDisplayMap', () => {
  it('prefers stored aliases while preserving masked configured keys', () => {
    const apiKey = 'sk-alias-test-key';
    const apiKeyHash = sha256Hex(apiKey);
    const map = buildApiKeyDisplayMap([apiKey], [{ apiKeyHash, alias: 'Team A', updatedAtMs: 1 }]);

    expect(map.get(apiKeyHash)?.label).toBe('Team A');
    expect(map.get(apiKeyHash)?.masked).toMatch(/^sk/);
  });

  it('masks aliases that look like full secrets before showing them in the ui', () => {
    const apiKey = 'sk-live-real-key';
    const apiKeyHash = sha256Hex(apiKey);
    const map = buildApiKeyDisplayMap(
      [apiKey],
      [{ apiKeyHash, alias: 'ghp_1234567890abcdef', updatedAtMs: 1 }]
    );

    expect(map.get(apiKeyHash)?.label).toContain('*');
    expect(map.get(apiKeyHash)?.label).not.toContain('ghp_1234567890abcdef');
  });
});

describe('buildProviderAliasDisplayMapForMonitoring', () => {
  it('maps saved provider aliases by auth index and usage source candidates', () => {
    const providerConfig = {
      apiKey: 'sk-provider-alias-test-key',
      prefix: 'team-codex',
      baseUrl: 'https://example.test/v1',
      authIndex: 'auth-provider-1',
    };
    const providerKey = buildProviderAliasKey('codex', providerConfig, 0);
    const map = buildProviderAliasDisplayMapForMonitoring(
      { codexApiKeys: [providerConfig] },
      [{ provider: 'codex', providerKey, alias: 'Fast Pool', updatedAtMs: 1 }]
    );

    expect(map.get('auth:auth-provider-1')?.alias).toBe('Fast Pool');
    expect(map.get('source:t:team-codex')?.alias).toBe('Fast Pool');
    expect(map.get('source:m:sk******ey')?.alias).toBe('Fast Pool');
    expect(map.get('source:k:686cd0dfeedcc90f')?.alias).toBe('Fast Pool');
  });

  it('uses OpenAI entry auth indices when the alias was saved against the provider config', () => {
    const providerConfig = {
      name: 'openai-router',
      alias: 'OpenAI Router',
      prefix: 'router',
      baseUrl: 'https://openai-compatible.test/v1',
      apiKeyEntries: [{ apiKey: 'sk-openai-entry-key', authIndex: 'auth-openai-entry' }],
    };
    const providerKey = buildProviderAliasKey('openai', providerConfig, 0);
    const map = buildProviderAliasDisplayMapForMonitoring(
      { openaiCompatibility: [providerConfig] },
      [{ provider: 'openai', providerKey, alias: 'Router Alias', updatedAtMs: 1 }]
    );

    expect(map.get('auth:auth-openai-entry')?.alias).toBe('Router Alias');
  });
});

describe('buildMonitoringFilterFacetsFromSummary', () => {
  it('reads summary facets without requiring detail rows', () => {
    const facets = buildMonitoringFilterFacetsFromSummary({
      apis: {},
      facets: {
        providers: ['codex'],
        accounts: [{ value: 'alice@example.com', label: 'Alice' }],
        models: ['gpt-5'],
        channels: ['codex'],
        api_keys: [{ value: 'hash-a', label: 'Team A' }],
      },
    });

    expect(facets.providers).toEqual(['codex']);
    expect(facets.accounts).toEqual([{ value: 'alice@example.com', label: 'Alice' }]);
    expect(facets.models).toEqual(['gpt-5']);
    expect(facets.channels).toEqual(['codex']);
    expect(facets.apiKeys).toEqual([{ value: 'hash-a', label: 'Team A' }]);
  });
});
