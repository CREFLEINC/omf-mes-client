import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { codeValueName, lookupLabel, type CodeValueOption } from './options';
import type { Item, LookupEntry } from './types';
import { ValueField } from './value-field';

const t = messages.itemExtendedAttrs;

export interface ItemOriginPaneProps {
  item: Item;
  uomEntries: LookupEntry[];
  /** 단위 목록을 아직 받지 못했는가. 「알 수 없음」과 가르는 데 쓴다 */
  isUomLoading: boolean;
  isUomError?: boolean;
  /**
   * 품목 유형 코드 → 이름(코드 그룹 `ITEM_TYPE`, 미사용 포함). 받기 전·실패 시에는 비어 있고
   * 코드 그대로 낸다.
   */
  itemTypeOptions?: readonly CodeValueOption[];
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 우 칸 머리 — 품목 원본 정보. **값 표기만 있다.**
 *
 * 이 화면의 첫 번째 함정이 여기다(이슈 #14 §6 「원본 구획에는 저장 버튼을 두지 마세요」).
 * **잠그는 것이 아니라 두지 않는다** — 계약의 `ItemUpdate`가 원본 4열을 아예 담지 않고,
 * 원본을 고치는 경로 자체가 계약에 없다. 비활성 입력칸을 두면 「언젠가 열린다」는 뜻이 되는데
 * 그 경로가 없다. W-06-06 작업자 구획이 세운 형태를 그대로 되풀이한다.
 *
 * **탭 밖 맨 위에 둔다**(결정 2). 어느 탭에 있어도 지금 어느 품목인지 보이고,
 * **원본에 저장 버튼이 없다는 사실이 항상 눈에 보인다.**
 *
 * 안내는 **`editability`가 아니라 고정 문구**다. 계약은 「항상 `RECEIVED_FROM_ERP`」라고 적었으나
 * 목 서버는 `reason:'EDITABLE'`을 준다 — 쓰기 경로가 없다는 사실이 그보다 강한 근거다.
 * 이미 있는 공통 문구를 쓰고 이 화면 전용 문구를 만들지 않는다.
 *
 * **번호를 화면에 내지 않는다.** 기준 단위는 이름으로 옮기고, 옮길 수 없으면 「알 수 없음」이다.
 * 다만 **목록을 받는 중에는 「알 수 없음」을 내지 않는다** — 값이 잘못 담긴 것처럼 읽힌다.
 * 품목유형은 코드 그룹 `ITEM_TYPE`이 준 **이름으로** 낸다 — 좌 목록의 선택칸·칩과 같은 이름이다.
 * 목록을 받기 전이거나 목록에 없는 코드면 코드 문자열 그대로다. 화면이 이름을 지어내지 않는다.
 */
export const ItemOriginPane = ({
  item,
  uomEntries,
  isUomLoading,
  isUomError,
  itemTypeOptions,
}: ItemOriginPaneProps) => (
  <section className="pane" aria-labelledby="item-origin-title">
    <h2 id="item-origin-title" className="pane-title">
      {t.panes.itemOrigin}
    </h2>
    <div className="banner-slot">
      <AlertBanner variant="info">{messages.editability.receivedFromErp(null)}</AlertBanner>
    </div>
    {/* 원본(ERP 소유)과 확장 속성(MES 소유)의 경계를 한 줄로 밝힌다 */}
    <p className="field-note">{t.origin.ownershipNote}</p>

    <div className="form-grid">
      <ValueField label={t.origin.fields.itemCode} value={orEmptyMark(item.itemCode)} />
      <ValueField label={t.origin.fields.itemName} value={orEmptyMark(item.itemName)} />
      <ValueField
        label={t.origin.fields.itemType}
        value={orEmptyMark(codeValueName(itemTypeOptions, item.itemTypeCode))}
      />
      <ValueField
        label={t.origin.fields.baseUom}
        value={lookupLabel(uomEntries, item.baseUomId, isUomLoading, isUomError)}
      />
    </div>
  </section>
);
