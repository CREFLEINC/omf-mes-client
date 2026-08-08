import { Chip, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatTransactionAt } from './as-of';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { LotHoldView } from './types';

const t = messages.stockStatus;

/**
 * 열 폭 예산. **모든 열이 폭을 지정한다** — 디자인 시스템 `Table`은 `table-layout: fixed`라
 * 폭을 지정하지 않은 열이 남는 폭의 잔여분을 받아 선언과 실렌더가 어긋난다(브라우저 확인 F-B2).
 * 합이 `.wide-table` 하한(928px)보다 작아도 같은 일이 생기므로 하한 아래로 누르지 않는다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 사유 | **200px** | 이 표의 축 열이다. 코드 배지 하나가 한 줄에 들어가야 훑을 수 있다 |
 * | 상태 | 120px | 코드 배지 하나 |
 * | 보류 수량 | 128px | 수 또는 「전량 보류」 다섯 글자 |
 * | 단위 | 96px | 단위 코드만 |
 * | 보류 시각 | 140px | `MM-DD HH:mm` |
 * | 해제 조건 · 비고 | 각 200px | 짧은 문장 한 줄 |
 */
const WIDTH = {
  reason: '200px',
  status: '120px',
  holdQty: '128px',
  uom: '96px',
  heldAt: '140px',
  text: '200px',
} as const;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 값 목록이 확정되지 않은 코드의 배지.
 *
 * **중립 변형 하나로만 쓴다**(계획 결정 12). 보류 사유는 값 집합이 아직 없어(omf-mes#64)
 * 색을 가르면 어느 사유가 더 무거운지를 화면이 지어내는 것이 된다.
 */
const codeChip = (code: string): ReactNode => (
  <Chip variant="status" size="sm">
    {code}
  </Chip>
);

/**
 * 보류 표의 열 구성. **부품 밖으로 내보내 열 폭을 값으로 검사한다.**
 *
 * **사용자 번호(`heldBy`)를 열로 두지 않는다** — 이름을 풀 참조가 이 화면에 없어 번호를
 * 그대로 내게 되고(#44), 참조를 새로 만드는 것은 이 화면의 참조 표(계획 결정 9)에 일곱째
 * 줄을 더하는 일이다. 「누가 걸었는가」는 품질 도메인 화면의 질문이다.
 *
 * **해제 정보(`releasedBy`·`releasedAt`)도 두지 않는다** — 계약이 이 목록을
 * 「해제되지 않은 보류」로 정해 언제나 비어 있다. 늘 대시인 열은 자리만 먹는다.
 */
export const buildHoldColumns = (uomLookup: ReferenceSource): Column<LotHoldView>[] => [
  {
    key: 'reasonCode',
    header: t.detail.holds.reason,
    width: WIDTH.reason,
    render: (hold) => codeChip(hold.reasonCode),
  },
  {
    key: 'statusCode',
    header: t.detail.holds.status,
    width: WIDTH.status,
    render: (hold) => codeChip(hold.statusCode),
  },
  {
    key: 'holdQty',
    header: t.detail.holds.holdQty,
    width: WIDTH.holdQty,
    align: 'end',
    /*
     * **없으면 전량 보류다**(계약이 그렇게 적었다). 빈칸이나 `0`으로 두면 정반대 —
     * 「아무것도 묶이지 않았다」 — 로 읽혀 사용자가 이 LOT을 쓸 수 있다고 판단한다.
     * `0`은 서버가 보낸 값이므로 그대로 적는다.
     */
    render: (hold) => (hold.holdQty === null ? t.detail.holds.wholeLot : hold.holdQty),
  },
  {
    key: 'uom',
    header: t.detail.holds.uom,
    width: WIDTH.uom,
    /* 전량 보류에는 견줄 수가 없어 단위도 없다 — 지어내지 않는다. */
    render: (hold) =>
      hold.uomId === null ? t.values.empty : describeReference(toReference(uomLookup, hold.uomId)),
  },
  {
    key: 'heldAt',
    header: t.detail.holds.heldAt,
    width: WIDTH.heldAt,
    render: (hold) => orEmptyMark(formatTransactionAt(hold.heldAt)),
  },
  {
    key: 'releaseCondition',
    header: t.detail.holds.releaseCondition,
    width: WIDTH.text,
    render: (hold) => orEmptyMark(hold.releaseCondition),
  },
  {
    key: 'remarks',
    header: t.detail.holds.remarks,
    width: WIDTH.text,
    render: (hold) => orEmptyMark(hold.remarks),
  },
];

export interface LotHoldTableProps {
  /** 계약이 **해제되지 않은 것만** 내려 준다 — 화면이 걸러 내지 않는다. */
  holds: LotHoldView[];
  uomLookup: ReferenceSource;
}

/**
 * 해제되지 않은 보류 목록.
 *
 * **조회만 한다.** 보류를 걸고 푸는 수단이 하나도 없다 — 계약의 이 경로는 읽기만 제공하고,
 * 등록은 품질 도메인 화면(W-03-03)의 소관이다. 유효기한이 지났다고 화면이 보류를 걸지도
 * 않는다(이슈 §4 미결 5 — 정책 미정).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LotHoldTable = ({ holds, uomLookup }: LotHoldTableProps) => (
  <>
    <div className="wide-table">
      <Table
        density="compact"
        caption={t.detail.holds.title}
        columns={buildHoldColumns(uomLookup)}
        rows={holds}
        /* **이 문자열은 화면에 나오지 않는다** — React key로만 쓰인다(#44). */
        getRowId={(hold) => String(hold.lotHoldId)}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.detail.holds.emptyTitle}
            description={t.detail.holds.emptyDescription}
          />
        }
      />
    </div>

    {/*
     * **경로 안내이지 등록 수단이 아니다**(이슈 §6). 링크로 만들면 그 화면이 아직 없어
     * 죽은 링크가 되고, 버튼으로 만들면 조회 전용인 이 화면이 쓰기를 갖게 된다.
     * 보류가 없어도 남긴다 — 의심자재를 등록할 자리는 보류 유무와 무관하다.
     */}
    <p className="field-note">{t.detail.holds.suspectMaterialPath}</p>
  </>
);
