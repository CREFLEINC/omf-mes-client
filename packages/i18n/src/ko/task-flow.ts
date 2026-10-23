/**
 * 모바일 작업 화면이 함께 쓰는 틀의 문구 — 작업 헤더와 단계 표시.
 *
 * 화면마다 따로 적으면 같은 자리가 화면마다 다른 말이 된다.
 */
export const taskFlow = {
  header: {
    /** 작업 헤더의 접근명. 지금 무엇을 처리 중인지 묶는 자리다. */
    label: '처리 중인 작업',
    more: '자세히',
    less: '접기',
    /** 진행 표시. 「몇 개 중 몇 개를 했는가」 */
    progress: (done: number, total: number) => `${String(done)}/${String(total)} 완료`,
  },
  /** 단계 표시. 한 화면에 지시 하나가 서고, 지금 몇 번째인지 함께 보인다. */
  step: (index: number, total: number) => `단계 ${String(index)}/${String(total)}`,
} as const;
