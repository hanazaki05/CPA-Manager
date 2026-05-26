import type { ApiKeyEntry, GeminiKeyConfig, ProviderKeyConfig } from '@/types';
import type { HeaderEntry } from '@/utils/headers';

export interface ModelEntry {
  name: string;
  alias: string;
}

export interface OpenAIFormState {
  name: string;
  alias: string;
  priority?: number;
  prefix: string;
  baseUrl: string;
  headers: HeaderEntry[];
  testModel?: string;
  modelEntries: ModelEntry[];
  apiKeyEntries: ApiKeyEntry[];
}

export interface AmpcodeUpstreamApiKeyEntry {
  upstreamApiKey: string;
  clientApiKeysText: string;
}

export interface AmpcodeFormState {
  upstreamUrl: string;
  upstreamApiKey: string;
  forceModelMappings: boolean;
  mappingEntries: ModelEntry[];
  upstreamApiKeyEntries: AmpcodeUpstreamApiKeyEntry[];
}

export type GeminiFormState = Omit<GeminiKeyConfig, 'headers' | 'models'> & {
  alias?: string;
  headers: HeaderEntry[];
  modelEntries: ModelEntry[];
  excludedText: string;
};

export type ProviderFormState = Omit<ProviderKeyConfig, 'headers'> & {
  alias?: string;
  headers: HeaderEntry[];
  modelEntries: ModelEntry[];
  excludedText: string;
};

export type VertexFormState = Omit<ProviderKeyConfig, 'headers'> & {
  alias?: string;
  headers: HeaderEntry[];
  modelEntries: ModelEntry[];
  excludedText: string;
};
