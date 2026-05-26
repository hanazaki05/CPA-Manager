import { usageServiceApi, isUsageServiceId, normalizeUsageServiceBase, type ProviderAlias } from '@/services/api/usageService';
import { useAuthStore, useUsageServiceStore } from '@/stores';
import type { GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from '@/types';
import { sha256Hex } from '@/utils/apiKeyHash';
import { buildUsageServiceBaseCandidates, detectApiBaseFromLocation } from '@/utils/connection';

export type AliasProviderType = 'gemini' | 'codex' | 'claude' | 'vertex' | 'openai';

type AliasConfig = GeminiKeyConfig | ProviderKeyConfig | OpenAIProviderConfig;
type ApiKeyAliasConfig = GeminiKeyConfig | ProviderKeyConfig;

const readString = (value: unknown) => String(value ?? '').trim();
const hasApiKey = (config: AliasConfig): config is ApiKeyAliasConfig =>
  'apiKey' in config && typeof config.apiKey === 'string';

const buildProviderAliasKeyWithAuthIndex = (
  provider: AliasProviderType,
  config: AliasConfig,
  index: number,
  authIndex: string
): string => {
  if (hasApiKey(config)) {
    const apiKeyHash = sha256Hex(config.apiKey || '');
    return sha256Hex(
      [
        provider,
        apiKeyHash,
        readString(config.baseUrl),
        readString(config.prefix),
        authIndex,
        String(index),
      ].join('|')
    );
  }

  const entryHashes = (config.apiKeyEntries || [])
    .map((entry) => sha256Hex(entry.apiKey || ''))
    .filter(Boolean)
    .sort()
    .join(',');

  return sha256Hex(
    [
      provider,
      readString(config.name).toLowerCase(),
      readString(config.baseUrl),
      readString(config.prefix),
      authIndex,
      entryHashes,
      String(index),
    ].join('|')
  );
};

export const buildProviderAliasKey = (
  provider: AliasProviderType,
  config: AliasConfig,
  index = 0
): string => buildProviderAliasKeyWithAuthIndex(provider, config, index, readString(config.authIndex));

const buildProviderAliasLookupKeys = (
  provider: AliasProviderType,
  config: AliasConfig,
  index: number
): string[] => {
  const keys = [buildProviderAliasKey(provider, config, index)];
  if (readString(config.authIndex)) {
    keys.push(buildProviderAliasKeyWithAuthIndex(provider, config, index, ''));
  }
  return Array.from(new Set(keys));
};

export const mergeProviderAliases = <T extends AliasConfig>(
  provider: AliasProviderType,
  configs: T[],
  aliases: ProviderAlias[]
): T[] => {
  if (!aliases.length) return configs;
  const aliasByKey = new Map(
    aliases
      .filter((item) => item.provider === provider && item.providerKey && item.alias)
      .map((item) => [item.providerKey, item.alias])
  );
  if (aliasByKey.size === 0) return configs;

  return configs.map((config, index) => {
    const alias = buildProviderAliasLookupKeys(provider, config, index)
      .map((key) => aliasByKey.get(key))
      .find(Boolean);
    return alias ? ({ ...config, alias } as T) : config;
  });
};

export const resolveUsageServiceBaseForAliases = async (): Promise<string> => {
  const { apiBase } = useAuthStore.getState();
  const usageServiceState = useUsageServiceStore.getState();
  if (usageServiceState.enabled && usageServiceState.serviceBase) {
    return usageServiceState.serviceBase;
  }

  const candidates = buildUsageServiceBaseCandidates([apiBase, detectApiBaseFromLocation()]).map(
    normalizeUsageServiceBase
  );

  for (const candidate of candidates) {
    try {
      const info = await usageServiceApi.getInfo(candidate);
      if (isUsageServiceId(info.service)) {
        return candidate;
      }
    } catch {
      // The regular CPA management API does not expose Usage Service metadata.
    }
  }

  return '';
};

export const loadProviderAliases = async (): Promise<ProviderAlias[]> => {
  const serviceBase = await resolveUsageServiceBaseForAliases();
  if (!serviceBase) return [];
  const { managementKey } = useAuthStore.getState();
  const response = await usageServiceApi.getProviderAliases(serviceBase, managementKey);
  return response.items || [];
};

export const saveProviderAlias = async (
  provider: AliasProviderType,
  config: AliasConfig,
  alias: string,
  index = 0
): Promise<void> => {
  const serviceBase = await resolveUsageServiceBaseForAliases();
  if (!serviceBase) {
    throw new Error('provider_alias_requires_usage_service');
  }
  const { managementKey } = useAuthStore.getState();
  const providerKeys = buildProviderAliasLookupKeys(provider, config, index);
  const trimmedAlias = alias.trim();
  if (trimmedAlias) {
    await usageServiceApi.saveProviderAliases(
      serviceBase,
      providerKeys.map((providerKey) => ({ provider, providerKey, alias: trimmedAlias })),
      managementKey
    );
    return;
  }
  await Promise.all(
    providerKeys.map((providerKey) =>
      usageServiceApi.deleteProviderAlias(serviceBase, provider, providerKey, managementKey)
    )
  );
};
