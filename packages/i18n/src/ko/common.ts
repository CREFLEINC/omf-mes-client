export const common = {
  /*
   * 반드시 채워야 하는 칸의 라벨에 붙인다. 화면마다 다르게 적으면 같은 뜻이 두세 모양으로
   * 갈리고, 번역할 때도 자리마다 따로 옮기게 된다.
   */
  required: (label: string) => `${label} (필수)`,
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
   * 화면 뼈대의 이름들. 디자인 시스템이 기본값을 한국어로 들고 있어, 넘겨주지 않으면 다른
   * 언어로 열어도 이 자리만 한국어로 남는다.
   */
  shell: {
    brand: 'OMF-MES 모바일',
    main: '본문',
    skipToMain: '본문으로 건너뛰기',
    notifications: '알림',
  },
  connection: {
    online: '온라인',
    offline: '오프라인',
    /** 담긴 순간 성공으로 보이므로, 아직 닿지 않은 건수를 보이지 않으면 알 방법이 없다. */
    unsent: (count: number) => `전송 대기 ${String(count)}`,
    /** 실패한 것은 기다려도 가지 않는다. 대기와 같은 셈에 넣으면 갈 것으로 읽힌다. */
    returned: (count: number) => `전송 실패 ${String(count)}`,
    /*
     * 자동 재전송을 멈춘 상태. 사라졌다로 읽히면 안 된다 - 적은 것은 그대로 있고 보내기만
     * 멈춘 것이라, 본문이 그 사실을 먼저 말한다.
     */
    stalledTitle: '보낸 기록이 계속 등록되지 않습니다',
    stalledBody: '전송 대기 중인 기록은 그대로 있습니다. 잠시 뒤 다시 보내기를 누르세요.',
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

  /**
   * POP 머리줄의 사번. 화면마다 같은 말로 적는다(`patterns/pop-worker-tag`).
   *
   * 화면마다 제 문구를 갖고 있어 사번을 적는 방식이 셋으로 갈렸다.
   */
  popWorker: {
    label: '사번',
    /** 아직 못 받았다 - 없다가 아니라 모른다다. */
    unknown: '사번 미확인',
  },

  /**
   * 스캔 하나가 대상을 정하는 화면에서, 이미 정해진 뒤에 다른 것을 읽었을 때 되묻는 말.
   *
   * 옆 라벨을 스친 것인지 일부러 바꾼 것인지 화면은 모른다. 조용히 바뀌면 작업자는 앞엣것에
   * 적는 줄 알고 진행한다.
   */
  rescan: {
    title: '다시 스캔했습니다',
    body: (before: string, after: string) =>
      `지금 대상은 ${before} 입니다. 새로 읽은 ${after} 로 바꿀까요?`,
    keep: '그대로 두기',
    replace: '새로 읽은 값으로',
  },
} as const;
