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
  connection: {
    online: '온라인',
    offline: '오프라인',
    /** 담긴 순간 성공으로 보이므로, 아직 닿지 않은 건수를 보이지 않으면 알 방법이 없다. */
    unsent: (count: number) => `미동기 ${String(count)}`,
    /** 되돌아온 것은 기다려도 가지 않는다. 미동기와 같은 셈에 넣으면 갈 것으로 읽힌다. */
    returned: (count: number) => `되돌아옴 ${String(count)}`,
    /*
     * 자동 재전송을 멈춘 상태. ⛔ **「사라졌다」로 읽히면 안 된다** — 담긴 것은 그대로 있고
     * 보내기만 멈춘 것이라, 본문이 그 사실을 먼저 말한다.
     */
    stalledTitle: '서버가 계속 받지 않습니다',
    stalledBody:
      '담긴 것은 그대로 남아 있습니다. 서버 상태를 확인한 뒤 「다시 보내기」를 누르세요.',
    stalledRetry: '다시 보내기',
  },
  reference: {
    empty: '—',
    unknown: '알 수 없음',
    loading: '이름 불러오는 중',
    failed: '이름을 불러오지 못했습니다',
    inactiveSuffix: ' (미사용)',
  },
  /*
   * 날짜 칸이 비었을 때 트리거에 보이는 글자. `TextField type="date"`는 브라우저가 `yyyy-mm-dd`
   * 마스크를 그려 줬지만 `DatePicker`의 트리거는 우리가 넣지 않으면 빈 칸으로 남는다.
   */
  selectDate: '날짜 선택',
} as const;
