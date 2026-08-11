import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { describeErpQueue, erpQueueText } from './erp-status';

const t = messages.goodsReceipt;

describe('describeErpQueue — 세 갈래', () => {
  it('참이면 적재됨이다', () => {
    expect(describeErpQueue(true)).toEqual({ kind: 'queued' });
  });

  it('거짓이면 적재되지 않음이다', () => {
    expect(describeErpQueue(false)).toEqual({ kind: 'notQueued' });
  });

  /*
   * **M35** — 계약이 `erpMessageQueued`를 선택 필드로 두었다. `queued ?? true`로 접으면
   * 값이 오지 않은 건이 「적재됐다」로 보이는데, 그것이 이 화면에서 가장 나쁜 오해다.
   */
  it('응답에 값이 없으면 참으로 읽지 않고 알 수 없음으로 가른다', () => {
    expect(describeErpQueue(undefined)).toEqual({ kind: 'unknown' });
  });

  it('세 갈래가 서로 다른 값이다', () => {
    const states = [describeErpQueue(true), describeErpQueue(false), describeErpQueue(undefined)];

    expect(new Set(states.map((state) => state.kind)).size).toBe(3);
  });
});

describe('erpQueueText — 문구', () => {
  /* **M36** — 참과 거짓을 한 문구로 뭉개면 조건부 승인으로 들어온 건이 반영된 줄로 읽힌다. */
  it('세 갈래의 문구가 서로 다르다', () => {
    const texts = [
      erpQueueText({ kind: 'queued' }),
      erpQueueText({ kind: 'notQueued' }),
      erpQueueText({ kind: 'unknown' }),
    ];

    expect(new Set(texts).size).toBe(3);
    /* 짝 방향 — 셋 다 실제 문구가 있다(빈 문자열 셋은 「서로 다르다」를 통과하지 못하지만 명시한다). */
    for (const text of texts) expect(text.length).toBeGreaterThan(0);
  });

  /* **M37** — 이슈 §6의 ⭐. 「적재」는 「전송」이 아니다. */
  it('어느 갈래에도 「전송 완료」가 없다', () => {
    const texts = [
      erpQueueText({ kind: 'queued' }),
      erpQueueText({ kind: 'notQueued' }),
      erpQueueText({ kind: 'unknown' }),
    ];

    for (const text of texts) expect(text).not.toContain('전송 완료');
    /* 짝 방향 — 적재됨 갈래는 「대기열」이라는 낱말로 무엇이 일어났는지 말한다. */
    expect(erpQueueText({ kind: 'queued' })).toContain('대기열');
  });

  it('문구가 i18n 정본과 같다', () => {
    expect(erpQueueText({ kind: 'queued' })).toBe(t.result.erpQueued);
    expect(erpQueueText({ kind: 'notQueued' })).toBe(t.result.erpNotQueued);
    expect(erpQueueText({ kind: 'unknown' })).toBe(t.result.erpUnknown);
  });
});
