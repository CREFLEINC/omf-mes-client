import { describe, expect, it } from 'vitest';

import { emptyFormValues, formValuesFrom, toChannelCreate, toChannelUpdate } from './mappers';
import { makeChannel } from './fixtures';
import type { ChannelFormValues } from './types';

const form = (overrides: Partial<ChannelFormValues> = {}): ChannelFormValues => ({
  ...emptyFormValues(),
  channelKey: 'CYCLE_TIME',
  ...overrides,
});

describe('폼 채우기', () => {
  it('빈 폼은 아무 데도 이어져 있지 않다', () => {
    expect(emptyFormValues()).toEqual({
      channelKey: '',
      signalName: '',
      unitCode: '',
      inspectionItemId: null,
      /* 조건도 비운 채로 시작한다 — 비면 「전체」이고 그것이 가장 넓은 기본이다. */
      itemId: null,
      processId: null,
    });
  });

  it('받아 온 채널로 폼을 채운다', () => {
    const values = formValuesFrom(
      makeChannel(7001, 'CYCLE_TIME', { signalName: '사이클 타임', unitCode: 'SEC' }),
    );

    expect(values).toEqual({
      channelKey: 'CYCLE_TIME',
      signalName: '사이클 타임',
      unitCode: 'SEC',
      inspectionItemId: null,
      itemId: null,
      processId: null,
    });
  });

  /** 오지 않은 값은 빈 칸이다 — `undefined` 를 칸에 넣으면 제어 컴포넌트가 풀린다. */
  it('오지 않은 값은 빈 칸이 된다', () => {
    expect(formValuesFrom(makeChannel(7001, 'CYCLE_TIME'))).toEqual({
      channelKey: 'CYCLE_TIME',
      signalName: '',
      unitCode: '',
      inspectionItemId: null,
      itemId: null,
      processId: null,
    });
  });

  /** 값이 오지 않는 것과 `null` 은 같은 뜻이다 — 둘 다 「이어 둔 데가 없다」. */
  it('이어 둔 항목이 있으면 그것을 든다', () => {
    expect(
      formValuesFrom(makeChannel(7001, 'CYCLE_TIME', { inspectionItemId: 5001 })).inspectionItemId,
    ).toBe(5001);
  });
});

describe('등록 본문', () => {
  it('고른 설비에 매인다', () => {
    expect(toChannelCreate(form(), 3001).equipmentId).toBe(3001);
  });

  it('앞뒤 공백을 값으로 보내지 않는다', () => {
    const body = toChannelCreate(form({ channelKey: '  CYCLE_TIME  ' }), 3001);

    expect(body.channelKey).toBe('CYCLE_TIME');
  });

  /** ⛔ 새로 만드는 자리에는 「그대로 두라」가 없다 — 빈 칸을 실어 「이름이 빈 신호」를 만들지 않는다. */
  it('빈 칸은 아예 싣지 않는다', () => {
    const body = toChannelCreate(form(), 3001);

    expect('signalName' in body).toBe(false);
    expect('unitCode' in body).toBe(false);
  });

  /**
   * ⭐ **조건은 빼지 않고 «값으로» 싣는다** — 비었으면 `null` 이고 그것이 「전체」다.
   * 이름·단위와 다르다: 그 둘은 「없음」이 곧 「안 적었다」지만, 조건의 「없음」은
   * **「언제나 적용된다」는 뜻**이고 **유일 범위를 이룬다.**
   */
  it('조건은 비어도 값으로 싣는다', () => {
    const body = toChannelCreate(form(), 3001);

    expect(body.itemId).toBeNull();
    expect(body.processId).toBeNull();
  });

  it('고른 조건을 그대로 싣는다', () => {
    const body = toChannelCreate(form({ itemId: 21, processId: 31 }), 3001);

    expect(body.itemId).toBe(21);
    expect(body.processId).toBe(31);
  });

  /** ⭐ 이어 둔 데 없이 등록할 수 있다(스펙 §5-2) — 항목이 아직 없어도 채널은 먼저 만든다. */
  it('이어 두지 않은 채로 등록할 수 있다', () => {
    expect('inspectionItemId' in toChannelCreate(form(), 3001)).toBe(false);
  });

  it('창에서 이어 두었으면 처음부터 싣는다', () => {
    expect(toChannelCreate(form({ inspectionItemId: 5002 }), 3001).inspectionItemId).toBe(5002);
  });

  it('공백만 친 칸도 싣지 않는다', () => {
    const body = toChannelCreate(form({ signalName: '   ' }), 3001);

    expect('signalName' in body).toBe(false);
  });

  it('적은 값은 다듬어 싣는다', () => {
    const body = toChannelCreate(form({ signalName: ' 사이클 타임 ', unitCode: 'SEC' }), 3001);

    expect(body.signalName).toBe('사이클 타임');
    expect(body.unitCode).toBe('SEC');
  });
});

describe('수정 본문', () => {
  const current = { isActive: true };

  /** ⛔ 계약의 수정 본문에 채널명이 없다 — 실어 봐야 서버가 버리고 화면은 바뀐 줄 안다. */
  it('채널명을 싣지 않는다', () => {
    expect('channelKey' in toChannelUpdate(form(), current)).toBe(false);
  });

  /** ⭐ 조건은 «바꿀 수 있다» — 채널명과 달리 계약의 수정 본문이 받는다. */
  it('조건을 폼에서 받아 싣는다', () => {
    const body = toChannelUpdate(form({ itemId: 22, processId: null }), current);

    expect(body.itemId).toBe(22);
    expect(body.processId).toBeNull();
  });

  /**
   * ⭐ **손대지 않는 값도 지금 값을 되보낸다.** 뺀 필드를 서버가 「그대로 두라」로 읽을지
   * 「비우라」로 읽을지 계약만으로는 알 수 없다 — 어느 쪽으로 읽혀도 같은 결과가 나와야 한다.
   */
  it('창에서 이어 둔 검사 항목을 싣는다', () => {
    expect(toChannelUpdate(form({ inspectionItemId: 5001 }), current).inspectionItemId).toBe(5001);
  });

  /** 끊은 것은 「그대로 두라」가 아니라 «끊으라»는 뜻이다 — 값으로 말해야 한다. */
  it('끊었으면 그 사실을 값으로 싣는다', () => {
    expect(toChannelUpdate(form({ inspectionItemId: null }), current).inspectionItemId).toBeNull();
  });

  /** ⛔ 사용 여부는 폼이 아니라 지금 값에서 온다 — 이 창에는 켜고 끄는 자리가 없다. */
  it('사용 여부를 그대로 되보낸다', () => {
    expect(toChannelUpdate(form(), { isActive: false }).isActive).toBe(false);
  });

  /**
   * ⚠ **빈 칸을 보내는 길이 이것뿐이다.** 계약이 이 칸을 널 허용으로 두지 않아, 빼면
   * 「그대로 두라」가 되어 한번 적은 이름을 지울 수 없다.
   */
  it('지운 칸은 빈 문자열로 보낸다', () => {
    const body = toChannelUpdate(form({ signalName: '', unitCode: '' }), current);

    expect(body.signalName).toBe('');
    expect(body.unitCode).toBe('');
  });

  it('적은 값은 다듬어 보낸다', () => {
    const body = toChannelUpdate(form({ signalName: ' 배럴 온도 ' }), current);

    expect(body.signalName).toBe('배럴 온도');
  });
});
