/**
 * 코드 수정이 잠긴 사유. 참조 건수를 문구에 넣기 위해 함수로 둔다.
 * 건수를 셀 수 없는 경우(count가 null) 건수를 지어내지 않고 사유만 밝힌다.
 */
export const editability = {
  referenced: (count: number | null): string =>
    count === null
      ? '이미 다른 자료에서 사용 중이라 코드를 바꿀 수 없습니다.'
      : `이미 ${count}건에서 사용 중이라 코드를 바꿀 수 없습니다.`,
  notCountable: (_count: number | null): string =>
    '이 코드를 참조하는 자료의 수를 확인할 수 없어 코드를 잠급니다. 변경이 필요하면 담당자에게 문의하세요.',
  receivedFromErp: (_count: number | null): string =>
    '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
  /** 잠긴 것은 확실하나 사유가 특정되지 않을 때. 사유를 지어내지 않고 잠금 사실만 밝힌다. */
  locked: '지금은 코드를 바꿀 수 없습니다. 변경이 필요하면 담당자에게 문의하세요.',
} as const;
