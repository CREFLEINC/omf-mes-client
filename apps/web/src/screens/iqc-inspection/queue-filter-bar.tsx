import { Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { FieldLabel } from './field-label';
import type { QueueFilters } from './filters';
import { ItemFilterField } from './item-filter-field';
import {
  EMPTY_DRAFT,
  hasError,
  toDraft,
  toFilters,
  validateDraft,
  type QueueDraft,
} from './queue-draft';
import { useSupplierOptions } from './reference-lookup';

/**
 * 좌측 검사 대기 큐의 조건 줄 — **품목·공급사·의뢰번호 셋뿐이다.**
 *
 * ⭐ 검사 유형과 「아직 안 끝난 것만」은 여기 없다. 조건이 아니라 **이 화면이 무엇인지의
 * 정의**라서 `filters.ts` 가 고정 축으로 늘 싣는다 — 끄고 켤 수 있는 것처럼 보이면 안 된다.
 *
 * ⛔ **번호가 아닌 값을 조용히 무시하지 않는다.** 무시하면 사용자는 자기가 좁혔다고 믿는데
 * 결과는 좁혀지지 않은 상태가 된다. 칸마다 따로 잡아 **멀쩡한 칸까지 고치라고 하지 않는다.**
 * 이제 품목·공급사는 골라서 넣으므로 이 오류는 **주소를 손으로 고친 자리**에서만 선다.
 *
 * ⛔ **사용자에게 내부 번호를 치라고 하지 않는다**(omf-all-around#40). 품목·공급사 칸은
 * `inputMode="numeric"` 으로 번호를 받고 있었다 — 품목 `12588`·거래처 `1063` 을 외우는
 * 검사자는 없다. 품목은 공용 선택 창으로, 공급사는 선택칸으로 바꿨다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.filters;

export interface QueueFilterBarProps {
  /** 주소가 담은 조건. **정본이다** — 편집 중이던 값도 이것이 바뀌면 따라 되돌아간다 */
  appliedFilters: QueueFilters;
  onSearch: (filters: QueueFilters) => void;
  onReset: () => void;
}

export const QueueFilterBar = ({ appliedFilters, onSearch, onReset }: QueueFilterBarProps) => {
  const [draft, setDraft] = useState<QueueDraft>(() => toDraft(appliedFilters));
  const [showErrors, setShowErrors] = useState(false);
  const suppliers = useSupplierOptions();
  const supplierFieldId = useId();
  const supplierNoteId = `${supplierFieldId}-note`;

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   */
  const { itemId, supplierId, keyword } = appliedFilters;

  useEffect(() => {
    setDraft(toDraft({ itemId, supplierId, keyword }));
    setShowErrors(false);
  }, [itemId, supplierId, keyword]);

  const errors = validateDraft(draft);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    /* 틀린 값을 실어 보내지 않는다. 그 대신 어느 칸이 틀렸는지 보인다. */
    if (hasError(errors)) {
      setShowErrors(true);
      return;
    }

    setShowErrors(false);
    onSearch(toFilters(draft));
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다.**
   *
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect 도 깨어나지
   * 않는다 — 그러면 **「초기화」를 눌렀는데 치던 값이 그대로 남는다.**
   */
  const reset = (): void => {
    setDraft(EMPTY_DRAFT);
    setShowErrors(false);
    onReset();
  };

  const errorOf = (invalid: boolean) => (showErrors && invalid ? t.identifierInvalid : undefined);

  /*
   * 선택지에 빈 값(「전체」)을 앞세운다 — **빈 값도 고른 값이다.** 없으면 한 번 좁힌 조건을
   * 선택칸에서 풀 방법이 사라진다.
   */
  const supplierChoices = [{ value: '', label: t.all }, ...suppliers.options];

  return (
    <form className="filter-bar" onSubmit={submit}>
      <ItemFilterField
        value={draft.item}
        onChange={(value) => {
          setDraft({ ...draft, item: value });
        }}
      />
      <div className="field-cell">
        <FieldLabel htmlFor={supplierFieldId} label={t.supplier} />
        <Select
          id={supplierFieldId}
          options={supplierChoices}
          value={draft.supplier}
          placeholder={t.supplierPlaceholder}
          aria-describedby={suppliers.isError ? supplierNoteId : undefined}
          onChange={(value) => {
            setDraft({ ...draft, supplier: String(value) });
          }}
        />
        {/* 빈 선택지를 그냥 두면 사용자가 「공급사가 하나도 없다」로 읽는다. */}
        {suppliers.isError && (
          <span id={supplierNoteId} className="field-note">
            {t.supplierLoadFailed}
          </span>
        )}
      </div>
      <TextField
        label={t.keyword}
        placeholder={t.keywordPlaceholder}
        value={draft.keyword}
        onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
      />
      {/* 조회·초기화는 한 덩어리로 그 줄의 오른쪽 끝에 선다(줄이 바뀌어도 그 줄의 끝). */}
      <div className="filter-actions field-cell-unlabeled iqc-inspection-filter-actions">
        <Button type="submit" variant="filled">
          {t.apply}
        </Button>
        <Button type="button" variant="outlined" onClick={reset}>
          {t.reset}
        </Button>
      </div>
    </form>
  );
};
