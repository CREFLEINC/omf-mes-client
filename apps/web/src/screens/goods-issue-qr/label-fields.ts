/**
 * 발행 기록 하나를 **라벨에 실을 값**으로 옮긴다.
 *
 * ⭐ **이름 풀이는 화면이 소유한다**(`lookups.ts`). 그리는 쪽(`label-image.ts`)은 순수 함수라
 *    조회를 모르고, 보내는 쪽(`mutations.ts`)은 무엇을 그릴지 모른다 — 그 둘을 잇는 자리가
 *    여기다.
 *
 * ⛔ **번호를 라벨에 찍지 않는다.** 이름을 못 받았으면 **빈 라벨을 만들지 않고 그릴 수 없다고
 *    말한다.** 내부 채번이 찍힌 라벨은 현장에서 대조할 수 없는데도 대조할 수 있는 것처럼
 *    보인다(같은 규율 — `material-input-scan/receipt-table.tsx`).
 */

import { toLookupDisplayState, type LookupSource } from '../../patterns/lookup-display';

import type { DestinationState } from './lookups';

import type { GoodsIssueQrLabelFields } from './label-image';
import { buildGoodsIssueQrPayload } from './qr-payload';
import type { DocumentIssue, GoodsIssue, GoodsIssueLine } from './types';
import { LINE_TARGET_TYPE_CODE } from './types';

export type LabelFields = GoodsIssueQrLabelFields | { unavailableReason: string };

export interface LabelFieldsInput {
  /**
   * 라벨이 쓰는 것은 **출고번호뿐이다.** 대기 목록에서 고른 줄은 전표를 따로 조회하지 않고
   * 목록이 들고 있는 값을 그대로 준다(사용자 지시 2026-09-21 · omf-all-around#35).
   */
  issue: Pick<GoodsIssue, 'goodsIssueNo'> | null;
  lines: readonly GoodsIssueLine[];
  /** 라벨의 `ITEM` — **코드만**이다(`useItemCodes`). 화면 표시값(코드 · 이름)이 아니다. */
  itemCodes: LookupSource;
  lotNames: LookupSource;
  destination: DestinationState;
}

/**
 * 도착지를 라벨에 적을 수 없을 때의 표식.
 *
 * ⚠ **막지 않는다.** 두 경우에 이 값이 선다.
 *   ① 도착지가 위치가 아니다 — 계약의 도착지는 위치·거래처·폐기장 셋이고(`destinationTypeCode`)
 *      자재 인계가 아닌 출고(공급사 반품 등)는 위치를 갖지 않는다.
 *   ② **위치인데 읽지 못했다** — `GET /mdm/locations/{id}` 가 POP 단말 토큰에 **401** 이다
 *      (실측 2026-09-16 · `location_id=5` `S220-WIP` 는 DB 에 멀쩡히 있다). 권한 범위 문제이지
 *      값이 없는 것이 아니다.
 *
 * ⛔ **②를 이 자리의 «정답»으로 굳히지 않는다.** 사용자 결정(2026-09-16)으로 **서버가 그 조회를
 *    POP 에 열어 줄 때까지의 임시**다 — 라벨에 도착 위치를 싣기로 한 것도 사용자 결정이었다.
 *    막으면 발행이 통째로 서지 않아 현장 시험이 멈추므로 비우고 나아가되, **비웠다는 사실을
 *    화면이 말한다**(`screen.tsx` 의 도착지 안내). 조용히 비우면 라벨이 거짓말을 한다.
 */
const NO_DESTINATION = '-';

/**
 * 이 화면이 그릴 수 있는 라벨은 **라인 단위 하나뿐이다**(ISSUE-QR-01 범위).
 *
 * ⚠ 파렛트(취급 단위) 대상은 여러 LOT 을 담아 라인 하나를 가리키는 QR 로 표현할 수 없다 —
 *   계약도 그 자리의 `lotId` 를 비운다. 다음 시나리오로 넘긴 항목이라 **기다려도 그려지지
 *   않는다**는 사실을 그대로 말한다.
 */
