import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type ApprovalRequestDetail = components['schemas']['ApprovalRequestDetail'];
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

export interface RequestDetailView {
  approvalRequestNo: string;
  approvalTypeCode: string;
  requesterName: string;
  requestedAtText: string;
  statusCode: string;
  reasonLines: string[];
  targetName: string;
}

const formatDateTime = (value: string): string => {
  const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return matched === null ? value : `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

export const toRequestDetailView = (request: ApprovalRequest): RequestDetailView => ({
  approvalRequestNo: request.approvalRequestNo,
  approvalTypeCode: request.approvalTypeCode,
  requesterName: displayName(
    request.requestedByName,
    messages.qualityApproval.values.unknownRequester,
  ),
  requestedAtText: formatDateTime(request.requestedAt),
  statusCode: request.statusCode,
  reasonLines:
    request.reason.trim() === ''
      ? [messages.qualityApproval.values.emptyReason]
      : request.reason.split(/\r?\n/),
  targetName: displayName(
    request.target.displayName,
    messages.qualityApproval.values.unknownTarget,
  ),
});
