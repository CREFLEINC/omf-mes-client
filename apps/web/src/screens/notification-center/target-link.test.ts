import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { notificationFixture } from './fixtures';
import { toTargetLink } from './target-link';
import { toNotificationView } from './types';

const t = messages.notificationCenter;

const viewOf = (overrides: Parameters<typeof notificationFixture>[0] = {}) =>
  toNotificationView(notificationFixture(overrides));

describe('toTargetLink — 대응표에 있는 유형', () => {
  it('결재 요청은 결재함의 그 건을 가리킨다', () => {
    const link = toTargetLink(viewOf({ targetTypeCode: 'APPROVAL_REQUEST', targetId: 7201 }));

    expect(link?.to).toBe('/approval/inbox?rq=7201');
  });

  /** 목록에 버튼이 여럿 서므로 **어느 대상인지**가 이름에 들어가야 한다. */
  it('버튼 이름이 어느 대상인지 밝힌다', () => {
    const link = toTargetLink(
      viewOf({ eventCode: 'SYN-EVENT-07', targetTypeCode: 'APPROVAL_REQUEST', targetId: 7201 }),
    );

    expect(link?.label).toBe(t.actions.openTarget('SYN-EVENT-07'));
  });

  it('번호가 주소에 그대로 실린다 — 다른 건이 열리면 안 된다', () => {
    expect(
      toTargetLink(viewOf({ targetTypeCode: 'APPROVAL_REQUEST', targetId: 7209 }))?.to,
    ).toContain('rq=7209');
  });
});

describe('toTargetLink — 열지 않는 갈래', () => {
  /**
   * ⭐ **계약 표에는 있는데 이 앱에 도착지가 없는 셋.** 주소를 지어내면 사용자는 눌러서
   * 첫 화면으로 튕긴다 — 공유계약 A-10 규칙 2가 막으려던 일이 그대로 일어난다.
   */
  it('도착지가 없는 계약 유형에는 링크를 만들지 않는다', () => {
    for (const targetTypeCode of ['LOT', 'WORK_ORDER', 'NONCONFORMANCE']) {
      expect(toTargetLink(viewOf({ targetTypeCode, targetId: 7201 }))).toBeNull();
    }
  });

  it('모르는 코드에도 만들지 않는다', () => {
    expect(toTargetLink(viewOf({ targetTypeCode: 'SYN-UNKNOWN', targetId: 7201 }))).toBeNull();
  });

  /** 목 서버가 실제로 채우는 자리표시 값이다(검증 실측) — 그것으로도 열리면 안 된다. */
  it('목이 채우는 자리표시 값에도 만들지 않는다', () => {
    expect(toTargetLink(viewOf({ targetTypeCode: 'string', targetId: 7201 }))).toBeNull();
  });

  /**
   * ⭐ **두 칸이 다 있어야 한다.** 계약이 둘을 **각각 선택**으로 두어 한쪽만 오는 것을 막지
   * 않는다 — 유형만 있으면 어느 건인지 모르고, 번호만 있으면 어느 표의 것인지 모른다.
   */
  it('유형만 있으면 만들지 않는다', () => {
    expect(toTargetLink(viewOf({ targetTypeCode: 'APPROVAL_REQUEST' }))).toBeNull();
  });

  it('번호만 있으면 만들지 않는다', () => {
    expect(toTargetLink(viewOf({ targetId: 7201 }))).toBeNull();
  });

  it('둘 다 없으면 만들지 않는다', () => {
    expect(toTargetLink(viewOf())).toBeNull();
  });

  /** 짝 양성 — 같은 번호라도 유형이 대응표에 있으면 실제로 열린다. 둘이 갈려야 뜻이 있다. */
  it('같은 번호라도 유형이 대응표에 있으면 열린다', () => {
    expect(toTargetLink(viewOf({ targetTypeCode: 'LOT', targetId: 7201 }))).toBeNull();
    expect(
      toTargetLink(viewOf({ targetTypeCode: 'APPROVAL_REQUEST', targetId: 7201 })),
    ).not.toBeNull();
  });
});
