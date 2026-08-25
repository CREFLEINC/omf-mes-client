import { messages } from '@omf-mes/i18n';

import type { CollectionChannel } from './types';

const t = messages.collectionChannel.scope;

/**
 * 매핑이 **언제** 적용되는지를 읽고 그리는 일.
 *
 * ⭐ **비면 「전체」다** — 고르지 않은 것이 아니라 **전체를 뜻하는 값**이다. 빈 칸으로 두면
 * 설정을 빠뜨린 것으로 읽힌다.
 *
 * ⚠ **이 둘이 유일 범위를 이룬다**(설비 + 채널명 + 품목 + 공정). 같은 설비의 같은 채널이
 * 「품목 A 면 외경, 품목 B 면 두께」로 갈릴 수 있어, 조건 없이 잠그면 **둘째 행이 중복으로
 * 거부된다**(설계 회신 `omf-mes#203` 질문1).
 */

/** 이 행이 조건을 하나라도 지정했는가. */
export const hasScope = (channel: CollectionChannel): boolean =>
  (channel.itemId ?? null) !== null || (channel.processId ?? null) !== null;

/**
 * 조건을 한 줄로. 지정한 것이 없으면 「전체」다.
 *
 * ⛔ **표시용 코드가 오지 않으면 지어내지 않는다**(공유계약 G-9) — 식별자는 있는데 코드가
 * 비어 있으면 **그 값을 아는 척할 수 없다.** 축 이름만 적어 「지정돼 있다」는 사실은 남긴다.
 *
 * ⛔ **축 이음쇠는 값 이름 «안»의 것과 달라야 한다** — 코드가 「ABC-123 · 이름」 꼴로 올 수
 * 있어 같은 쇠를 쓰면 축 경계가 사라진다(W-05-01 ⑥에서 실제로 겪은 자리다).
 */
const scopeParts = (channel: CollectionChannel): string[] => {
  const parts: string[] = [];

  if ((channel.itemId ?? null) !== null) {
    parts.push(t.entry(t.item, channel.itemCode ?? messages.common.reference.unknown));
  }

  if ((channel.processId ?? null) !== null) {
    parts.push(t.entry(t.process, channel.processCode ?? messages.common.reference.unknown));
  }

  return parts;
};

export const scopeText = (channel: CollectionChannel): string => {
  const parts = scopeParts(channel);

  return parts.length === 0 ? t.all : parts.join(t.join);
};

/**
 * 표의 좁은 칸에 세울 때 쓰는 줄 단위 형태.
 *
 * ⛔ **코드 한가운데서 접히게 두지 않는다** — 이 표는 반쪽 페인에 여덟 열이라 조건 칸이
 * 좁고, 한 줄로 흘리면 「품목 ITM-」 / 「201」 로 갈려 **다른 코드로 읽힌다**(브라우저 확인
 * 실측). 축마다 한 줄이면 접힐 자리가 축 사이로 옮겨 간다.
 */
export const scopeLines = (channel: CollectionChannel): string[] => {
  const parts = scopeParts(channel);

  return parts.length === 0 ? [t.all] : parts;
};

/**
 * 고른 조건을 식별자로. 고르지 않았거나 읽을 수 없으면 `null` — **그것이 「전체」다.**
 *
 * ⛔ **빈 값을 `0` 으로 만들지 않는다** — `Number('')` 는 `0` 이다. 「전체」로 되돌린 순간
 * 있지도 않은 0번 품목으로 좁혀진 매핑이 나가고, 유일 범위가 조용히 달라진다.
 *
 * ⛔ **읽을 수 없는 값은 `NaN` 으로 내보내지 않는다** — 유일 범위를 이루는 값이라 서버가
 * 무엇과 견줄지 알 수 없다. 모르면 가장 넓은 쪽(「전체」)이 안전하다.
 */
export const asScopeId = (value: string): number | null => {
  if (value === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
