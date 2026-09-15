import { buildMaterialLotLabel } from './label-tspl';
import { popShell } from './shell-print';

/**
 * 셸 진단(Ctrl+Alt+P · 80 × 30)이 찍는 **견본 자재 LOT 라벨.**
 *
 * ⭐ **실제 발행과 같은 길로 보낸다**(사용자 지시 2026-09-15). 서식은 `buildMaterialLotLabel`,
 *   보내는 곳은 `rendition.save(…, 'tspl')` — 발행 화면이 쓰는 두 자리 그대로다. 셸이 따로 짠
 *   견본은 서식도 프린터 고르는 길도 달라, 견본이 잘 나와도 실제 라벨은 어긋날 수 있었다.
 *
 * ⛔ **서버에 아무것도 남기지 않는다.** 발행 기록·LOT 을 만들지 않고 값은 고정 견본이다 —
 *    QR 을 모바일로 찍으면 「없는 LOT」 이 정상이다.
 */
export const SAMPLE_LOT_LABEL = {
  itemCode: 'TEST-000000',
  lotNo: 'TEST-000000|10000|260101|000000|0001',
  qty: 10000,
  uomCode: 'EA',
  issueSeq: 1,
  inboundReceiptNo: 'IR-TEST-0001',
} as const;

/** 셸이 부른다. 셸 통로가 없으면 던진다 — 부른 쪽이 사유를 상자로 보인다. */
export const printSampleLotLabel = async (): Promise<string> => {
  const shell = popShell();

  if (shell === null) throw new Error('셸 인쇄 통로가 없습니다.');

  return shell.rendition.save(
    new TextEncoder().encode(buildMaterialLotLabel(SAMPLE_LOT_LABEL)),
    'lot-sample',
    new Date().toISOString(),
    'tspl',
  );
};
