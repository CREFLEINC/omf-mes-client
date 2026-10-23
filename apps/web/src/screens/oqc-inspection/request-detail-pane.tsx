import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ItemNameLookup, NameLookup } from './reference-lookup';
import { formatDateTime, type InspectionRequestDetail } from './types';
import { withUom } from './uom-lookup';

/**
 * 고른 의뢰의 대상 정보 — **스펙 §4-A 다.**
 *
 * 항목명(위)·값(아래)의 4열 격자다(IQC #133 과 같은 모양 · omf-all-around#136). 첫 줄은 검사 대상을 가리키는
 * 넷(의뢰번호 · 품목 · 대상 LOT · 검사수량)을 굵게, 둘째 줄은 같은 열에 맞춰 부가 정보(검사 유형 · 대상 ·
 * 적용 기준 · 의뢰 일시)를 둔다.
 *
 * ⚠ **적용 기준(검사기준 버전)을 감추지 않는다.** 검사 시점의 기준 버전이 그 검사에 고정되고,
 * 이후 기준이 바뀌어도 이 검사는 당시 버전으로 남는다.
 *
 * ⭐ **기준이 비면 전용 문구를 쓴다.** 일반 빈 값 표시(`—`)와 **다른 글자**여야 한다 —
 * 「기준이 등록되지 않았다」와 「값을 못 읽었다」는 사용자가 할 일이 다르다(공유계약 G-9).
 *
 * ⚠ **모르는 대상 유형은 코드 그대로 보인다.** 이름을 지어내면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.detail;
const queueT = messages.oqcInspection.queue;

export interface RequestDetailPaneProps {
  detail: InspectionRequestDetail;
  /** 수량 옆에 붙일 단위 코드. 모르면 `null` — 숫자만 둔다 */
  uomCode: string | null;
  /** 품목 이름 풀이. 번호가 아니라 이름(위)·코드(아래)를 보인다 — 목록과 같은 모양. */
  itemNames: ItemNameLookup;
  /** 대상 LOT 번호 풀이. 없는 의뢰(출하작업지시 대상)는 빈 값 표시다. */
  lotNumbers: NameLookup;
}

export const RequestDetailPane = ({
  detail,
  uomCode,
  itemNames,
  lotNumbers,
}: RequestDetailPaneProps) => {
  const itemParts = itemNames.partsOf(detail.itemId);
  const lotNo = lotNumbers.labelOf(detail.lotId);
  const typeName = t.inspectionTypeNames[detail.inspectionTypeCode];

  const items: { key: string; label: string; value: ReactNode; emphasized?: boolean }[] = [
    {
      key: 'no',
      label: t.fields.inspectionRequestNo,
      value: detail.inspectionRequestNo,
      emphasized: true,
    },
    {
      key: 'item',
      label: t.fields.itemId,
      value:
        itemParts === null ? (
          itemNames.labelOf(detail.itemId)
        ) : (
          <span
            className="oqc-inspection-fact-item"
            title={`${itemParts.name} · ${itemParts.code}`}
          >
            <span className="oqc-inspection-fact-ellipsis">{itemParts.name}</span>
            <span className="oqc-inspection-fact-ellipsis oqc-inspection-queue-sub">
              {itemParts.code}
            </span>
          </span>
        ),
      emphasized: true,
    },
    {
      key: 'lot',
      label: t.fields.lotId,
      /* 구분자가 많은 번호라 칸 안에서 끊기면 읽기 어렵다 — 한 줄 말줄임, 전체는 title. */
      value: (
        <span className="oqc-inspection-fact-ellipsis" title={lotNo}>
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
    {
      key: 'type',
      label: t.fields.inspectionTypeCode,
      value:
        typeName === undefined
          ? detail.inspectionTypeCode
          : `${detail.inspectionTypeCode} (${typeName})`,
    },
    {
      key: 'target',
      label: t.fields.target,
      value: queueT.target(
        queueT.targetTypes[detail.targetTypeCode] ?? detail.targetTypeCode,
        detail.targetId,
      ),
    },
    {
      key: 'plan',
      label: t.fields.inspectionPlanVersionId,
      /* 없는 값(기준 미등록)과 모르는 값은 다른 모양이어야 한다(공유계약 G-9 · client#589). */
      value:
        detail.inspectionPlanVersionId === null
          ? t.noPlanVersion
          : String(detail.inspectionPlanVersionId),
    },
    { key: 'requestedAt', label: t.fields.requestedAt, value: formatDateTime(detail.requestedAt) },
  ];

  return (
    <section className="oqc-inspection-section" aria-label={t.heading}>
      {/* 제목 글은 두지 않는다 — 쪽 머리 경로가 「검사 기본 정보」를 이미 말한다(IQC #133 과 같다). */}
      <dl className="oqc-inspection-facts">
        {items.map((item) => (
          <div className="oqc-inspection-fact" key={item.key}>
            <dt className="field-label">{item.label}</dt>
            <dd className={item.emphasized === true ? 'oqc-inspection-fact-key' : undefined}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
