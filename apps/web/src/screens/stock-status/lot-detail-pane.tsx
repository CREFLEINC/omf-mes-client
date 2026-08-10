import { Button, Chip, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatTransactionAt } from './as-of';
import { classifyExpiry, EXPIRY_SOON_DAYS } from './expiry';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { LotHoldTable } from './lot-hold-table';
import type { BalanceView, LotDetailView, LotExternalIdentifierView } from './types';

const t = messages.stockStatus;

/**
 * 외부 식별자 표의 열 폭. 잔액 표와 같은 규칙이다 — **모든 열이 폭을 지정하고** 합을
 * `.wide-table` 하한(928px) 아래로 누르지 않는다(미지정 열은 고정 배치에서 잔여분을 받아
 * 선언과 실렌더가 어긋난다 — 브라우저 확인 F-B2).
 */
const IDENTIFIER_WIDTH = {
  type: '200px',
  identifier: '240px',
  issuedBy: '240px',
  system: '248px',
} as const;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 값 목록이 확정되지 않은 코드의 배지. **중립 변형 하나로만 쓴다**(계획 결정 12) —
 * 값 집합을 모르는 채 색을 가르면 뜻을 지어내는 것이다.
 */
const codeChip = (code: string): ReactNode => (
  <Chip variant="status" size="sm">
    {code}
  </Chip>
);

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

