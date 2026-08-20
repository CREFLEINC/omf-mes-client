export const common = {
  save: '저장',
  cancel: '취소',
  add: '추가',
  search: '조회',
  reset: '초기화',
  confirm: '확인',
  close: '닫기',
  deactivate: '사용 중지',
  saved: '저장했습니다',
  created: '등록했습니다',
  retry: '다시 시도',
  includeInactive: '미사용 포함',
  discardChangesConfirm: '입력한 내용이 저장되지 않았습니다. 변경을 파기할까요?',
  /*
   * 날짜 칸이 비었을 때 트리거에 보이는 글자. `TextField type="date"`는 브라우저가 `yyyy-mm-dd`
   * 마스크를 그려 줬지만 `DatePicker`의 트리거는 우리가 넣지 않으면 빈 칸으로 남는다.
   */
  selectDate: '날짜 선택',
} as const;
