import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type FormEvent } from 'react';

import type { QueueFilters } from './filters';
import {
  EMPTY_DRAFT,
  hasError,
  toDraft,
  toFilters,
  validateDraft,
  type QueueDraft,
} from './queue-draft';

/**
 * 좌측 검사 대기 큐의 조건 줄 — **품목·공급사·의뢰번호 셋뿐이다.**
 *
 * ⭐ 검사 유형과 「아직 안 끝난 것만」은 여기 없다. 조건이 아니라 **이 화면이 무엇인지의
 * 정의**라서 `filters.ts` 가 고정 축으로 늘 싣는다 — 끄고 켤 수 있는 것처럼 보이면 안 된다.
 *
 * ⛔ **번호가 아닌 값을 조용히 무시하지 않는다.** 무시하면 사용자는 자기가 좁혔다고 믿는데
 * 결과는 좁혀지지 않은 상태가 된다. 칸마다 따로 잡아 **멀쩡한 칸까지 고치라고 하지 않는다.**
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

  return (
    <form className="filter-bar" onSubmit={submit}>
      <TextField
        label={t.item}
        placeholder={t.itemPlaceholder}
        inputMode="numeric"
        value={draft.item}
        error={errorOf(errors.item)}
        onChange={(event) => setDraft({ ...draft, item: event.target.value })}
      />
      <TextField
        label={t.supplier}
        placeholder={t.supplierPlaceholder}
        inputMode="numeric"
        value={draft.supplier}
        error={errorOf(errors.supplier)}
        onChange={(event) => setDraft({ ...draft, supplier: event.target.value })}
      />
      <TextField
        label={t.keyword}
        placeholder={t.keywordPlaceholder}
        value={draft.keyword}
        onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
      />
      <Button type="submit" variant="filled" size="sm">
        {t.apply}
      </Button>
      <Button type="button" variant="outlined" size="sm" onClick={reset}>
        {t.reset}
      </Button>
    </form>
  );
};
