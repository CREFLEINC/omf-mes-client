import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_EVENT_TYPE_CODES,
  PLACEHOLDER_TARGET_TYPE_CODES,
  distinctValues,
  toCodeOptions,
  withCurrentValue,
} from './filter-options';
import { auditEvent } from './fixtures';

describe('자리표시 상수', () => {
  /*
   * 값 목록이 확정되지 않았다. 예시 문자열을 넣으면 화면이 없는 값을 고르게 만든다 —
   * 확정되면 이 배열만 채운다.
   */
  it('대상 유형은 고정 enum을 쓰고 이벤트 유형은 운영 목록을 기다린다', () => {
    expect(PLACEHOLDER_TARGET_TYPE_CODES).toEqual([
      'APP_USER',
      'ROLE',
      'WORKER',
      'TERMINAL',
      'ITEM',
      'ROUTING',
      'INSPECTION_PLAN_VERSION',
    ]);
    expect(PLACEHOLDER_EVENT_TYPE_CODES).toEqual([]);
  });
});

describe('distinctValues', () => {
  it('중복을 접고 오름차순으로 낸다', () => {
    const rows = [
      auditEvent({ targetTypeCode: 'WORKER' }),
      auditEvent({ targetTypeCode: 'ITEM' }),
      auditEvent({ targetTypeCode: 'WORKER' }),
    ];

    expect(distinctValues(rows, (row) => row.targetTypeCode)).toEqual(['ITEM', 'WORKER']);
  });

  it('빈 값은 선택지가 되지 않는다', () => {
    /* 빈 값은 계약 밖이다 — 서버가 비워 보냈을 때 선택지가 서지 않는지만 잰다. */
    const rows = [
      auditEvent({ targetTypeCode: '' as never }),
      auditEvent({ targetTypeCode: 'ROLE' }),
    ];

    expect(distinctValues(rows, (row) => row.targetTypeCode)).toEqual(['ROLE']);
  });
});

describe('withCurrentValue', () => {
  /*
   * 남기지 않으면 기간을 바꿨을 때 고른 값이 목록에서 사라져 **해제할 방법이 없어진다.**
   */
  it('고른 값이 목록에 없으면 맨 앞에 남긴다', () => {
    expect(withCurrentValue(['SAMPLE_B'], 'SAMPLE_A')).toEqual(['SAMPLE_A', 'SAMPLE_B']);
  });

  it('이미 목록에 있으면 그대로 둔다', () => {
    expect(withCurrentValue(['SAMPLE_A', 'SAMPLE_B'], 'SAMPLE_A')).toEqual([
      'SAMPLE_A',
      'SAMPLE_B',
    ]);
  });

  it('고른 값이 없으면 목록 그대로다', () => {
    expect(withCurrentValue(['SAMPLE_A'], '')).toEqual(['SAMPLE_A']);
  });
});

describe('toCodeOptions', () => {
  it('자리표시 상수·조회 결과·지금 고른 값을 한 목록으로 합친다', () => {
    const rows = [
      auditEvent({ eventTypeCode: 'SAMPLE_EVENT_B' }),
      auditEvent({ eventTypeCode: 'SAMPLE_EVENT_A' }),
    ];

    expect(toCodeOptions([], rows, (row) => row.eventTypeCode, 'SAMPLE_EVENT_Z')).toEqual([
      'SAMPLE_EVENT_Z',
      'SAMPLE_EVENT_A',
      'SAMPLE_EVENT_B',
    ]);
  });

  it('자리표시 상수와 조회 결과가 겹치면 한 번만 낸다', () => {
    const rows = [auditEvent({ eventTypeCode: 'SAMPLE_EVENT_A' })];

    expect(toCodeOptions(['SAMPLE_EVENT_A'], rows, (row) => row.eventTypeCode, '')).toEqual([
      'SAMPLE_EVENT_A',
    ]);
  });
});
