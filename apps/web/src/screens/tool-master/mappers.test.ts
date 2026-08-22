import { describe, expect, it } from 'vitest';

import { emptyFormValues, formValuesFrom, toToolCreate, toToolUpdate } from './mappers';
import { makeTool, toolDueByDate, toolWithoutGuaranteed } from './fixtures';
import type { ToolFormValues } from './types';

const values = (overrides: Partial<ToolFormValues> = {}): ToolFormValues => ({
  ...emptyFormValues('11'),
  moldCode: 'TL-01',
  moldName: '프레스 금형',
  toolTypeCode: 'MOLD',
  ...overrides,
});

describe('formValuesFrom', () => {
  it('상세의 값을 폼 값으로 옮긴다', () => {
    expect(formValuesFrom(toolDueByDate)).toEqual({
      moldCode: 'TL-03',
      moldName: 'TL-03 툴',
      toolTypeCode: 'MOLD',
      plantId: '11',
      cavityCount: '1',
      guaranteedShotCount: '300000',
      pmTriggerTypeCode: 'DATE',
      pmCycleInterval: '6',
      pmCycleUnitCode: 'MONTH',
    });
  });

  /* 없는 값은 빈 칸이다 — `0` 이나 「없음」 같은 글자를 지어내지 않는다. */
  it('없는 값은 빈 칸으로 둔다', () => {
    const form = formValuesFrom(toolWithoutGuaranteed);

    expect(form.guaranteedShotCount).toBe('');
    expect(form.pmCycleInterval).toBe('');
    expect(form.pmCycleUnitCode).toBe('');
  });

  /* ⛔ `0` 은 온 값이다 — 빈 칸으로 옮기면 저장할 때 「없음」이 되어 값이 사라진다. */
  it('0 은 0 으로 옮긴다', () => {
    expect(formValuesFrom(makeTool(1, 'TL-99', { cavityCount: 0 })).cavityCount).toBe('0');
  });
});

describe('emptyFormValues', () => {
  /* 계약의 기본값이고, 금형이 아닌 도구도 하나로 세는 것이 맞다. */
  it('캐비티 수의 처음 값은 1 이다', () => {
    expect(emptyFormValues('').cavityCount).toBe('1');
  });

  /* 예방보전을 하겠다는 것은 사용자가 고르는 것이지 화면이 가정할 것이 아니다. */
  it('판정 기준의 처음 값은 「하지 않음」이다', () => {
    expect(emptyFormValues('').pmTriggerTypeCode).toBe('NONE');
  });

  it('목록에서 고른 공장을 따른다', () => {
    expect(emptyFormValues('12').plantId).toBe('12');
  });
});

describe('toToolUpdate', () => {
  /*
   * ⛔ 계약이 수정 본문에 받지 않는 것들 — 공장·상태·누계 타발수·마지막 시행일.
   * 실으면 서버가 거절하고, 실을 수 있게 두면 언젠가 입력칸이 붙는다.
   */
  it('공장·상태·누계 타발수·마지막 시행일을 싣지 않는다', () => {
    const body = toToolUpdate(values(), true);

    expect(body).not.toHaveProperty('plantId');
    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('currentShotCount');
    expect(body).not.toHaveProperty('lastPmDate');
  });

  /* 잠긴 코드는 아예 싣지 않는다 — 서버가 바꾸지 못하는 값을 보내면 거절당한다. */
  it('코드를 고칠 수 없으면 코드를 싣지 않는다', () => {
    expect(toToolUpdate(values(), false)).not.toHaveProperty('moldCode');
    expect(toToolUpdate(values(), true).moldCode).toBe('TL-01');
  });

  it('코드와 이름의 앞뒤 공백을 다듬는다', () => {
    const body = toToolUpdate(values({ moldCode: '  TL-01  ', moldName: '  프레스  ' }), true);

    expect(body.moldCode).toBe('TL-01');
    expect(body.moldName).toBe('프레스');
  });

  /* ⛔ 빈 칸은 `null` 이지 `0` 이 아니다 — `0` 은 「이미 다 썼다」로 셈된다. */
  it('적정타수가 비면 null 을 보낸다', () => {
    expect(toToolUpdate(values({ guaranteedShotCount: '' }), true).guaranteedShotCount).toBeNull();
  });

  it('적정타수를 수로 보낸다', () => {
    expect(toToolUpdate(values({ guaranteedShotCount: '500000' }), true).guaranteedShotCount).toBe(
      500_000,
    );
  });

  /*
   * ⭐ **날짜 축을 쓰지 않으면 주기를 비운다.** 남겨 두면 서버 자료가 모순이 된다 —
   * 타발수로만 판정하는데 6개월 주기가 붙은 꼴이다.
   */
  it.each(['NONE', 'SHOT'])('%s 이면 주기를 비워 보낸다', (trigger) => {
    const body = toToolUpdate(
      values({ pmTriggerTypeCode: trigger, pmCycleInterval: '6', pmCycleUnitCode: 'MONTH' }),
      true,
    );

    expect(body.pmCycleInterval).toBeNull();
    expect(body.pmCycleUnitCode).toBeNull();
  });

  it.each(['DATE', 'BOTH'])('%s 이면 주기를 그대로 보낸다', (trigger) => {
    const body = toToolUpdate(
      values({ pmTriggerTypeCode: trigger, pmCycleInterval: '6', pmCycleUnitCode: 'MONTH' }),
      true,
    );

    expect(body.pmCycleInterval).toBe(6);
    expect(body.pmCycleUnitCode).toBe('MONTH');
  });

  it('캐비티 수를 수로 보낸다', () => {
    expect(toToolUpdate(values({ cavityCount: '4' }), true).cavityCount).toBe(4);
  });
});

describe('toToolCreate', () => {
  it('수정 본문에 공장을 더한 형태다', () => {
    const body = toToolCreate(values({ plantId: '12' }));

    expect(body.plantId).toBe(12);
    expect(body.moldCode).toBe('TL-01');
    expect(body.moldName).toBe('프레스 금형');
  });

  /* 등록에는 잠긴 코드가 없다 — 아직 아무도 그 코드를 참조하지 않는다. */
  it('등록은 코드를 언제나 싣는다', () => {
    expect(toToolCreate(values()).moldCode).toBe('TL-01');
  });
});
