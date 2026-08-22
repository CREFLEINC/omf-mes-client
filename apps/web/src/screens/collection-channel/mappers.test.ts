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
  it('빈 폼은 세 칸이 모두 비어 있다', () => {
    expect(emptyFormValues()).toEqual({ channelKey: '', signalName: '', unitCode: '' });
  });

  it('받아 온 채널로 폼을 채운다', () => {
    const values = formValuesFrom(
      makeChannel(7001, 'CYCLE_TIME', { signalName: '사이클 타임', unitCode: 'SEC' }),
    );

    expect(values).toEqual({
      channelKey: 'CYCLE_TIME',
      signalName: '사이클 타임',
      unitCode: 'SEC',
    });
  });

  /** 오지 않은 값은 빈 칸이다 — `undefined` 를 칸에 넣으면 제어 컴포넌트가 풀린다. */
  it('오지 않은 값은 빈 칸이 된다', () => {
    expect(formValuesFrom(makeChannel(7001, 'CYCLE_TIME'))).toEqual({
      channelKey: 'CYCLE_TIME',
      signalName: '',
      unitCode: '',
    });
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
  const current = { inspectionItemId: 5001, isActive: true };

  /** ⛔ 계약의 수정 본문에 채널명이 없다 — 실어 봐야 서버가 버리고 화면은 바뀐 줄 안다. */
  it('채널명을 싣지 않는다', () => {
    expect('channelKey' in toChannelUpdate(form(), current)).toBe(false);
  });

  /**
   * ⭐ **손대지 않는 값도 지금 값을 되보낸다.** 뺀 필드를 서버가 「그대로 두라」로 읽을지
   * 「비우라」로 읽을지 계약만으로는 알 수 없다 — 어느 쪽으로 읽혀도 같은 결과가 나와야 한다.
   */
  it('이어 둔 검사 항목을 그대로 되보낸다', () => {
    expect(toChannelUpdate(form(), current).inspectionItemId).toBe(5001);
  });

  it('이어 두지 않았으면 그 사실을 그대로 되보낸다', () => {
    const body = toChannelUpdate(form(), { inspectionItemId: undefined, isActive: true });

    expect(body.inspectionItemId).toBeNull();
  });

  it('사용 여부를 그대로 되보낸다', () => {
    expect(toChannelUpdate(form(), { inspectionItemId: null, isActive: false }).isActive).toBe(
      false,
    );
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
