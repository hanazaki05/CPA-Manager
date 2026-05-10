import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { AccountOverviewCard } from './MonitoringCenterPage';
import { buildEmptyMonitoringStatusData } from '@/features/monitoring/accountOverviewState';

const t = ((key: string) => {
  const copy: Record<string, string> = {
    'monitoring.account_overview_enable_all': 'Enable all',
    'monitoring.account_overview_disable_all': 'Disable all',
    'monitoring.restore_account_scope': 'Restore account scope',
    'monitoring.focus_account': 'Focus account',
    'monitoring.account_overview_enabled_label': 'Enabled',
    'auth_files.status_toggle_label': 'Enabled',
    'monitoring.account_overview_health_label': 'Health',
    'monitoring.total_calls': 'Total calls',
    'stats.success': 'Success',
    'stats.failure': 'Failure',
    'monitoring.latest_request_time': 'Latest request',
    'monitoring.success_rate': 'Success rate',
    'status_bar.no_requests': 'No requests',
  };
  return copy[key] ?? key;
}) as TFunction;

describe('MonitoringCenterPage account card', () => {
  it('renders bulk action buttons for mixed account auth state', () => {
    const html = renderToStaticMarkup(
      <AccountOverviewCard
        row={{
          id: 'account@example.com',
          account: 'account@example.com',
          displayAccount: 'account@example.com',
          accountMasked: 'acc***@example.com',
          authLabels: ['alpha', 'beta'],
          authIndices: ['1', '2'],
          channels: ['default'],
          totalCalls: 10,
          successCalls: 8,
          failureCalls: 2,
          successRate: 0.8,
          inputTokens: 100,
          outputTokens: 50,
          cachedTokens: 10,
          totalTokens: 160,
          totalCost: 1.25,
          averageLatencyMs: 120,
          lastSeenAt: Date.UTC(2026, 4, 10, 12, 0, 0),
          recentPattern: [true, false],
          models: [],
        }}
        authState={{
          files: [],
          toggleableFileNames: ['alpha.json', 'beta.json'],
          enabledState: 'mixed',
        }}
        hasPrices
        locale="en"
        t={t}
        isExpanded={false}
        isFocused={false}
        statusData={buildEmptyMonitoringStatusData({
          startMs: Date.UTC(2026, 4, 10, 0, 0, 0),
          endMs: Date.UTC(2026, 4, 10, 23, 59, 59),
        })}
        statusUpdating={false}
        onToggle={() => {}}
        onFocus={() => {}}
        onToggleEnabled={() => {}}
        onRefreshQuota={() => {}}
      />
    );

    expect(html).toContain('Enable all');
    expect(html).toContain('Disable all');
    expect(html).not.toContain('type="checkbox"');
  });
});
