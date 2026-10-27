import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  PENDING_ONLY_DEFAULT,
  readFilters,
  readPage,
  readPendingOnly,
  readSelectedRequestId,
  toAppliedSearchParams,
  toRequestListQuery,
  withSelectedRequest,
} from './filters';

describe('quality approval URL filters', () => {
  it('미확정 코드와 잘못된 값은 요청 조건으로 읽지 않는다', () => {
    const tooLong = '9'.repeat(400);
    const params = new URLSearchParams(
      `ty=UNCONFIRMED&st=UNKNOWN&from=2026-02-29&to=2026-08-22&q=%20SYNTH%20&page=${tooLong}&approvalRequestId=${tooLong}`,
    );

    expect(readFilters(params)).toEqual({
      ...EMPTY_FILTERS,
      to: '2026-08-22',
      q: ' SYNTH ',
    });
    expect(readPage(params)).toBe(1);
    expect(readSelectedRequestId(params)).toBeNull();
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
    expect(readSelectedRequestId(new URLSearchParams('approvalRequestId=-1'))).toBeNull();
    expect(readSelectedRequestId(new URLSearchParams('rq=31'))).toBeNull();
  });

  it('코드 목록이 확정되면 같은 구조로 유형과 상태를 읽는다', () => {
    const params = new URLSearchParams('ty=IQC_SKIP&st=SYNTH-OPEN');

    expect(readFilters(params, ['IQC_SKIP'], ['SYNTH-OPEN'])).toEqual({
      ...EMPTY_FILTERS,
      approvalTypeCode: 'IQC_SKIP',
      statusCode: 'SYNTH-OPEN',
    });
  });

  it('적용·범위·쪽 변경은 소유하지 않은 URL을 보존하고 선택을 비운다', () => {
    const current = new URLSearchParams('view=compact&page=4&approvalRequestId=31');
    const next = toAppliedSearchParams(current, { ...EMPTY_FILTERS, q: '  SYNTH-REQ  ' }, true, 1);

    /* 기본(전체 조회 · #186)과 다른 「결재 대기만」만 `pd=1` 로 적는다. */
    expect(next.toString()).toBe('view=compact&q=SYNTH-REQ&pd=1');
    expect(toAppliedSearchParams(current, EMPTY_FILTERS, false, 1).toString()).toBe('view=compact');
    expect(current.toString()).toBe('view=compact&page=4&approvalRequestId=31');
  });

  it('선택만 바꾸면 적용 조건과 쪽 및 소유하지 않은 URL을 그대로 둔다', () => {
    const current = new URLSearchParams('q=SYNTH&page=2&view=compact');

    expect(withSelectedRequest(current, 31).toString()).toBe(
      'q=SYNTH&page=2&view=compact&approvalRequestId=31',
    );
    expect(withSelectedRequest(current, null).toString()).toBe('q=SYNTH&page=2&view=compact');
  });
});

describe('quality approval request query', () => {
  it('고정 축과 적용된 조건만 보내며 빈 승인 유형은 보내지 않는다', () => {
    /* 기본은 전체 조회다(#186) — 「결재 대기만」을 싣지 않는다. */
    expect(toRequestListQuery(EMPTY_FILTERS, PENDING_ONLY_DEFAULT, 1)).toEqual({
      assignedToMe: true,
    });
    expect(toRequestListQuery(EMPTY_FILTERS, true, 1)).toEqual({
      assignedToMe: true,
      pendingOnly: true,
    });

    expect(
      toRequestListQuery(
        {
          approvalTypeCode: 'IQC_SKIP',
          statusCode: 'SYNTH-OPEN',
          from: '2026-08-01',
          to: '2026-08-22',
          q: ' SYNTH-REQ ',
        },
        false,
        3,
      ),
    ).toEqual({
      assignedToMe: true,
      approvalTypeCode: 'IQC_SKIP',
      statusCode: 'SYNTH-OPEN',
      requestedAtFrom: '2026-08-01',
      requestedAtTo: '2026-08-22',
      q: 'SYNTH-REQ',
      page: 3,
    });
  });

  it('확인칸의 모르는 URL 값은 안전한 기본값으로 읽는다', () => {
    expect(readPendingOnly(new URLSearchParams())).toBe(false);
    expect(readPendingOnly(new URLSearchParams('pd=1'))).toBe(true);
    /* 기본이 켜짐이던 때의 옛 주소(`pd=0`)와 모르는 값은 기본(전체)이다. */
    expect(readPendingOnly(new URLSearchParams('pd=0'))).toBe(false);
    expect(readPendingOnly(new URLSearchParams('pd=maybe'))).toBe(false);
  });
});

/* 「내 차례만 보기」(#193) — 켠 것만 주소 `mt=1` 로 적고, 서버에는 계약의 `myTurnOnly` 로 싣는다. */
describe('quality approval my-turn filter', () => {
  it('켠 것만 주소와 요청에 싣고, 끄면 둘 다에서 빠진다', () => {
    const on = { ...EMPTY_FILTERS, myTurnOnly: true };

    const params = toAppliedSearchParams(new URLSearchParams(), on, PENDING_ONLY_DEFAULT, 1);
    expect(params.get('mt')).toBe('1');
    expect(readFilters(params).myTurnOnly).toBe(true);
    expect(toRequestListQuery(on, PENDING_ONLY_DEFAULT, 1)).toEqual({
      assignedToMe: true,
      myTurnOnly: true,
    });

    const off = toAppliedSearchParams(params, EMPTY_FILTERS, PENDING_ONLY_DEFAULT, 1);
    expect(off.has('mt')).toBe(false);
    expect(readFilters(off).myTurnOnly).toBe(false);
    expect(toRequestListQuery(EMPTY_FILTERS, PENDING_ONLY_DEFAULT, 1)).not.toHaveProperty(
      'myTurnOnly',
    );
  });

  it('모르는 주소 값은 꺼짐으로 읽는다', () => {
    expect(readFilters(new URLSearchParams('mt=yes')).myTurnOnly).toBe(false);
  });
});
