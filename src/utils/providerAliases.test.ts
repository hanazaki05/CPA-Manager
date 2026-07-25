import { describe, expect, it } from 'vitest';
import type { ProviderAlias } from '@/services/api/usageService';
import type { ProviderKeyConfig } from '@/types';
import {
  buildLegacyProviderAliasKey,
  buildProviderAliasKey,
  buildProviderAliasLookupKeys,
  mergeProviderAliases,
} from './providerAliases';

const codexConfig = (overrides: Partial<ProviderKeyConfig> = {}): ProviderKeyConfig => ({
  apiKey: overrides.apiKey ?? 'sk-provider-alias-test',
  baseUrl: overrides.baseUrl ?? 'https://example.test/v1',
  prefix: overrides.prefix ?? 'team',
  authIndex: overrides.authIndex,
});

describe('provider alias keys', () => {
  it('uses stable provider keys that do not change when list indexes shift', () => {
    const config = codexConfig({ authIndex: 'auth-team-a' });

    expect(buildProviderAliasKey('codex', config, 0)).toBe(
      buildProviderAliasKey('codex', config, 3)
    );
    expect(buildLegacyProviderAliasKey('codex', config, 0)).not.toBe(
      buildLegacyProviderAliasKey('codex', config, 3)
    );
  });

  it('looks up both stable keys and legacy index keys for new saves', () => {
    const config = codexConfig({ authIndex: 'auth-team-a' });
    const keys = buildProviderAliasLookupKeys('codex', config, 2);

    expect(keys).toContain(buildProviderAliasKey('codex', config, 2));
    expect(keys).toContain(buildLegacyProviderAliasKey('codex', config, 2));
  });

  it('keeps aliases visible after deleting an earlier provider from a legacy index-keyed list', () => {
    const remaining = codexConfig({
      apiKey: 'sk-remaining-provider',
      authIndex: 'auth-remaining',
      prefix: 'remaining',
    });
    const oldProviderKey = buildLegacyProviderAliasKey('codex', remaining, 1);
    const aliases: ProviderAlias[] = [
      { provider: 'codex', providerKey: oldProviderKey, alias: 'Remaining Pool', updatedAtMs: 1 },
    ];

    expect(mergeProviderAliases('codex', [remaining], aliases)[0]?.alias).toBe('Remaining Pool');
  });
});
