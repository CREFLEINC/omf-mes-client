import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { notificationFixture } from './fixtures';
import { toTargetLink } from './target-link';
import { toNotificationView } from './types';

const t = messages.notificationCenter;

const viewOf = (overrides: Parameters<typeof notificationFixture>[0] = {}) =>
  toNotificationView(notificationFixture(overrides));

/** 화면이 만든 제목 — **푼 이름**이다. 링크 이름이 이것을 쓰는지가 이 파일의 한 축이다. */
const TITLE = '합성 이벤트 가';

const APPROVAL = { targetTypeCode: 'APPROVAL_REQUEST', targetId: 7201 };

describe('toTargetLink — 대응표에 있는 유형', () => {
  it('결재 요청은 결재함의 그 건을 가리킨다', () => {
    expect(toTargetLink(viewOf(APPROVAL), TITLE)?.to).toBe('/approval/inbox?rq=7201');
  });

  it('번호가 주소에 그대로 실린다 — 다른 건이 열리면 안 된다', () => {
    expect(toTargetLink(viewOf({ ...APPROVAL, targetId: 7209 }), TITLE)?.to).toContain('rq=7209');
  });

  /**
   * ⭐ **이름이 화면이 만든 제목을 쓴다 — 원본 코드가 아니다.**
   *
   * 카드 제목이 풀린 이름인데 그 옆 링크만 코드를 들면, 보조 기술 사용자에게 카드는
   * 「합성 이벤트 가」로 링크는 「SYN-EVENT-01 …」로 들려 **둘을 잇는 글자가 없다.**
   */
  it('링크 이름이 카드 제목과 같은 글자를 든다', () => {
    const link = toTargetLink(viewOf({ ...APPROVAL, eventCode: 'SYN-EVENT-07' }), TITLE);

    expect(link?.label).toBe(t.actions.openTarget(TITLE));
    expect(link?.label).not.toContain('SYN-EVENT-07');
  });

  /** 못 푼 코드는 **제목 자체가 원문**이다(T2의 낙하 규율) — 이 함수는 판정하지 않는다. */
  it('제목이 원문이면 링크 이름도 원문을 든다', () => {
    expect(toTargetLink(viewOf(APPROVAL), 'SYN-EVENT-99')?.label).toBe(
      t.actions.openTarget('SYN-EVENT-99'),
    );
  });

  /** ⚠ 보이는 글자를 이름이 담는다 — 담지 않으면 음성 조작이 보이는 글자로 부를 수 없다. */
  it('접근성 이름이 보이는 글자를 담는다', () => {
    const link = toTargetLink(viewOf(APPROVAL), TITLE);

    expect(link?.shortLabel).toBe(t.actions.openTargetShort);
    expect(link?.label).toContain(t.actions.openTargetShort);
  });
});

describe('toTargetLink — 열지 않는 갈래', () => {
  /**
   * ⭐ **계약 표에는 있는데 이 앱에 도착지가 없는 셋.** 주소를 지어내면 사용자는 눌러서
   * 첫 화면으로 튕긴다 — 공유계약 A-10 규칙 2가 막으려던 일이 그대로 일어난다.
   */
  it('도착지가 없는 계약 유형에는 링크를 만들지 않는다', () => {
    for (const targetTypeCode of ['LOT', 'WORK_ORDER', 'NONCONFORMANCE']) {
      expect(toTargetLink(viewOf({ targetTypeCode, targetId: 7201 }), TITLE)).toBeNull();
    }
  });

  it('모르는 코드에도 만들지 않는다', () => {
    expect(
      toTargetLink(viewOf({ targetTypeCode: 'SYN-UNKNOWN', targetId: 7201 }), TITLE),
    ).toBeNull();
  });

  /** 목 서버가 실제로 채우는 자리표시 값이다(검증 실측) — 그것으로도 열리면 안 된다. */
  it('목이 채우는 자리표시 값에도 만들지 않는다', () => {
    expect(toTargetLink(viewOf({ targetTypeCode: 'string', targetId: 7201 }), TITLE)).toBeNull();
  });

  /**
   * ⭐ **두 칸이 다 있어야 한다.** 계약이 둘을 **각각 선택**으로 두어 한쪽만 오는 것을 막지
   * 않는다 — 유형만 있으면 어느 건인지 모르고, 번호만 있으면 어느 표의 것인지 모른다.
   */
  it('유형만 있으면 만들지 않는다', () => {
    expect(toTargetLink(viewOf({ targetTypeCode: 'APPROVAL_REQUEST' }), TITLE)).toBeNull();
  });

  it('번호만 있으면 만들지 않는다', () => {
    expect(toTargetLink(viewOf({ targetId: 7201 }), TITLE)).toBeNull();
  });

  it('둘 다 없으면 만들지 않는다', () => {
    expect(toTargetLink(viewOf(), TITLE)).toBeNull();
  });

  /** 짝 양성 — 같은 번호라도 유형이 대응표에 있으면 실제로 열린다. 둘이 갈려야 뜻이 있다. */
  it('같은 번호라도 유형이 대응표에 있으면 열린다', () => {
    expect(toTargetLink(viewOf({ targetTypeCode: 'LOT', targetId: 7201 }), TITLE)).toBeNull();
    expect(toTargetLink(viewOf(APPROVAL), TITLE)).not.toBeNull();
  });
});
