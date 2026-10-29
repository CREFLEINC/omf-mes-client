import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { codeValueName, lookupLabel, type CodeValueOption } from './options';
import type { Item, LookupEntry } from './types';

const t = messages.itemExtendedAttrs;

/**
 * 품목 + ERP 원본 칸 둘(서버 #737 · 장부 P-67 이 응답에 실었으나 생성 타입에 아직 없다 — erp-item/types.ts 와 같은 사정).
 * 계약 사본이 같은 이름으로 실려 오면 이 교차를 걷는다.
 */
type ItemWithErp = Item & { erpSpec?: string | null; erpItemGroupCode?: string | null };

export interface ItemOriginFactsProps {
  item: ItemWithErp;
  uomEntries: LookupEntry[];
  /** 단위 목록을 아직 받지 못했는가. 「알 수 없음」과 가르는 데 쓴다 */
  isUomLoading: boolean;
  isUomError?: boolean;
  /** 품목 유형 코드 → 이름(코드 그룹 `ITEM_TYPE`, 미사용 포함). 받기 전·실패 시에는 코드 그대로 낸다. */
  itemTypeOptions?: readonly CodeValueOption[];
  /** MES 구분 이름 — 비면 값 없음 표기. */
  mesCategoryName: string;
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : value;

/**
 * 오른쪽 구획 머리 — 고른 품목의 원본 정보를 **한 줄 사실 칸**으로(사용자 지시 2026-10-28 「ERP 연동 현황·이력의 품목 ·
 * BOM 탭처럼」). 입고 관리 라인 머리 · BOM 조회 (ERP) 모품목 상세와 같은 모양이다.
 *
 * **입력칸도 저장도 두지 않는다** — 계약의 `ItemUpdate`가 원본 열을 아예 담지 않고, 원본을 고치는 경로 자체가
 * 계약에 없다. MES 구분 · 사용 여부도 이 화면에서 바꾸지 않는 값이라 여기 둔다(확장 속성 폼에는 고치는 칸만).
 * 「ERP 에서 받은 정보 · 고칠 수 없음」 같은 안내는 두지 않는다(사용자 지시 2026-10-27 불필요한 안내문 제거).
 *
 * **번호를 화면에 내지 않는다.** 기준 단위는 이름으로 옮기고, 옮길 수 없으면 「알 수 없음」이다.
 */
export const ItemOriginFacts = ({
  item,
  uomEntries,
  isUomLoading,
  isUomError,
  itemTypeOptions,
  mesCategoryName,
}: ItemOriginFactsProps) => {
  /* 칸마다 이름(dt)이 값(dd)을 부른다 — 「품목코드」로 그 값을 찾을 수 있다. */
  const idBase = useId();
  const facts = [
    {
      key: 'code',
      label: t.origin.fields.itemCode,
      value: orEmptyMark(item.itemCode),
      strong: true,
    },
    { key: 'name', label: t.origin.fields.itemName, value: orEmptyMark(item.itemName) },
    {
      key: 'type',
      label: t.origin.fields.itemType,
      value: orEmptyMark(codeValueName(itemTypeOptions, item.itemTypeCode)),
    },
    { key: 'spec', label: t.origin.fields.spec, value: orEmptyMark(item.erpSpec) },
    { key: 'group', label: t.origin.fields.itemGroup, value: orEmptyMark(item.erpItemGroupCode) },
    {
      key: 'uom',
      label: t.origin.fields.baseUom,
      value: lookupLabel(uomEntries, item.baseUomId, isUomLoading, isUomError),
    },
    { key: 'mes', label: t.attrs.fields.mesCategory, value: orEmptyMark(mesCategoryName) },
    {
      key: 'active',
      label: t.attrs.fields.isActive,
      value: item.isActive ? t.attrs.values.active : t.attrs.values.inactive,
    },
  ];

  return (
    <dl className="po-board-order-facts bom-parent-facts" aria-label={t.panes.itemOrigin}>
      {facts.map((fact) => (
        <div key={fact.key}>
          <dt id={`${idBase}-${fact.key}`}>{fact.label}</dt>
          <dd
            aria-labelledby={`${idBase}-${fact.key}`}
            className={fact.strong === true ? 'bom-tree-code' : undefined}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};
