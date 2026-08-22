import { messages } from '@omf-mes/i18n';

import type { ChannelFormValues } from './types';

const t = messages.collectionChannel.validation;

/**
 * 서버가 준 필드 오류를 **인라인으로 낼 수 있는** 칸 이름. 목록에 없는 필드명은 삼키지 않고
 * 배너로 간다.
 *
 * ⛔ **오류를 그릴 자리가 없는 칸을 여기 넣지 않는다.** 넣으면 그 오류는 인라인으로 분류된 뒤
 * 아무 데도 그려지지 않아 **어디에도 표시되지 않는 오류**가 된다 — 배너로 갔으면 보였을 것이다.
 *
 * ⚠ `equipmentId` 는 여기 없다. 이 창에 설비를 고르는 칸이 없어 그릴 자리가 없다.
 */
export const CHANNEL_FORM_FIELDS: readonly string[] = ['channelKey', 'signalName', 'unitCode'];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다. **채널명 중복은 서버 몫이다** —
 * 화면은 같은 설비의 «불러온» 채널만 알고, 그것으로 판정하면 잘린 목록에서 거짓 통과가 난다.
 *
 * ⭐ **신호 이름과 단위를 필수로 두지 않는다.** 계약이 선택으로 두었고, 실제로도 설비가
 * 보내오는 이름만 알고 나머지는 나중에 채우는 일이 있다 — 막으면 **채널을 등록하지 못해
 * 미매핑 목록에도 뜨지 않는다.**
 */
export const validateChannel = (values: ChannelFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.channelKey === '') {
    errors.channelKey = t.required;
  } else if (values.channelKey.trim() === '') {
    errors.channelKey = t.channelKeyBlank;
  }

  return errors;
};
