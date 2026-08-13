import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { MAPPED_SCREEN_ID, MAPPED_SCREEN_PATH, targetFixtures } from './fixtures';
import { SCREEN_ROUTES } from './screen-routes';
import { describeOpenBlock, describeTargetName, judgeTargetOpen } from './target';

const t = messages.iqcSkipApproval;

/** 규약이 정해진 뒤의 매핑표. 「채우면 열린다」를 재는 자리에만 쓴다. */
const FILLED_ROUTES = { [MAPPED_SCREEN_ID]: MAPPED_SCREEN_PATH };

describe('judgeTargetOpen — 잠기는 세 갈래', () => {
  it('계약이 열 수 없다고 하면 잠긴다', () => {
    expect(judgeTargetOpen(targetFixtures.notOpenable, FILLED_ROUTES)).toEqual({
      kind: 'notOpenable',
    });
  });

  /**
   * **차례가 곧 우선순위다.** 「열 수 없다」가 화면 ID보다 이긴다 — 서버가 권한·상태를 보고
   * 내린 판정이고 화면은 그 근거를 갖고 있지 않다. 이 픽스처는 화면 ID가 실려 있고
   * **매핑표에도 그 줄이 있는** 대상이라, 차례가 뒤집힌 구현은 곧바로 열린다.
   */
  it('열 수 없다는 말이 화면 ID보다 이긴다', () => {
    expect(targetFixtures.notOpenable.screenId).toBe(MAPPED_SCREEN_ID);
    expect(judgeTargetOpen(targetFixtures.notOpenable, FILLED_ROUTES).kind).not.toBe('open');
  });

  it('열 수 있다는데 화면 ID가 없으면 잠긴다', () => {
    expect(judgeTargetOpen(targetFixtures.noScreenId, FILLED_ROUTES)).toEqual({
      kind: 'noScreenId',
    });
  });

  it('화면 ID가 이 앱의 표에 없으면 잠긴다', () => {
    expect(judgeTargetOpen(targetFixtures.unmapped, FILLED_ROUTES)).toEqual({ kind: 'unmapped' });
  });

  /** 지금의 사실 — 표가 비어 있어 **열 수 있는 대상도 잠긴다.** */
  it('표가 비어 있는 지금은 열 수 있는 대상도 잠긴다', () => {
    expect(judgeTargetOpen(targetFixtures.mapped, SCREEN_ROUTES)).toEqual({ kind: 'unmapped' });
  });

  /**
   * **프로토타입에서 온 낱말로는 열리지 않는다.**
   *
   * 표가 객체 리터럴이라 `toString`·`constructor` 같은 화면 ID가 오면 조회가 함수를 낸다.
   * 그것이 걸러지지 않으면 이 판정이 `{ kind: 'open', path: <함수> }`를 내고, 「열기」가
   * **살아 있는 버튼**으로 서서 누르면 함수가 경로 자리에 실려 간다 — 이 구획의 규율
   * (「잠겨 있고 왜 잠겼는지 말한다」)이 그 갈래에서만 깨진다.
   */
  it.each(['toString', 'constructor', 'valueOf'])(
    '프로토타입에서 온 화면 ID %s는 열림이 되지 않는다',
    (screenId) => {
      const target = { ...targetFixtures.mapped, screenId };

      expect(judgeTargetOpen(target, FILLED_ROUTES)).toEqual({ kind: 'unmapped' });
    },
  );

  /**
   * **전환 감지기**(M28) — 표에 줄이 생기면 그것만으로 열린다.
   * 잠금을 상수로 굳힌 구현은 여기서 걸린다.
   */
  it('표를 채우면 열리고 그 경로를 낸다', () => {
    expect(judgeTargetOpen(targetFixtures.mapped, FILLED_ROUTES)).toEqual({
      kind: 'open',
      path: MAPPED_SCREEN_PATH,
    });
  });
});

describe('describeOpenBlock — 사유가 서로 다르다', () => {
  /**
   * 셋을 한 갈래로 뭉개지 않는 이유는 **사용자가 할 조치가 다르기 때문**이다.
   * 「열 수 없습니다」 하나만 내면 담당자에게 물어야 할 사람과 기다려야 할 사람이 갈리지 않는다.
   */
  it('세 사유가 서로 다른 글자다', () => {
    const reasons = [
      describeOpenBlock({ kind: 'notOpenable' }),
      describeOpenBlock({ kind: 'noScreenId' }),
      describeOpenBlock({ kind: 'unmapped' }),
    ];

    expect(new Set(reasons).size).toBe(3);
  });

  /** 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4) — 비활성 컨트롤은 포커스를 못 받는다. */
  it('세 사유가 모두 컨트롤 이름으로 시작한다', () => {
    expect(describeOpenBlock({ kind: 'notOpenable' })).toBe(t.target.blockedNotOpenable);
    expect(describeOpenBlock({ kind: 'noScreenId' })).toBe(t.target.blockedNoScreenId);
    expect(describeOpenBlock({ kind: 'unmapped' })).toBe(t.target.blockedUnmapped);
    expect(
      [t.target.blockedNotOpenable, t.target.blockedNoScreenId, t.target.blockedUnmapped].every(
        (reason) => reason.startsWith(t.target.open),
      ),
    ).toBe(true);
  });
});

describe('describeTargetName', () => {
  it('서버가 만든 표시명을 그대로 낸다', () => {
    expect(describeTargetName(targetFixtures.mapped)).toBe('합성 대상 문서 가');
  });

  /**
   * 비어 오면 사실을 적는다. **`targetId`도 `targetTypeCode`도 대신 내지 않는다**
   * (`omf-mes#44`) — 번호는 사용자에게 아무 뜻이 없고, 유형 코드로 이름을 지어내면
   * 그것이 곧 계약이 금지한 매핑표다.
   */
  it('표시명이 비어 오면 그 사실을 적고 번호도 유형 코드도 내지 않는다', () => {
    const name = describeTargetName(targetFixtures.nameless);

    expect(name).toBe(t.values.unknownTarget);
    expect(name).not.toContain(String(targetFixtures.nameless.targetId));
    expect(name).not.toContain(targetFixtures.nameless.targetTypeCode);
  });

  /**
   * **유형이 갈려도 이름이 갈리지 않는다.** 유형 코드로 이름을 짓는 구현은 같은 표시명에
   * 서로 다른 글자를 내게 되고, 그 자리가 곧 금지된 매핑표다.
   */
  it('유형 코드가 달라도 같은 표시명이면 같은 이름이 선다', () => {
    const sameName = { ...targetFixtures.mapped, targetTypeCode: 'SAMPLE-TARGET-Z' };

    expect(describeTargetName(sameName)).toBe(describeTargetName(targetFixtures.mapped));
  });
});
