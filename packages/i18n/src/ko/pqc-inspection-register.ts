/**
 * W-03-11 PQC 검사 등록·조회(관리웹 · omf-all-around#107).
 *
 * 검사 항목·결과 입력·확정의 말은 POP 의 PQC 제품 검사(`pqcInspection`)를 그대로 쓴다 — 같은 판정을
 * 두 자리가 다른 말로 부르지 않는다. 여기에는 목록·화면 틀의 말만 둔다.
 */
export const pqcInspectionRegister = {
  title: 'PQC 검사 등록·조회',
  breadcrumbRoot: '품질관리',

  queue: {
    heading: '검사 의뢰',
    caption: 'PQC 검사 의뢰 목록',
    pendingOnly: '대기·진행만 보기',
    empty: '조건에 맞는 PQC 검사 의뢰가 없습니다.',
    unavailable: '목록을 표시할 수 없습니다.',
    loading: 'PQC 검사 의뢰를 불러오는 중입니다.',
  },

  detail: {
    paneLabel: '검사 입력',
    nothingSelected: '왼쪽 목록에서 검사할 의뢰를 고르세요.',
  },
};
