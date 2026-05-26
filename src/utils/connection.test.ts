import { describe, expect, it } from 'vitest';
import {
  buildUsageServiceBaseCandidates,
  DEFAULT_DOCKER_CPA_BASE_URL,
  resolveDefaultCPAConnectionBase,
} from './connection';

describe('resolveDefaultCPAConnectionBase', () => {
  it('uses the explicit environment default first', () => {
    expect(
      resolveDefaultCPAConnectionBase({
        hostedByUsageService: true,
        currentBase: 'http://panel.local:18317',
        envDefault: 'cpa.local:8317',
      })
    ).toBe('http://cpa.local:8317');
  });

  it('uses the Docker host default when the panel is hosted by Usage Service', () => {
    expect(
      resolveDefaultCPAConnectionBase({
        hostedByUsageService: true,
        currentBase: 'http://panel.local:18317',
        envDefault: '',
      })
    ).toBe(DEFAULT_DOCKER_CPA_BASE_URL);
  });

  it('keeps the current base for regular CPA-hosted panels', () => {
    expect(
      resolveDefaultCPAConnectionBase({
        hostedByUsageService: false,
        currentBase: 'http://cpa.local:8317/',
        envDefault: '',
      })
    ).toBe('http://cpa.local:8317');
  });
});

describe('buildUsageServiceBaseCandidates', () => {
  it('adds the local standalone Usage Service port for localhost CPA panels', () => {
    expect(buildUsageServiceBaseCandidates(['http://localhost:8317'])).toEqual([
      'http://localhost:8317',
      'http://localhost:18317',
    ]);
  });

  it('keeps explicitly configured Usage Service candidates first and de-duplicates', () => {
    expect(
      buildUsageServiceBaseCandidates([
        'http://127.0.0.1:18317/',
        'http://127.0.0.1:8317',
      ])
    ).toEqual(['http://127.0.0.1:18317', 'http://127.0.0.1:8317']);
  });

  it('does not probe the Usage Service port for non-localhost panels', () => {
    expect(buildUsageServiceBaseCandidates(['https://panel.example.com:8317'])).toEqual([
      'https://panel.example.com:8317',
    ]);
  });
});
