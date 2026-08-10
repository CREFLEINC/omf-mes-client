import { messages } from '@omf-mes/i18n';

/**
 * ERP 송신 **적재** 여부를 가르는 유일한 자리.
 *
 * **「적재」는 「전송」이 아니다**(이슈 §6의 ⭐). 응답의 `erpMessageQueued`는 「송신 대기열에
 * 넣었다」이고, 확정 직후 상대 시스템에서 조회하면 아직 없을 수 있다. 그래서 이 화면의 문구에
 * 「전송 완료」라는 낱말이 없다.
 *
 * **세 갈래인 이유는 계약이 이 필드를 선택으로 두었기 때문이다**(실측: `GoodsReceipt`의
 * required 목록에 없다). 값이 오지 않는 경우가 실재하므로 `queued ?? true`처럼 접으면
 * **아무 근거 없이 「적재됐다」로 읽힌다** — 이 화면에서 가장 비싼 오해다.
 *
 * 조건부 승인으로 들어온 건은 거짓이 온다(이슈 §6). 참과 거짓을 한 문구로 뭉개면 승인자가
 * 상대 시스템에 반영된 줄로 오해하므로 문구도 갈라 둔다.
 *
 * **판정과 문구가 같은 파일에 있다**(읽는 자리 파생). 갈래는 셋인데 문구가 두 벌이거나
 * 그 반대이면, 화면 어딘가에서 갈래가 조용히 접힌다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.goodsReceipt;

/** 적재됨 · 적재되지 않음 · 알 수 없음. **어느 갈래에도 번호를 담지 않는다.** */
export type ErpQueueState = { kind: 'queued' } | { kind: 'notQueued' } | { kind: 'unknown' };

/** 응답 값 하나를 갈래로 옮긴다. `undefined`는 **응답에 키가 없었다**는 뜻이다. */
export const describeErpQueue = (queued: boolean | undefined): ErpQueueState => {
  if (queued === undefined) return { kind: 'unknown' };

  return queued ? { kind: 'queued' } : { kind: 'notQueued' };
};

/** 갈래를 화면 문구로 옮긴다. 셋의 문구가 서로 달라야 뜻이 구분된다. */
export const erpQueueText = (state: ErpQueueState): string => {
  switch (state.kind) {
    case 'queued':
      return t.result.erpQueued;
    case 'notQueued':
      return t.result.erpNotQueued;
    case 'unknown':
      return t.result.erpUnknown;
  }
};
