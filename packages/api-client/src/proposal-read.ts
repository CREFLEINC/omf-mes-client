import createClient from 'openapi-fetch';
import type { paths, components } from './generated/proposal-read';
export const createProposalReadClient = (baseUrl: string, fetch?: typeof globalThis.fetch) =>
  createClient<paths>({
    baseUrl,
    credentials: 'include',
    querySerializer: { array: { style: 'form', explode: false } },
    ...(fetch ? { fetch } : {}),
  });
export type PlanProposal = components['schemas']['ProductionPlanProposal'];
export type ProposalComponents = components;
export type ProposalRevalidateBody = components['schemas']['ProductionPlanProposalRevalidate'];
export type ProposalRevalidation = components['schemas']['ProductionPlanProposalRevalidation'];
export type ProposalConfirmation = components['schemas']['ProductionPlanProposalConfirmResult'];
