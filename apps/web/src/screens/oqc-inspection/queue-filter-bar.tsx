import { Button, Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type FormEvent } from 'react';

import { EMPTY_FILTERS, type QueueFilters } from './filters';
import { ItemFilterField } from './item-filter-field';
import {
  EMPTY_DRAFT,
  hasError,
  toDraft,
  type DraftFilters,
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
 * 결과는 좁혀지지 않은 상태가 된다. 품목은 이제 검색 창에서 고르므로(#136) 틀린 값이 칸에 들어올 길이
 * 없고, 주소의 틀린 값은 `readFilters` 가 버린다 — 검증은 남겨 두되 칸 오류 글은 서지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.filters;

export interface QueueFilterBarProps {
  /** 주소가 담은 조건. **정본이다** — 편집 중이던 값도 이것이 바뀌면 따라 되돌아간다 */
  appliedFilters: QueueFilters;
  onSearch: (filters: DraftFilters) => void;
  /** 「대기·진행만 보기」를 켜고 끄면 **바로 조회한다**(#185 · PQC 와 같다) — 조회를 누르지 않는다. */
  onTogglePendingOnly: (pendingOnly: boolean) => void;
  onReset: () => void;
}

export const QueueFilterBar = ({
  appliedFilters,
  onSearch,
  onTogglePendingOnly,
  onReset,
}: QueueFilterBarProps) => {
  const [draft, setDraft] = useState<QueueDraft>(() => toDraft(appliedFilters));
  /* 「대기·진행만 보기」는 누르는 즉시 조회되므로(#185) 편집 상태가 없다 — 주소의 값을 그대로 보인다. */
  const { pendingOnly } = appliedFilters;

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다), 참조로
   * 판정하면 그때마다 사용자가 치던 값이 사라진다.
   *
   * 체크칸은 주소 값을 바로 보이므로 여기서 되돌리지 않는다 — 체크를 바꿨다고 치던 값이 지워지지 않게.
   */
  const { itemId, keyword } = appliedFilters;

  useEffect(() => {
    setDraft(toDraft({ itemId, keyword, pendingOnly: EMPTY_FILTERS.pendingOnly }));
  }, [itemId, keyword]);

  const errors = validateDraft(draft);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    /* 틀린 값을 실어 보내지 않는다. */
    if (hasError(errors)) return;

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
    onReset();
  };

  return (
    <form className="filter-bar" onSubmit={submit}>
      {/* 품목은 검색 창에서 고른다 — 내부 번호를 치지 않는다(IQC #133 과 같은 칸 · omf-all-around#136). */}
      <ItemFilterField
        value={draft.item}
        onChange={(value) => {
          setDraft({ ...draft, item: value });
        }}
      />
      <TextField
        label={t.keyword}
        placeholder={t.keywordPlaceholder}
        value={draft.keyword}
        onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
      />
      <div className="field-cell field-cell-unlabeled oqc-inspection-pending-only">
        <Checkbox
          checked={pendingOnly}
          onChange={(event) => onTogglePendingOnly(event.target.checked)}
        >
          {t.pendingOnly}
        </Checkbox>
      </div>
      {/* 조회·초기화는 한 덩어리로 그 줄의 오른쪽 끝에 선다(IQC 와 같은 자리). */}
      <div className="filter-actions field-cell-unlabeled oqc-inspection-filter-actions">
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
