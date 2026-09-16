/**
 * 출고 QR 이 담는 글 — **라인 하나를 가리킨다.**
 *
 * ⭐ **왜 라인인가.** 계약이 그렇게 정해 두었다: `GET /logistics/goods-issues` 의
 *    `goodsIssueLineId` 축 설명이 「**라인 단위 출고 QR 을 스캔했을 때.** 그 라인이 속한 출고
 *    전표를 낸다」이고, 같은 자리의 `q` 축에는 「⛔ **발행된 출고 QR 은 라인을 가리키므로 이
 *    축으로는 풀리지 않는다**」가 적혀 있다(`api.d.ts:14019,14021`). 발행 대상도 라인이다
 *    (`GOODS_ISSUE_LINE`).
 *
 * ⭐ **번호만 담지 않고 사람이 읽을 것을 함께 담는다.** 파싱이 실패하거나 옛 앱이 이 글을
 *    만나도 **출고번호가 눈에 보여** 사람이 그 번호로 되돌아갈 수 있다. 라인번호는 같은 전표에
 *    라인이 여럿일 때 어느 줄의 QR 인지 사람이 가린다.
 *
 * ⛔ **접두어를 뗄 수 없다.** 이것이 「출고 QR 인가」를 가리는 유일한 표식이다. 자재 LOT QR 은
 *    접두어 없이 LOT 번호 원문만 담으므로(`pop-material-lot-label/label-tspl.ts` 의 `QRCODE`),
 *    접두어가 없으면 둘을 가릴 수 없고 모바일이 LOT 번호를 출고번호로 읽는다.
 *
 * ⚠ **같은 양식을 모바일도 안다**(`apps/mobile/src/screens/shopfloor-receipt/qr-payload.ts`).
 *    앱이 둘로 갈려 있어 한 곳에 둘 수 없다 — **한쪽을 고치면 다른 쪽도 고친다.** 양쪽 시험이
 *    같은 예시 문자열(`OMF-GIL|17|GI-20260916-0001|1`)을 들고 있어 어긋나면 걸린다.
 */

/** 이 글이 출고 QR 임을 가리는 표식. 값에는 쓰이지 않는 글자만 골랐다. */
export const GOODS_ISSUE_QR_PREFIX = 'OMF-GIL';

/** 칸을 가르는 글자. 자재 LOT 라벨이 쓰던 관례와 같다. */
const SEPARATOR = '|';

export interface GoodsIssueQrPayload {
  goodsIssueLineId: number;
  goodsIssueNo: string;
  lineNo: number;
}

/**
 * 라인 하나를 가리키는 글을 만든다 — `OMF-GIL|<라인id>|<출고번호>|<라인번호>`.
 *
 * ⛔ **값 안의 구분자를 그대로 두지 않는다.** 출고번호에 `|` 가 섞이면 칸 수가 달라져 읽는
 *    쪽이 엉뚱한 자리를 라인번호로 읽는다. 자재 LOT 라벨이 같은 이유로 공백으로 바꾼다.
 */
export const buildGoodsIssueQrPayload = ({
  goodsIssueLineId,
  goodsIssueNo,
  lineNo,
}: GoodsIssueQrPayload): string =>
  [
    GOODS_ISSUE_QR_PREFIX,
    String(goodsIssueLineId),
    goodsIssueNo.replaceAll(SEPARATOR, ' '),
    String(lineNo),
  ].join(SEPARATOR);
