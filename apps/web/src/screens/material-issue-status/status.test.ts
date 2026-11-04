import type {
  MaterialIssueRequestForward,
  MaterialIssueRequestLineForward,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { EMPTY_FILTERS, readFilters, toListQuery, toSearchParams } from './filters';
import { dateEffect, editScope, isReleaseFailed, quantityError, statusLabel } from './status';

const t = messages.materialIssueStatus;

const request = (
  overrides: Partial<MaterialIssueRequestForward> = {},
): MaterialIssueRequestForward => ({
  materialIssueRequestId: 1,
  issueRequestNo: 'SYN-MIR-01',
  workOrderId: 11,
  destinationLocationId: 21,
  statusCode: 'WAITING',
  displayStatus: 'WAITING',
  sourceWarehouseId: 31,
  ...overrides,
});

const line = (issuedQty: number): MaterialIssueRequestLineForward => ({
  materialIssueRequestLineId: 7,
  materialIssueRequestId: 1,
  lineNo: 1,
  itemId: 41,
  itemCode: 'SYN-IT-1',
  uomId: 1,
  requestedQty: 100,
  issuedQty,
});

describe('W-02-11 상태 표시', () => {
  it('US1-5 표시 상태 5종을 한글 라벨로 보인다', () => {
    expect(
      (['WAITING', 'RELEASED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const).map((displayStatus) =>
        statusLabel({ displayStatus }),
      ),
    ).toEqual(['대기', '배포', '진행 중', '완료', '취소']);
  });

  it('US5-11 닫힌 요청은 「완료」에 닫힘 사유를 붙인다', () => {
    expect(statusLabel({ displayStatus: 'DONE', closeReasonCode: 'WORK_ORDER_CANCELLED' })).toBe(
      '완료, W/O 취소',
    );
    expect(statusLabel({ displayStatus: 'DONE', closeReasonCode: 'UNKNOWN' })).toBe('완료');
  });

  it('배포 실패는 원인 글이 있는 대기 요청이다', () => {
    expect(isReleaseFailed(request({ releaseErrorText: '창고 비활성' }))).toBe(true);
    expect(isReleaseFailed(request({ releaseErrorText: null }))).toBe(false);
  });
});

describe('W-02-11 고칠 수 있는 범위', () => {
  it('US5-2 대기 · 배포는 모두, US5-6 진행 중은 수량만, 완료 · 취소는 보기만', () => {
    expect(editScope(request({ displayStatus: 'WAITING' }))).toBe('all');
    expect(editScope(request({ displayStatus: 'RELEASED' }))).toBe('all');
    expect(editScope(request({ displayStatus: 'IN_PROGRESS' }))).toBe('quantity');
    expect(editScope(request({ displayStatus: 'DONE' }))).toBe('none');
    expect(editScope(request({ displayStatus: 'CANCELLED' }))).toBe('none');
  });

  it('US2-8 생산 창고 규칙 전에 만든 요청(출발 창고 없음)은 보기만', () => {
    expect(editScope(request({ sourceWarehouseId: null }))).toBe('none');
  });

  it('US5-10 요청 수량이 기출고 미만이면 칸 오류', () => {
    const lines = [line(40)];
    const text = (value: MaterialIssueRequestLineForward) => value.itemCode ?? '';
    expect(quantityError(lines, new Map([[7, '30']]), text)).toBe(
      t.detail.lines.belowIssued('SYN-IT-1', '40'),
    );
    expect(quantityError(lines, new Map([[7, '60']]), text)).toBeNull();
    expect(quantityError(lines, new Map([[7, '']]), text)).not.toBeNull();
  });

  it('US5-3 · US5-4 · US5-5 출고 작업일 변경 창 안내 — 오늘 이하 바로 배포, 배포 요청 미룸은 대기로, 그 밖은 그날 00:00', () => {
    expect(dateEffect('2026-11-03', '2026-11-03', 'WAITING')).toBe(t.dateDialog.releaseNow);
    expect(dateEffect('2026-11-06', '2026-11-03', 'RELEASED')).toBe(
      t.dateDialog.backToWaiting('11-06(금)'),
    );
    expect(dateEffect('2026-11-06', '2026-11-03', 'WAITING')).toBe(
      t.dateDialog.scheduled('11-06(금)'),
    );
  });
});

describe('W-02-11 조회 조건', () => {
  it('US6-1 · US6-2 주소 조건을 계약 조건으로 옮긴다(묶음 보기는 싣지 않는다)', () => {
    const filters = readFilters(
      toSearchParams('list', {
        ...EMPTY_FILTERS,
        plant: '8401',
        prodFrom: '2026-11-09',
        prodTo: '2026-11-13',
        statuses: ['WAITING', 'RELEASED'],
        shortageOnly: true,
        failedOnly: true,
        groupByPlan: true,
      }),
    );
    expect(toListQuery(filters, 2, 50)).toEqual({
      plantId: 8401,
      productionDateFrom: '2026-11-09',
      productionDateTo: '2026-11-13',
      displayStatus: ['WAITING', 'RELEASED'],
      hasShortage: true,
      releaseFailed: true,
      page: 2,
      size: 50,
    });
    expect(filters.groupByPlan).toBe(true);
  });
});
