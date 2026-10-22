import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatDateTime, type InspectionRequestDetail } from './types';
import { withUom } from './uom-lookup';
import type { ItemNameLookup, NameLookup } from './reference-lookup';

/**
 * 고른 의뢰의 상세 — **스펙 §4-A 의 여섯 항목이다.**
 *
 * ⚠ **검사기준 버전을 감추지 않는다.** 검사 시점의 기준 버전이 그 검사에 고정되고, 이후
 * 기준이 바뀌어도 이 검사는 당시 버전으로 남는다. 버전이 보이지 않으면 검사자는 자기가 어느
 * 기준으로 재고 있는지 모르고, 나중에 결과를 읽는 사람도 알 수 없다. 숫자만 두지 않고 **왜
 * 중요한지도 한 줄로 밝힌다.**
 *
 * ⚠ **품목·자재 LOT 을 번호로 그린다.** 계약이 식별자만 주고 이름을 주지 않는다. 참조 조회를
 * 얹지 않는 이유는 `queries.ts` 머리에 적었다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.detail;
const empty = messages.iqcInspection.queue.emptyValue;

export interface RequestDetailPaneProps {
  detail: InspectionRequestDetail;
  /** 수량 옆에 붙일 단위 코드. 모르면 `null` — 숫자만 둔다 */
  uomCode: string | null;
  /** 품목 이름 풀이. **번호가 아니라 이름(위)·코드(아래)를 보인다** — 대기 목록과 같은 모양(omf-all-around#40·#133). */
  itemNames: ItemNameLookup;
  /** 자재 LOT 번호 풀이. 검사자가 손에 든 라벨과 대조하는 값이다. */
  lotNumbers: NameLookup;
  /** 「검사 수준」 칸 — 품목의 현재 수준과 변경 버튼(omf-all-around#133). */
  levelSlot?: ReactNode;
}

export const RequestDetailPane = ({
  detail,
  uomCode,
  itemNames,
  lotNumbers,
  levelSlot,
}: RequestDetailPaneProps) => {
  const itemParts = itemNames.partsOf(detail.itemId);
  const itemLabel = itemNames.labelOf(detail.itemId);
  const lotNo = lotNumbers.labelOf(detail.lotId);

  /*
   * 첫 줄은 검사 대상을 가리키는 넷(의뢰번호·품목·대상 LOT·검사수량) — 값을 굵게, 먼저 눈에 들어오게.
   * 둘째 줄은 의뢰의 부가 정보다. 순서가 곧 격자 자리다(4열 · app.css `.iqc-inspection-facts`).
   */
  const items: {
    key: string;
    label: string;
    value: ReactNode;
    emphasized?: boolean;
    hint?: string;
  }[] = [
    {
      key: 'no',
      label: t.fields.inspectionRequestNo,
      value: detail.inspectionRequestNo,
      emphasized: true,
    },
    {
      key: 'item',
      label: t.fields.itemId,
      /* 못 푼 갈래는 줄이 하나뿐이라 풀이가 사유를 그 자리에 낸다. */
      value:
        itemParts === null ? (
          itemLabel
        ) : (
          <span
            className="iqc-inspection-fact-item"
            title={`${itemParts.name} · ${itemParts.code}`}
          >
            <span className="iqc-inspection-fact-item-name">{itemParts.name}</span>
            <span className="iqc-inspection-fact-item-code">{itemParts.code}</span>
          </span>
        ),
      emphasized: true,
    },
    {
      key: 'lot',
      label: t.fields.lotId,
      /* 구분자가 많은 번호라 칸 안에서 끊기면 읽기 어렵다 — 한 줄 말줄임, 전체는 title. */
      value: (
        <span className="iqc-inspection-lot" title={lotNo}>
          {lotNo}
        </span>
      ),
      emphasized: true,
    },
    {
      key: 'qty',
      label: t.fields.targetQty,
      value: withUom(String(detail.targetQty), uomCode),
      emphasized: true,
    },
    /* 둘째 줄 — 의뢰의 부가 정보(검사 유형 · 기준 버전 · 의뢰 일시 · 검사 수준). 값은 굵게 하지 않는다(#133). */
    { key: 'type', label: t.fields.inspectionTypeCode, value: detail.inspectionTypeCode },
    {
      key: 'plan',
      label: t.fields.inspectionPlanVersionId,
      /* client#589 — 없는 값(기준 미등록)과 모르는 값은 다른 모양이어야 한다(공유계약 G-9). */
      value:
        detail.inspectionPlanVersionId === null
          ? t.noPlanVersion
          : String(detail.inspectionPlanVersionId),
    },
    /* 값만 따로 두면 무슨 시각인지 모른다 — 필드(`requestedAt`) 이름을 붙인다. */
    { key: 'at', label: t.fields.requestedAt, value: formatDateTime(detail.requestedAt) },
    ...(levelSlot === undefined
      ? []
      : [{ key: 'level', label: t.fields.inspectionLevel, value: levelSlot }]),
  ];

  return (
    <section className="iqc-inspection-section" aria-label={t.heading}>
      {/* 제목 글은 두지 않는다 — 쪽 머리 경로가 「검사 기본 정보」를 이미 말한다(#133). */}
      <dl className="iqc-inspection-facts">
        {items.map((item) => (
          <div className="iqc-inspection-fact" key={item.key}>
            <dt className="field-label">
              {item.label}
              {item.hint !== undefined && (
                <span className="iqc-inspection-label-hint">{item.hint}</span>
              )}
            </dt>
            <dd className={item.emphasized === true ? 'iqc-inspection-fact-key' : undefined}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