/** 이름·값 짝을 한 덩어리로 낸다. 폼이 아니라 **값 표기**다(배치 규범 3). */
const SummaryList = ({ label, items }: { label: string; items: SummaryItem[] }) => (
  <div role="group" aria-label={label}>
    <dl className="filter-bar">
      {items.map((item) => (
        <div className="field-cell" key={item.key}>
          <dt className="field-label">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const buildIdentifierColumns = (
  partnerLookup: ReferenceSource,
): Column<LotExternalIdentifierView>[] => [
  {
    key: 'identifierTypeCode',
    header: t.detail.identifierType,
    width: IDENTIFIER_WIDTH.type,
    render: (identifier) => codeChip(identifier.identifierTypeCode),
  },
  {
    key: 'externalIdentifier',
    header: t.detail.externalIdentifier,
    width: IDENTIFIER_WIDTH.identifier,
    render: (identifier) => identifier.externalIdentifier,
  },
  {
    key: 'partner',
    header: t.detail.issuedBy,
    width: IDENTIFIER_WIDTH.issuedBy,
    /*
     * **`null`이 확정된 뜻을 갖는 자리다** — 발급처가 비어 있으면 우리 쪽에서 붙인 번호다.
     * `toReference`에 그냥 넘기면 「알 수 없음」이 되어 *값이 잘못됐다*는 뜻으로 뒤집힌다.
     */
    render: (identifier) =>
      identifier.partnerId === null
        ? t.detail.issuedBySelf
        : describeReference(toReference(partnerLookup, identifier.partnerId)),
  },
  {
    key: 'externalSystemCode',
    header: t.detail.externalSystem,
    width: IDENTIFIER_WIDTH.system,
    render: (identifier) =>
      identifier.externalSystemCode === null
        ? t.values.empty
        : codeChip(identifier.externalSystemCode),
  },
];

export interface LotDetailPaneProps {
  /**
   * 고른 **잔액 줄**. 수량 다섯이 여기서 온다 — 계약의 `Lot`은 만들어질 때의 초기 수량만 갖고
   * 지금 남은 양은 잔액 응답이 나른다.
   */
  row: BalanceView;
  detail: LotDetailView;
  /**
   * 유효기한 판정의 「오늘」. **밖에서 준다** — 판정을 순수하게 두어야 테스트가 실행 환경의
   * 시각을 검사하지 않는다.
   */
  today: Date;
  uomLookup: ReferenceSource;
  partnerLookup: ReferenceSource;
  /** 이 구획이 이름을 내는 참조(단위·발급처)의 복구. 조건 줄·목록의 참조는 그쪽이 소유한다. */
  onRetryReferences: () => void;
}

/**
 * 고른 LOT의 상세 — **아래 구획**이다(계획 결정 2).
 *
 * 드로어도 창도 아니다. 디자인 시스템에 드로어가 없고(설치본 실측), 창으로 대체하면
 * 목록이 가려져 「고르고 다시 목록으로 돌아가는」 이 화면의 반복 조회가 매번 열고 닫는 일이
 * 된다. 창이 없으니 **#45(창 안 선택칸이 잘린다)가 걸릴 자리가 원천적으로 없다.**
 *
 * **조회만 한다.** 등록·수정·보류 해제 수단이 하나도 없다 — 계약에 `PUT /trace/lots/{lotId}`가
 * 있으나 이 화면은 재고 현황 조회다. 유효기한이 지나도 **표식만** 내고 보류를 걸지 않는다
 * (이슈 §4 미결 5 — 정책 미정).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LotDetailPane = ({
  row,
  detail,
  today,
  uomLookup,
  partnerLookup,
  onRetryReferences,
}: LotDetailPaneProps) => {
  const { lot } = detail;
  const expiry = classifyExpiry(lot.expiryDate, today);

  /** 잔액 줄의 단위. 다섯 수량이 모두 이 단위로 세어진다. */
  const rowUom = describeReference(toReference(uomLookup, row.uomId));

  const quantities: SummaryItem[] = [
    { key: 'onHandQty', label: t.detail.onHandQty, value: row.onHandQty },
    { key: 'reservedQty', label: t.detail.reservedQty, value: row.reservedQty },
    { key: 'pickedQty', label: t.detail.pickedQty, value: row.pickedQty },
    { key: 'blockedQty', label: t.detail.blockedQty, value: row.blockedQty },
    {
      key: 'availableQty',
      label: t.detail.availableQty,
      /*
       * **서버가 계산해 내려준 값을 그대로 그린다**(계약에서 `readonly`).
       * 보유−예약−피킹−보류를 화면이 다시 빼면 서버와 다른 답을 낼 수 있다(이슈 §6).
       */
      value: row.availableQty,
    },
    { key: 'uom', label: t.detail.uom, value: rowUom },
  ];

  const attributes: SummaryItem[] = [
    { key: 'lotNo', label: t.fields.lot, value: lot.lotNo },
    { key: 'lotTypeCode', label: t.detail.lotType, value: codeChip(lot.lotTypeCode) },
    { key: 'statusCode', label: t.detail.status, value: codeChip(lot.statusCode) },
    {
      key: 'manufacturedAt',
      label: t.detail.manufacturedAt,
      value: orEmptyMark(formatTransactionAt(lot.manufacturedAt)),
    },
    {
      key: 'expiryDate',
      label: t.detail.expiryDate,
      value: (
        <span className="field-cell">
          <span>{orEmptyMark(lot.expiryDate)}</span>
          {/*
           * **코드값이 아니라 날짜로 판정되는 사실**이라 경고 변형을 쓴다(계획 결정 12의 예외).
           * 셋 중 하나만 나오고, 표식이 없는 것이 기본이다.
           */}
          {expiry !== 'none' && (
            <Chip variant="status" status="warning" size="sm">
              {expiry === 'passed' ? t.detail.expiryPassed : t.detail.expirySoon}
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: 'initialQty',
      label: t.detail.initialQty,
      /* 초기 수량은 LOT의 단위로 센다 — 잔액 줄의 단위와 같다는 보장이 계약에 없다. */
      value: `${String(lot.initialQty)} ${describeReference(toReference(uomLookup, lot.uomId))}`,
    },
    { key: 'remarks', label: t.detail.remarks, value: orEmptyMark(lot.remarks) },
  ];

  /* 이 구획이 이름을 내는 참조 둘 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError = uomLookup.isError || partnerLookup.isError;

  return (
    <>
      <SummaryList label={t.detail.attributes(lot.lotNo)} items={attributes} />

      {/*
       * **표식일 뿐 조치가 아니다.** 기한이 지나도 보류가 자동으로 걸리지 않는다는 사실과
       * 기준 일수가 아직 확정되지 않았다는 사실을 함께 밝힌다(이슈 §4 미결 2·5).
       * 표식이 없으면 내지 않는다 — 늘 떠 있으면 읽히지 않는다.
       */}
      {expiry !== 'none' && <p className="field-note">{t.detail.expiryNote(EXPIRY_SOON_DAYS)}</p>}

      <SummaryList label={t.detail.quantities} items={quantities} />

      {/*
       * **어느 수량인지는 조회 조건이 정한다.** 밝히지 않으면 사용자가 그 LOT의 전체 재고로
       * 읽는다 — 창고·위치·상태로 좁힌 줄의 수량이다.
       */}
      <p className="field-note">{t.detail.quantitiesNote}</p>

      {/*
       * **빈 상태를 만드는 자리는 하나다** — 표를 늘 그리고 `empty` 슬롯이 0건을 맡는다.
       * 바깥에서 `length === 0`을 먼저 가르면 그 슬롯이 도달 불가한 죽은 가지가 되고,
       * 같은 문구가 두 형태로 두 번 적힌다. 바로 아래 보류 표와 같은 형태로 맞춘다 —
       * 이웃한 두 표가 빈 상태를 다르게 처리하면 다음 사람이 어느 쪽을 따를지 알 수 없다.
       */}
      <div className="wide-table">
        <Table
          density="compact"
          caption={t.detail.externalIdentifiers}
          columns={buildIdentifierColumns(partnerLookup)}
          rows={detail.externalIdentifiers}
          /* **이 문자열은 화면에 나오지 않는다** — React key로만 쓰인다(#44). */
          getRowId={(identifier) => String(identifier.lotExternalIdentifierId)}
          empty={<EmptyState size="sm" title={t.detail.noExternalIdentifiers} />}
        />
      </div>

      <LotHoldTable holds={detail.holds} uomLookup={uomLookup} />

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.detail.referencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
