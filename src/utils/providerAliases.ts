import {
  usageServiceApi,
  isUsageServiceId,
  normalizeUsageServiceBase,
  type ProviderAlias,
} from '@/services/api/usageService';
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
const DELETE_ALIAS_LEGACY_INDEX_LIMIT = 256;

const buildProviderAliasKeyParts = (
  provider: AliasProviderType,
  config: AliasConfig,
  authIndex: string
): string[] => {
  if (hasApiKey(config)) {
    const apiKeyHash = sha256Hex(config.apiKey || '');
    return [provider, apiKeyHash, readString(config.baseUrl), readString(config.prefix), authIndex];
  }

  const entryHashes = (config.apiKeyEntries || [])
    .map((entry) => sha256Hex(entry.apiKey || ''))
    .filter(Boolean)
    .sort()
    .join(',');

  return [
    provider,
    readString(config.name).toLowerCase(),
    readString(config.baseUrl),
    readString(config.prefix),
    authIndex,
    entryHashes,
  ];
};

const buildProviderAliasKeyWithAuthIndex = (
  provider: AliasProviderType,
  config: AliasConfig,
  authIndex: string
): string => sha256Hex(buildProviderAliasKeyParts(provider, config, authIndex).join('|'));

const buildLegacyProviderAliasKeyWithAuthIndex = (
  provider: AliasProviderType,
  config: AliasConfig,
  index: number,
  authIndex: string
): string =>
  sha256Hex([...buildProviderAliasKeyParts(provider, config, authIndex), String(index)].join('|'));

const buildProviderAliasAuthIndexes = (config: AliasConfig): string[] => {
  const authIndexes = [readString(config.authIndex)];
  if (authIndexes[0]) authIndexes.push('');
  return Array.from(new Set(authIndexes));
};

export const buildProviderAliasKey = (
  provider: AliasProviderType,
  config: AliasConfig,
  _index = 0
): string => buildProviderAliasKeyWithAuthIndex(provider, config, readString(config.authIndex));

export const buildLegacyProviderAliasKey = (
  provider: AliasProviderType,
  config: AliasConfig,
  index = 0
): string =>
  buildLegacyProviderAliasKeyWithAuthIndex(provider, config, index, readString(config.authIndex));

interface ProviderAliasLookupOptions {
  legacyIndexLimit?: number;
}

export const buildProviderAliasLookupKeys = (
  provider: AliasProviderType,
  config: AliasConfig,
  index: number,
  options: ProviderAliasLookupOptions = {}
): string[] => {
  const keys: string[] = [];
  const addKey = (key: string) => {
    if (key && !keys.includes(key)) keys.push(key);
  };
  const authIndexes = buildProviderAliasAuthIndexes(config);

  authIndexes.forEach((authIndex) => {
    addKey(buildProviderAliasKeyWithAuthIndex(provider, config, authIndex));
    addKey(buildLegacyProviderAliasKeyWithAuthIndex(provider, config, index, authIndex));
  });

  const legacyIndexLimit = Math.max(index + 1, options.legacyIndexLimit ?? 0);
  for (let legacyIndex = 0; legacyIndex < legacyIndexLimit; legacyIndex += 1) {
    if (legacyIndex === index) continue;
    authIndexes.forEach((authIndex) => {
      addKey(buildLegacyProviderAliasKeyWithAuthIndex(provider, config, legacyIndex, authIndex));
    });
  }
  return keys;
};

export const mergeProviderAliases = <T extends AliasConfig>(
  provider: AliasProviderType,
  configs: T[],
  aliases: ProviderAlias[]
): T[] => {
  if (!aliases.length) return configs;
  const providerAliases = aliases.filter((item) => item.provider === provider);
  const legacyIndexLimit = Math.max(32, configs.length + providerAliases.length + 1);
  const aliasByKey = new Map(
    providerAliases
      .filter((item) => item.providerKey && item.alias)
      .map((item) => [item.providerKey, item.alias])
  );
  if (aliasByKey.size === 0) return configs;

  return configs.map((config, index) => {
    const alias = buildProviderAliasLookupKeys(provider, config, index, { legacyIndexLimit })
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
  const trimmedAlias = alias.trim();
  if (trimmedAlias) {
    const providerKeys = buildProviderAliasLookupKeys(provider, config, index);
    await usageServiceApi.saveProviderAliases(
      serviceBase,
      providerKeys.map((providerKey) => ({ provider, providerKey, alias: trimmedAlias })),
      managementKey
    );
    return;
  }
  const providerKeys = buildProviderAliasLookupKeys(provider, config, index, {
    legacyIndexLimit: Math.max(DELETE_ALIAS_LEGACY_INDEX_LIMIT, index + 1),
  });
  await Promise.all(
    providerKeys.map((providerKey) =>
      usageServiceApi.deleteProviderAlias(serviceBase, provider, providerKey, managementKey)
    )
  );
};
