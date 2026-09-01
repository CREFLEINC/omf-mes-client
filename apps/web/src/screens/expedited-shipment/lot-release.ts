import type { ProductionLotCandidate } from './types';

/**
 * ⛔ **Lot Status 차단은 우회하지 않는다** — 결정 10에 예외를 만들면 「차단의 단일 지점」이라는
 * 전제가 무너진다(W-04-05 §5-3). 「긴급」이 건너뛰는 것은 물리적 창고 경유와 피킹·포장이지
 * 품질 게이트가 아니다.
 *
 * ⚠ **화면이 아는 것은 두 가지뿐이다.** 품질 판정 축의 코드 문자열 값 목록이 아직 확정되지
 * 않았으므로(공유계약 G-2 · 계약이 「서버가 내려주는 선택지를 그대로 쓴다」로 적었다) 화면은
 * ⓐ 보류 여부와 ⓑ 검사 대기 한 값만 판정할 수 있다.
 *
 * 그래서 **「Release 입니다」라고 단정하지 않는다** — 아는 차단 사유가 없으면 `unknown`이고,
 * 최종 판정은 확정할 때 서버가 한다(아니면 400 · 계약 `ShipmentCreate.expedited` 주석).
 * 지어낸 코드로 「통과」를 선언하면 화면이 서버보다 앞서 말하게 된다.
 */
export type LotReleaseState =
  | { kind: 'held' }
  | { kind: 'inspection-pending' }
  | { kind: 'unknown-hold' }
  | { kind: 'no-known-block' };

/**
 * 검사 대기 코드. **밖에서 받는다** — 값이 바뀌면 이 한 자리만 고치면 되고, 시험이 두 갈래를
 * 모두 몰 수 있다(`suspicious-material-hold`가 같은 형태로 주입한다).
 */
export const INSPECTION_PENDING_CODE = 'INSPECTION_PENDING';

export const lotReleaseState = (
  lot: ProductionLotCandidate | null,
  inspectionPendingCode: string = INSPECTION_PENDING_CODE,
): LotReleaseState | null => {
  if (lot === null) return null;

  /*
   * ⚠ **모르는 것을 「아님」으로 접지 않는다.** `held`가 안 오면 보류가 아니라 **보류 여부를
   * 모르는 것**이다. 「아님」으로 접으면 보류 LOT이 출하 가능처럼 보이고, 화면이 서버에게
   * 막히기 전까지 사용자는 진행할 수 있다고 믿는다.
   */
  if (lot.held === true) return { kind: 'held' };
  if (lot.held === undefined) return { kind: 'unknown-hold' };
  if (lot.statusCode === inspectionPendingCode) return { kind: 'inspection-pending' };

  return { kind: 'no-known-block' };
};

/**
 * 확정을 막아야 하는 상태인가.
 *
 * ⭐ `unknown-hold`는 **막지 않는다** — 서버가 필드를 안 내리는 것만으로 화면 전체가 잠기면
 * 이 화면은 쓸 수 없게 된다. 대신 사실을 적고(「상태를 알 수 없음」) 최종 판정이 서버에 있음을
 * 함께 밝힌다. 잘못 통과시켜도 서버가 400으로 막으므로 **되돌릴 수 없는 일이 벌어지지 않는다.**
 */
export const blocksSubmit = (state: LotReleaseState | null): boolean =>
  state !== null && (state.kind === 'held' || state.kind === 'inspection-pending');
