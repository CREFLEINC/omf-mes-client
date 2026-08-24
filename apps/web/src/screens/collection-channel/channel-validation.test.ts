import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { CHANNEL_FORM_FIELDS, validateChannel } from './channel-validation';
import { emptyFormValues } from './mappers';
import type { ChannelFormValues } from './types';

const t = messages.collectionChannel.validation;

const form = (overrides: Partial<ChannelFormValues> = {}): ChannelFormValues => ({
  ...emptyFormValues(),
  channelKey: 'CYCLE_TIME',
  ...overrides,
});

describe('채널 검증', () => {
  it('채널명이 있으면 통과한다', () => {
    expect(validateChannel(form())).toEqual({});
  });

  it('채널명이 비면 필수라고 말한다', () => {
    expect(validateChannel(form({ channelKey: '' })).channelKey).toBe(t.required);
  });

  /** 공백만 친 것은 「비었다」와 다른 실수다 — 다른 말로 짚어야 무엇을 고칠지 안다. */
  it('공백만 친 채널명은 따로 짚는다', () => {
    expect(validateChannel(form({ channelKey: '   ' })).channelKey).toBe(t.channelKeyBlank);
  });

  /**
   * ⭐ **신호 이름과 단위를 필수로 두지 않는다.** 막으면 채널을 등록하지 못해
   * 미매핑 목록에도 뜨지 않는다 — 무엇이 오는지조차 알 수 없게 된다.
   */
  it('신호 이름과 단위가 비어도 막지 않는다', () => {
    expect(validateChannel(form({ signalName: '', unitCode: '' }))).toEqual({});
  });

  /** ⛔ 채널명 중복은 서버 몫이다 — 화면은 «불러온» 것만 알아 거짓 통과가 난다. */
  it('중복을 화면이 판정하지 않는다', () => {
    expect(Object.keys(validateChannel(form({ channelKey: 'CYCLE_TIME' })))).toHaveLength(0);
  });
});

describe('인라인으로 낼 수 있는 칸', () => {
  /** ⛔ 오류를 그릴 자리가 없는 칸을 넣으면 «어디에도 표시되지 않는 오류»가 된다. */
  it('창에 실제로 있는 칸들뿐이다', () => {
    expect([...CHANNEL_FORM_FIELDS]).toEqual([
      'channelKey',
      'signalName',
      'unitCode',
      'itemId',
      'processId',
    ]);
  });

  it('설비는 여기 없다 — 이 창에 고르는 칸이 없다', () => {
    expect(CHANNEL_FORM_FIELDS).not.toContain('equipmentId');
  });
});
