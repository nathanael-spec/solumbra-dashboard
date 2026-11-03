/**
 * Vollna keeps a copy of every Upwork proposal, with the three flags Upwork
 * itself never shows: viewed, interviewed, hired. Reading your own proposals
 * is free. The job endpoints cost credits and are never called from here.
 * VOLLNA_PROFILE_ID picks the Upwork profile; without it, the first one.
 */
import type { Proposal, VollnaData } from '../types';
import { env, getJson } from './util';

const API = 'https://api.vollna.com/v1';

interface RawProposal {
  applicationUid: string; submittedAt: string; connects?: number | null; boost?: number | null;
  isViewed: boolean; isInterviewed: boolean; isHired: boolean; isWithdrawn: boolean; isInvitation: boolean;
  submissionPosition?: number | null; responseTimeMinutes?: number | null;
  project?: { title?: string; client?: { name?: string; companyName?: string } } | null;
  jobDetails?: { title?: string } | null;
}
interface RawProfile { id: number; label: string; connectsBalance?: number; lastSyncAt?: string }

export async function readVollna(): Promise<VollnaData> {
  const headers = { 'X-API-TOKEN': env('VOLLNA_API_TOKEN') };
  const profiles = await getJson<{ data: RawProfile[] }>(`${API}/profiles`, headers);
  const wanted = process.env.VOLLNA_PROFILE_ID?.trim();
  const me = profiles.data.find((p) => String(p.id) === wanted) ?? profiles.data[0];
  if (!me) throw new Error('Vollna has no Upwork profile connected yet. Connect one at vollna.com first.');
  const profile = String(me.id);

  const proposals: Proposal[] = [];
  for (let page = 1; page <= 40; page++) {
    const body = await getJson<{ data: RawProposal[]; pagination: { total_pages: number } }>(
      `${API}/proposals?profileId=${profile}&page=${page}&perPage=20`,
      headers,
    );
    for (const p of body.data) {
      proposals.push({
        uid: p.applicationUid,
        submittedAt: p.submittedAt,
        title: p.project?.title ?? p.jobDetails?.title ?? '(job post removed)',
        client: p.project?.client?.companyName ?? p.project?.client?.name ?? '',
        connects: p.connects ?? 0,
        boost: p.boost ?? 0,
        viewed: Boolean(p.isViewed),
        interviewed: Boolean(p.isInterviewed),
        hired: Boolean(p.isHired),
        withdrawn: Boolean(p.isWithdrawn),
        invitation: Boolean(p.isInvitation),
        position: p.submissionPosition ?? null,
        responseMinutes: p.responseTimeMinutes ?? null,
      });
    }
    if (page >= (body.pagination?.total_pages ?? 1)) break;
  }
  return { proposals, connectsBalance: me?.connectsBalance ?? null, lastSyncAt: me?.lastSyncAt ?? null, from: 'api' };
}
