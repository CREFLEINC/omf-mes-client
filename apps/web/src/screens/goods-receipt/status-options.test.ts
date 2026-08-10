import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  irStatusNote,
  irStatusOptions,
  irStatusPlaceholder,
  PLACEHOLDER_IR_STATUS_CODES,
} from './status-options';

describe('PLACEHOLDER_IR_STATUS_CODES', () => {
  /*
   * **M43** — 계약이 「확정된 값 목록이 아직 없다」고 적었고 그 목록을 주는 오퍼레이션도 없다.
   * 계약의 `@example` 값을 채우면 사용자는 고를 수 있다고 믿는데 서버는 그 값을 모른다.
   *
   * **조회 조건이라 비어 있어도 화면이 돈다** — 여기가 자리표시를 그대로 쓸 수 있는 자리다.
   * 요청 필수 코드는 사정이 다르며 그 자리는 PR ②에 있다.
   */
  it('상태 자리표시가 비어 있다', () => {
    expect(PLACEHOLDER_IR_STATUS_CODES).toEqual([]);
  });

  it('선택지도 비어 있다', () => {
    expect(irStatusOptions()).toEqual([]);
  });
});

describe('irStatusNote · irStatusPlaceholder', () => {
  /* 비어 있는 선택칸만 두면 고장으로 읽힌다. 왜 비어 있는지 밝힌다. */
  it('왜 비어 있는지 밝히는 공통 안내를 쓴다', () => {
    expect(irStatusNote()).toBe(messages.pendingCode.note);
    expect(irStatusPlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  it('안내가 비어 있지 않다', () => {
    expect(irStatusNote().length).toBeGreaterThan(0);
  });
});
