/**
 * 화면 구성 규범(docs/screen-composition.md) 6장 공용 부품의 문구.
 *
 * 부품은 특정 화면을 모르므로 업무 이름은 부르는 화면이 넘긴다. 여기에는 부품 자신이 쓰는 말만 둔다.
 */
export const screenPatterns = {
  /** C-8 페이지 이동 */
  pageNav: {
    label: '쪽 이동',
    first: '처음',
    prev: '이전',
    next: '다음',
    last: '마지막',
    position: (page: number, totalPages: number): string =>
      `${String(page)} / ${String(Math.max(totalPages, 1))}`,
    total: (total: number): string => `총 ${String(total)}건`,
    pageSize: '페이지 크기',
    pageSizeOption: (size: number): string => `${String(size)}건`,
  },
  /** C-5 하단 동작 바 */
  actionBar: {
    region: '하단 동작',
    remaining: (text: string): string => `남은 일: ${text}`,
    prev: '이전',
    next: (stepName: string): string => `다음: ${stepName}`,
  },
  /** T-W-C 처리 화면 틀 */
  processPage: {
    steps: '처리 단계',
    pastSummary: '지난 단계 요약',
    stepDone: (stepName: string): string => `${stepName} 단계로 돌아가기`,
  },
  /** C-9 반영 사항 */
  effectList: {
    title: (task: string): string => `${task} 시 반영 사항`,
    excluded: '제외',
  },
  /** C-18 일괄 동작 결과 */
  bulkResult: {
    summary: (processed: number, partial: number, skipped: number, failed: number): string =>
      `처리 ${String(processed)}건, 일부 처리 ${String(partial)}건, 건너뜀 ${String(skipped)}건, 실패 ${String(failed)}건`,
    items: (name: string, done: number, left: number): string =>
      `${name} ${String(done)}건 처리, ${String(left)}건 남음`,
    outcome: {
      processed: '처리',
      partial: '일부 처리',
      skipped: '건너뜀',
      failed: '실패',
    },
    onlyPartial: '일부 처리만 보기',
    onlySkipped: '건너뜀만 보기',
    onlyFailed: '실패만 보기',
    showAll: '전체 보기',
    close: '결과 닫기',
    fix: '고칠 곳 열기',
    fixFor: (label: string): string => `${label} 고칠 곳 열기`,
    narrowed: (label: string): string => `${label} 건만 표시 중`,
  },
  /** C-12 참조 선택 팝업 */
  referencePicker: {
    open: '눌러서 찾기',
    clear: (label: string): string => `${label} 지우기`,
    keyword: '검색어',
    keywordPlaceholder: '코드나 이름',
    search: '찾기',
    pick: '선택',
    pickReason: '목록에서 한 건을 고르세요',
    searching: '찾는 중입니다',
    empty: (term: string): string =>
      term === '' ? '결과가 없습니다' : `「${term}」 결과가 없습니다`,
    failed: '목록을 불러오지 못했습니다. 다시 찾으세요.',
  },
  /** C-12 일시 입력 */
  dateTimeField: {
    time: (label: string): string => `${label} 시각`,
    timePlaceholder: '00:00',
  },
  /** C-17 자동으로 채운 값 */
  autoValue: {
    chip: '자동',
  },
} as const;
