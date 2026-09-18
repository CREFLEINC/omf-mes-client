/**
 * 품목을 검색해서 고르는 공용 대화상자.
 *
 * 품목 마스터가 수천 건이라 선택칸에 담을 수 없다 — 그 문제를 만나는 화면이 둘 이상이 되어
 * 공용 자리로 세웠다(`W-04-01` 라인 편성 · 앞선 선례 `W-06-05` 품목 확장속성).
 */
export { ItemPickerDialog, type ItemPickerDialogProps } from './dialog';
export { ITEM_PAGE_SIZE, type ItemRow } from './queries';
