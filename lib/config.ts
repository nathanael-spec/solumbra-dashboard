/**
 * Everything about *this* business that the code must not assume: its name,
 * its timezone, its currency, the channels it finds clients through, which
 * tools are connected. All of it comes from environment variables, written by
 * `npm run setup`. The page receives a copy inside the data blob so the
 * client can filter and label without a second request.
 */
import type { DashConfig, PipelineKind } from './types';

const list = (v: string | undefined, fallback: string[]): string[] => {
  const xs = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return xs.length ? xs : fallback;
};

export const DEFAULT_CHANNELS = ['Upwork', 'Cold email', 'Network', 'Website'];
export const DEFAULT_CATEGORIES = ['Consultation', 'Build', 'Maintenance', 'Training', 'Other'];
/** The channel every cost that is not about finding clients goes under. Always present, never earns. */
export const OVERHEAD = 'Overhead';

export const has = (name: string): boolean => Boolean(process.env[name]?.trim());

export function googleConnected(): boolean {
  return has('GOOGLE_SERVICE_ACCOUNT_JSON') || (has('GOOGLE_SHEETS_CLIENT_ID') && has('GOOGLE_SHEETS_CLIENT_SECRET') && has('GOOGLE_SHEETS_REFRESH_TOKEN'));
}

export function pipelineKind(): PipelineKind {
  const asked = (process.env.PIPELINE_SOURCE ?? '').toLowerCase();
  if (asked === 'clickup' || asked === 'sheet' || asked === 'none') return asked;
  if (has('CLICKUP_API_TOKEN') && has('CLICKUP_LIST_ID')) return 'clickup';
  return 'sheet';
}

export function readConfig(): DashConfig {
  const demo = process.env.DEMO === '1';
  const channels = list(process.env.CHANNELS, DEFAULT_CHANNELS).filter((c) => c !== OVERHEAD);
  const dashboardSheet = process.env.DASHBOARD_SHEET_ID || process.env.PNL_SHEET_ID || '';
  return {
    businessName: process.env.BUSINESS_NAME?.trim() || 'Solumbra',
    timezone: process.env.TIMEZONE?.trim() || 'UTC',
    currency: (process.env.CURRENCY?.trim() || 'USD').toUpperCase(),
    channels,
    categories: list(process.env.CATEGORIES, DEFAULT_CATEGORIES),
    taxRate: Number(process.env.TAX_RATE ?? '0.28') || 0,
    pipeline: demo ? 'clickup' : pipelineKind(),
    connected: demo
      ? { sheets: true, pipeline: true, calcom: true, instantly: true, vollna: true, stripe: true, retro: true }
      : {
          sheets: googleConnected() && has('PNL_SHEET_ID'),
          pipeline: pipelineKind() !== 'none' && (pipelineKind() === 'clickup' || (googleConnected() && Boolean(dashboardSheet))),
          calcom: has('CALCOM_API_KEY'),
          instantly: has('INSTANTLY_API_KEY'),
          vollna: has('VOLLNA_API_TOKEN'),
          stripe: has('STRIPE_API_KEY'),
          retro: googleConnected() && has('RETRO_SHEET_ID'),
        },
    demo,
    logoUrl: process.env.LOGO_URL?.trim() || '',
    proposalsUrl: process.env.PROPOSALS_URL?.trim() || '',
    weekUrl: process.env.LINKEDIN_WEEK_URL?.trim() || '',
  };
}
