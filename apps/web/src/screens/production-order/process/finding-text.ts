/**
 * 점검 지적 문구에서 내부 번호를 걷어 낸다(C-13 내부 식별자 노출 금지).
 * 서버 문구는 「설비(1)가 같은 시간대의 …」처럼 번호를 싣는다. 지금 편집 중인 값의 이름을 알면 「이름 (코드)」로 바꾸고,
 * 모르면 번호만 지운다. 서버가 이름을 실어 주면 걷어 낸다(요청 목록에 없음, 화면 쪽 보정).
 */
export interface FindingNames {
  equipment: string | null;
  mold: string | null;
  worker: string | null;
}

const WORDS: Record<string, keyof FindingNames> = {
  설비: 'equipment',
  금형: 'mold',
  작업자: 'worker',
};

export const readableFinding = (
  message: string,
  names: FindingNames = { equipment: null, mold: null, worker: null },
): string =>
  message
    .replace(/(설비|금형|작업자)\(\d+\)/g, (_, word: string) => {
      const name = names[WORDS[word] ?? 'equipment'];
      return name === null ? word : `${word} ${name}`;
    })
    .replace(/\.$/, '');
