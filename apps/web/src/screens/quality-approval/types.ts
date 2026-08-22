import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type PageMeta = components['schemas']['PageMeta'];

export interface RequestRow {
  approvalRequestId: number;
  approvalRequestNo: string;
  approvalTypeCode: string;
  targetName: string;
  statusCode: string;
  isMyTurn: boolean;
}

const displayName = (value: string, fallback: string): string =>
  value.trim() === '' ? fallback : value;

export const toRequestRow = (request: ApprovalRequest): RequestRow => ({
  approvalRequestId: request.approvalRequestId,
  approvalRequestNo: request.approvalRequestNo,
  approvalTypeCode: request.approvalTypeCode,
  targetName: displayName(
    request.target.displayName,
    messages.qualityApproval.values.unknownTarget,
  ),
  statusCode: request.statusCode,
  isMyTurn: request.isMyTurn,
});
