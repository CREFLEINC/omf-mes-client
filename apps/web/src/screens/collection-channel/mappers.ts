import type { components } from '@omf-mes/api-client';

import type { ChannelFormValues, CollectionChannel } from './types';

type CollectionChannelCreate = components['schemas']['CollectionChannelCreate'];
type CollectionChannelUpdate = components['schemas']['CollectionChannelUpdate'];

/** 빈 폼. 등록 창이 여기서 시작한다. */
export const emptyFormValues = (): ChannelFormValues => ({
  channelKey: '',
  signalName: '',
  unitCode: '',
  /* 새 채널은 아직 이어 둔 데가 없다 — 그 상태로 등록할 수 있다(스펙 §5-2). */
  inspectionItemId: null,
});

/**
 * 받아 온 채널로 폼을 채운다.
 *
 * ⭐ **오지 않은 값은 빈 문자열이 된다** — 폼 칸은 「없음」을 빈 칸으로 표현한다.
 */
export const formValuesFrom = (channel: CollectionChannel): ChannelFormValues => ({
  channelKey: channel.channelKey,
  signalName: channel.signalName ?? '',
  unitCode: channel.unitCode ?? '',
  /* 값이 오지 않는 것과 `null` 은 같은 뜻이다 — 둘 다 「이어 둔 데가 없다」(`channel-notes.ts`). */
  inspectionItemId: channel.inspectionItemId ?? null,
});

/**
 * 보낼 값으로 다듬는다. **앞뒤 공백은 값이 아니다.**
 *
 * ⚠ **빈 칸을 보내는 길이 이것뿐이다.** 계약의 수정 본문은 `signalName` 을 널 허용으로 두지
 * 않았고(`string` 이다), 빼면 「그대로 두라」는 뜻이 되어 **한번 적은 이름을 지울 수 없다.**
 * 그래서 지울 때는 빈 문자열을 보낸다 — 목록이 빈 문자열도 「기록 없음」으로 그린다.
 */
const trimmed = (value: string): string => value.trim();

/**
 * 등록 본문. **설비는 폼이 아니라 화면이 준다** — 왼쪽에서 고른 것에 매인다.
 *
 * ⛔ **등록에서는 빈 칸을 아예 뺀다.** 새로 만드는 자리에는 「그대로 두라」가 없어서,
 * 빈 문자열을 굳이 실어 「이름이 빈 신호」를 만들 이유가 없다.
 */
export const toChannelCreate = (
  values: ChannelFormValues,
  equipmentId: number,
): CollectionChannelCreate => {
  const signalName = trimmed(values.signalName);
  const unitCode = trimmed(values.unitCode);

  return {
    equipmentId,
    channelKey: trimmed(values.channelKey),
    ...(signalName === '' ? {} : { signalName }),
    ...(unitCode === '' ? {} : { unitCode }),
    /* 이어 둔 데가 있으면 처음부터 실어 보낸다 — 등록 뒤 다시 열어 잇게 하지 않는다. */
    ...(values.inspectionItemId === null ? {} : { inspectionItemId: values.inspectionItemId }),
  };
};

/**
 * 수정 본문.
 *
 * ⛔ **채널명을 싣지 않는다** — 계약의 수정 본문에 없다. 실어 봐야 서버가 버리고, 화면은
 * 바뀐 줄 알게 된다.
 *
 * ⭐ **손대지 않는 값도 «지금 값»을 실어 보낸다.** 계약이 전 필드를 선택으로 두어, 뺀 필드를
 * 서버가 「그대로 두라」로 읽을지 「비우라」로 읽을지 **이 계약만으로는 알 수 없다.** 어느
 * 쪽으로 읽혀도 같은 결과가 나오는 유일한 방법이 지금 값을 그대로 되보내는 것이다.
 *
 * ⭐ **검사 항목은 이제 폼에서 온다** — 창에서 잇고 끊을 수 있다. `null` 은 「끊었다」는
 * 뜻이고 그 순간부터 그 채널의 값은 버려진다.
 *
 * ⛔ **사용 여부는 여전히 폼이 아니라 «지금 값»에서 온다.** 이 창에는 켜고 끄는 자리가 없어
 * 폼에 두면 값이 어디서 정해지는지 흐려진다.
 */
export const toChannelUpdate = (
  values: ChannelFormValues,
  current: Pick<CollectionChannel, 'isActive'>,
): CollectionChannelUpdate => ({
  signalName: trimmed(values.signalName),
  unitCode: trimmed(values.unitCode),
  inspectionItemId: values.inspectionItemId,
  isActive: current.isActive,
});
