import { Button, Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type FormEvent } from 'react';

import { EMPTY_FILTERS, type QueueFilters } from './filters';
import {
  EMPTY_DRAFT,
  hasError,
  toDraft,
  toFilters,
  validateDraft,
  type QueueDraft,
} from './queue-draft';

/**
 * 좌측 검사 대상 목록의 조건 줄 — **품목·의뢰번호·「대기·진행만 보기」 셋뿐이다.**
 *
 * ⭐ 검사 유형(OQC)은 여기 없다. 조건이 아니라 **이 화면이 무엇인지의 정의**라서 `filters.ts` 가
 * 고정 축으로 늘 싣는다 — 끄고 켤 수 있는 것처럼 보이면 안 된다.
 *
 * ⛔ **기간 칸을 만들지 않는다.** 계약에 자리가 없고, 화면이 대신 거르면 스펙이 뜻한 날짜(검사일)가
 * 아니라 의뢰 생성 시각으로 걸러진다 — 화면은 멀쩡히 돌고 값만 틀린다.
 *
 * ⛔ **번호가 아닌 값을 조용히 무시하지 않는다.** 무시하면 사용자는 자기가 좁혔다고 믿는데
 * 결과는 좁혀지지 않은 상태가 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.filters;

export interface QueueFilterBarProps {
  /** 주소가 담은 조건. **정본이다** — 편집 중이던 값도 이것이 바뀌면 따라 되돌아간다 */
  appliedFilters: QueueFilters;
  onSearch: (filters: QueueFilters) => void;
  onReset: () => void;
}

export const QueueFilterBar = ({ appliedFilters, onSearch, onReset }: QueueFilterBarProps) => {
  const [draft, setDraft] = useState<QueueDraft>(() => toDraft(appliedFilters));
  /**
   * 「대기·진행만 보기」는 초안 타입 밖에 둔다 — boolean 이라 「치는 중」도 「틀린 값」도 없다.
   * 조회를 누를 때 `toFilters` 가 인자로 받아 조건에 합류한다.
   */
  const [pendingOnly, setPendingOnly] = useState(appliedFilters.pendingOnly);
  const [showErrors, setShowErrors] = useState(false);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다), 참조로
   * 판정하면 그때마다 사용자가 치던 값이 사라진다.
   *
   * ⭐ **`pendingOnly` 를 의존성에 반드시 넣는다.** 빠뜨리면 뒤로가기로 토글만 달라진 주소로
   * 돌아왔을 때 체크박스가 앞 상태 그대로 서고, 화면은 **목록과 다른 조건을 보이게 된다.**
   */
  const { itemId, keyword, pendingOnly: appliedPendingOnly } = appliedFilters;

  useEffect(() => {
    setDraft(toDraft({ itemId, keyword, pendingOnly: appliedPendingOnly }));
    setPendingOnly(appliedPendingOnly);
    setShowErrors(false);
  }, [itemId, keyword, appliedPendingOnly]);

  const errors = validateDraft(draft);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    /* 틀린 값을 실어 보내지 않는다. 그 대신 어느 칸이 틀렸는지 보인다. */
    if (hasError(errors)) {
      setShowErrors(true);
      return;
    }

    setShowErrors(false);
    onSearch(toFilters(draft, pendingOnly));
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다.**
   *
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect 도 깨어나지
   * 않는다 — 그러면 **「초기화」를 눌렀는데 치던 값이 그대로 남는다.**
   */
  const reset = (): void => {
    setDraft(EMPTY_DRAFT);
    /*
     * ⛔ **기본값을 여기 다시 적지 않는다.** 정본은 `filters.ts` 이고 부모의 `onReset` 도 그쪽을
     * 쓴다. 손으로 적어 두면 기본값이 뒤집히는 날, **이미 기본 상태인 화면에서 초기화를 누를 때**
     * 주소가 안 바뀌어 되돌림 effect 도 안 깨어나고 체크박스만 어긋난 채 남는다.
     */
    setPendingOnly(EMPTY_FILTERS.pendingOnly);
    setShowErrors(false);
    onReset();
  };

  return (
    <form className="filter-bar" onSubmit={submit}>
      <TextField
        label={t.item}
        placeholder={t.itemPlaceholder}
        inputMode="numeric"
        value={draft.item}
        error={showErrors && errors.item ? t.identifierInvalid : undefined}
        onChange={(event) => setDraft({ ...draft, item: event.target.value })}
      />
      <TextField
        label={t.keyword}
        placeholder={t.keywordPlaceholder}
        value={draft.keyword}
        onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
      />
      <div className="field-cell field-cell-unlabeled">
        <Checkbox checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)}>
          {t.pendingOnly}
        </Checkbox>
      </div>
      <Button type="submit" variant="filled" size="sm">
        {t.apply}
      </Button>
      <Button type="button" variant="outlined" size="sm" onClick={reset}>
        {t.reset}
      </Button>
    </form>
  );
};
