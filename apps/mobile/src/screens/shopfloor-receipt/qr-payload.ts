/**
 * 스캔한 값이 **출고 QR 인가**를 가린다 — ISSUE-QR-01.
 *
 * ⭐ **가르는 것은 접두어 하나다.** 출고 QR 만 `OMF-GIL|` 을 갖는다. 자재 LOT QR 은 접두어 없이
 *    LOT 번호 원문만 담으므로(POP `pop-material-lot-label/label-tspl.ts` 의 `QRCODE`), 접두어가
 *    없는 값은 **예전처럼 출고번호로 다룬다** — 사람이 전표 번호를 손으로 치는 길이 그것이다.
 *
 * ⭐ **왜 라인 번호를 봐야 하는가.** 계약이 그렇게 정해 두었다: `GET /logistics/goods-issues` 의
 *    `q` 축 설명에 「⛔ **발행된 출고 QR 은 라인을 가리키므로 이 축으로는 풀리지 않는다** —
 *    `goodsIssueLineId` 를 쓴다」가 적혀 있다. 접두어를 못 알아보면 라벨을 대도 전표가 서지
 *    않는다(G3 — 고치기 전 실제 상태였다).
 *
 * ⚠ **같은 양식을 POP 도 안다**(`apps/web/src/screens/goods-issue-qr/qr-payload.ts`). 앱이 둘로
 *   갈려 한 곳에 둘 수 없다 — **한쪽을 고치면 다른 쪽도 고친다.** 양쪽 시험이 같은 예시 문자열
 *   (`OMF-GIL|17|GI-20260916-0001|1`)을 들고 있어 어긋나면 걸린다.
 */

const PREFIX = 'OMF-GIL';
const SEPARATOR = '|';

export type ScannedCode =
  /** 출고 QR — 라인을 가리킨다. 출고번호도 함께 실려 있어 되돌아갈 길이 있다. */
  | { kind: 'issueLine'; goodsIssueLineId: number; goodsIssueNo: string; lineNo: number | null }
  /** 접두어가 없다 — 사람이 친 출고번호이거나 다른 라벨이다. */
  | { kind: 'issueNo'; goodsIssueNo: string };

const toPositiveInt = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * 스캔값을 가른다.
 *
 * ⛔ **접두어만 맞고 내용이 깨진 값을 출고 QR 로 받지 않는다.** 라인 번호가 숫자가 아니면 그
 *    값으로 조회를 걸어야 할지 알 수 없다 — 그럴 때는 **함께 실린 출고번호로 되돌아간다.**
 *    그래서 양식에 출고번호를 함께 담았다(구버전 앱·파싱 실패 대비).
 */
export const parseScannedCode = (raw: string): ScannedCode => {
  const trimmed = raw.trim();

  if (!trimmed.startsWith(`${PREFIX}${SEPARATOR}`)) {
    return { kind: 'issueNo', goodsIssueNo: trimmed };
  }

  const [, lineId, issueNo, lineNo] = trimmed.split(SEPARATOR);
  const goodsIssueLineId = toPositiveInt(lineId);
  const goodsIssueNo = issueNo?.trim() ?? '';

  /* 라인 식별자를 못 읽었으면 출고번호 경로로 되돌린다 — 번호가 있으면 사람은 계속할 수 있다. */
  if (goodsIssueLineId === null) return { kind: 'issueNo', goodsIssueNo };

  return { kind: 'issueLine', goodsIssueLineId, goodsIssueNo, lineNo: toPositiveInt(lineNo) };
};
