import { messages } from '@omf-mes/i18n';

import type { TerminalGate } from './terminal-gating';

const t = messages.materialInputScan;

export interface BlockReasonInput {
  gate: TerminalGate;
  hasWorker: boolean;
  /** 아직 기록되지 않은 줄이 남았는가. 남은 채 닫으면 그 줄이 버려진다. */
  hasPending: boolean;
}

/**
 * 「투입 확정」이 잠긴 사유 한 문장. 잠겼지만 말할 것이 없으면 `undefined`.
 *
 * **잠그는 이유가 다섯이고 순서가 뜻을 정한다.** 앞에 둔 것일수록 나중 조작으로 풀리지 않는
 * 사정이다 — 순서를 뒤집으면 「담으면 열린다」를 읽은 작업자가 다 담고 나서야 막힌 것을 안다.
 *
 * ⛔ **게이팅의 갈래를 한 문장으로 합치지 않는다**(F-6). 「권한이 없다」·「확인할 수 없다」·
 * 「단말을 모른다」는 작업자가 할 일이 다르다.
 *
 * ⚠ **잠금 자체는 이 문구가 정하지 않는다** — 담긴 것이 없을 때는 말없이 잠긴 채로 둔다
 * (`confirm-panel`). 둘을 한 값으로 묶으면 문구를 지우는 순간 잠금까지 풀린다.
 *
 * 문구를 «어디에» 낼지는 화면이 정한다 — 머리줄 아래 띠가 그 자리다(사용자 지시 2026-09-16).
 * 판정은 여기 한 곳이라, 버튼의 잠금과 띠의 문구가 갈리지 않는다.
 */
export const confirmBlockReason = ({
  gate,
  hasWorker,
  hasPending,
}: BlockReasonInput): string | undefined => {
  switch (gate.verdict) {
    case 'denied':
      return t.confirm.reasons.denied;
    case 'unavailable':
      return t.confirm.reasons.unavailable;
    case 'unidentified':
      return t.confirm.reasons.unidentified;
    case 'checking':
      return t.confirm.reasons.checking;
    case 'allowed':
      break;
  }

  if (!hasWorker) return t.confirm.reasons.workerMissing;

  /*
   * ⭐ **기록되지 않은 줄을 남긴 채 닫지 않는다.** 확정은 서버를 부르지 않으므로, 닫는
   * 순간 그 줄은 아무 데도 남지 않고 사라진다 — 작업자는 다 넣었다고 믿는다.
   *
   * 「기록된 것 없음」보다 **앞에 둔다** — 담아 둔 줄이 있으면 작업자가 할 일은 「담아라」가
   * 아니라 「그것을 기록해라」다. 순서를 뒤집으면 이미 담은 자재를 앞에 두고 담으라는 말을
   * 읽는다.
   */
  if (hasPending) return t.confirm.reasons.qtyMissing;

  /*
   * ⛔ **아무것도 담지 않은 상태는 말로 설명하지 않는다**(사용자 지시 2026-09-10). 화면을
   *    열자마자 뜨던 「자재를 하나 이상 기록해야…」는 «아직 아무 일도 하지 않았다」는 사실을
   *    되풀이할 뿐이고, 그 자리는 스캔을 마친 뒤 정말로 막혔을 때 쓸 자리다. 잠긴 버튼이
   *    이미 「지금은 아니다」를 말한다.
   */
  return undefined;
};
