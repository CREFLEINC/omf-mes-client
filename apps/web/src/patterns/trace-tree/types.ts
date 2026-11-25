import type { components, paths } from '@omf-mes/api-client';

/**
 * 자재 기준 생산 추적(W-02-13) · 제품 기준 역추적(W-02-14) 계약 이름표(피처 015, omf-all-around#355).
 * 정본: 서버 `contracts/logistics-01자재창고.json`.
 */
type Schemas = components['schemas'];

/** 추적 방향 — FORWARD 자재 기준(정방향), BACKWARD 제품 기준(역방향). */
export type TraceDirection = 'FORWARD' | 'BACKWARD';

export type TraceLot = Schemas['TraceTreeLot'];
export type TraceItem = Schemas['TraceTreeItem'];
export type TracePartner = Schemas['TraceTreePartner'];
export type TraceLotRow = Schemas['TraceLotRow'];
export type TraceLotPage = Schemas['TraceLotPage'];
export type TraceStartMatch = Schemas['TraceStartMatch'];
export type TraceMatchedBy = TraceStartMatch['matchedBy'];
export type TraceSortDateKind = NonNullable<TraceLotRow['sortDateKind']>;

export type TraceGraphNode = Schemas['TraceGraphNode'];
export type TraceGraphEdge = Schemas['TraceGraphEdge'];
export type TraceGraphLimit = Schemas['TraceGraphLimit'];
export type TraceGraph = Schemas['TraceGraph'];
export type TraceNodeKind = TraceGraphNode['kind'];

export type ForwardTree = Schemas['ForwardTree'];
export type ForwardEndRow = Schemas['ForwardEndRow'];
export type BackwardTree = Schemas['BackwardTree'];
export type BackwardEndRow = Schemas['BackwardEndRow'];
export type TraceExportRequest = Schemas['TraceExportRequest'];

export type TraceLotsQuery = paths['/trace/material-trace-lots']['get']['parameters']['query'];