const PALLET_UNSUPPORTED = '파렛트 단위 라벨은 아직 만들 수 없습니다. 라인 단위로 발행하세요.';
const NOT_LOADED = '라벨에 실을 이름을 아직 받지 못했습니다. 잠시 뒤 다시 발행하세요.';
/** 조회가 끝났는데 이름이 없다 — 다시 눌러도 같다. 담당자를 불러야 하는 갈래다. */
const NAME_UNRESOLVED =
  '품목 코드·LOT 번호를 불러오지 못했습니다. 연결을 확인한 뒤 다시 발행하세요.';
const LINE_MISSING = '이 발행 대상에 해당하는 출고 라인을 찾지 못했습니다.';

/**
 * 라인 하나의 라벨 값.
 *
 * ⭐ **발행 전에도 만들 수 있다.** 페이로드가 담는 것(라인 식별자·출고번호·라인번호)은 발행과
 *    무관하게 이미 정해져 있다 — 그래서 **고르자마자 미리보기가 선다**(ISSUE-QR-01 D3).
 *    발행 회차는 라벨 면에 싣지 않으므로 발행 전후의 그림이 같다.
 */
export const toLabelFieldsForLine = (
  line: GoodsIssueLine,
  { issue, itemCodes, lotNames, destination }: Omit<LabelFieldsInput, 'lines'>,
): LabelFields => {
  if (issue === null) return { unavailableReason: LINE_MISSING };

  /*
   * ⛔ **`lookupDisplayLabel` 을 쓰지 않는다.** 그 함수는 못 받은 상태를 「이름 불러오는 중」
   *    같은 **사람에게 보일 문구**로 바꿔 준다 — 라벨에 그 문구가 그대로 찍히면 현장에서
   *    품목 코드 자리에 한글 문장이 선다. 여기서는 **이름을 받은 경우만** 통과시킨다.
   */
  const itemState = toLookupDisplayState(itemCodes, line.itemId);
  const lotState = toLookupDisplayState(lotNames, line.lotId);

  /*
   * ⭐ **기다리면 되는 것과 기다려도 안 되는 것을 가른다**(공유계약 G-3 — 사유는 「어떻게 풀
   *    것인가」를 담는다). 조회가 도는 중이면 잠시 뒤 다시 누르면 되고, 실패·없음이면 다시
   *    눌러도 같다. 한 문장으로 뭉치면 작업자가 될 때까지 누른다.
   */
  const nameProblem = [itemState, lotState].reduce<string | null>((found, state) => {
    if (found !== null || state.kind === 'named') return found;

    return state.kind === 'loading' ? NOT_LOADED : NAME_UNRESOLVED;
  }, null);

  if (nameProblem !== null) return { unavailableReason: nameProblem };
  /* 아직 묻는 중일 때만 기다린다 — 못 받은 것은 기다려도 오지 않는다(위 ②). */
  if (destination.kind === 'loading') return { unavailableReason: NOT_LOADED };

  /* 위에서 갈라 냈으므로 여기 오는 둘은 이름을 받은 상태다. */
  const itemCode = itemState.kind === 'named' ? itemState.label : '';
  const lotNo = lotState.kind === 'named' ? lotState.label : '';
  const destinationCode = destination.kind === 'code' ? destination.code : NO_DESTINATION;

  return {
    payload: buildGoodsIssueQrPayload({
      goodsIssueLineId: line.goodsIssueLineId,
      goodsIssueNo: issue.goodsIssueNo,
      lineNo: line.lineNo,
    }),
    goodsIssueNo: issue.goodsIssueNo,
    lineNo: line.lineNo,
    itemCode,
    lotNo,
    /* 수량은 서버가 준 값을 그대로 옮긴다 — 라벨이 자릿수를 지어내지 않는다. */
    quantity: String(line.issueQty),
    destinationCode,
  };
};

/** 발행 기록이 가리키는 대상의 라벨 값. 라인을 찾아 위 함수로 넘긴다. */
export const toLabelFields = (record: DocumentIssue, input: LabelFieldsInput): LabelFields => {
  if (record.target.targetTypeCode !== LINE_TARGET_TYPE_CODE) {
    return { unavailableReason: PALLET_UNSUPPORTED };
  }

  const line = input.lines.find((each) => each.goodsIssueLineId === record.target.targetId);

  if (line === undefined) return { unavailableReason: LINE_MISSING };

  return toLabelFieldsForLine(line, input);
};
