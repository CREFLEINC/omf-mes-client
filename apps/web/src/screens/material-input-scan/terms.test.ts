import { ko } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

const t = ko.materialInputScan;

/** 문구 묶음의 글자 전부. 함수 문구는 예시 인자로 불러 펼친다. */
const allTexts = (node: unknown): string[] => {
  if (typeof node === 'string') return [node];
  if (typeof node === 'function') {
    const args = Array.from({ length: node.length }, (_, index) => (index === 0 ? '예시' : '1'));

    return [String((node as (...rest: string[]) => unknown)(...args))];
  }
  if (node !== null && typeof node === 'object') return Object.values(node).flatMap(allTexts);

  return [];
};

/*
 * 화면 용어집(C-13). 자재 투입의 말은 일반 MES 용어로 정한 표를 따른다. 쓰지 않는 말이 문구에
 * 다시 들어오지 않게 막는다.
 */
describe('자재 투입 문구와 화면 용어집', () => {
  it('정한 용어를 쓴다', () => {
    expect(t.pairs.progressLabel).toBe('투입량');
    expect(t.pairs.progress('30', '100', 'KG')).toBe('30 / 100 KG');
    expect(t.pairs.remaining('70 KG')).toBe('잔량 70 KG');
    expect(t.pairs.over('5 KG')).toBe('불출량보다 5 KG 더 투입했습니다.');
    expect(t.scanned.overMark('5 KG')).toBe('과투입 5 KG');
    expect(t.scanned.pendingMark).toBe('투입 중');
    expect(t.scanned.completeMark).toBe('투입 완료');
    expect(t.scanned.pendingState).toBe('미전송');
    expect(t.scanned.sentState).toBe('전송 완료');
    expect(t.scanned.keypadSubmit).toBe('투입 등록');
    expect(t.scanned.undo).toBe('취소');
    expect(t.scanned.extraInput).toBe('추가 투입');
    expect(t.scanned.remove).toBe('스캔 취소');
    expect(t.scanned.recordsTitle).toBe('투입 내역');
    expect(t.scanned.summary(3, 2)).toBe('투입할 자재 3건, 투입 완료 2건');
    expect(t.remaining.sending('착색 안료', '1 KG')).toBe(
      '착색 안료 1 KG 투입을 다음 스캔 때 전송합니다',
    );
  });

  it('쓰지 않는 말이 없다', () => {
    const banned = [
      '받은 수량',
      '투입한 수량',
      '투입 누계',
      '남은 수량',
      '초과',
      '투입 전',
      '스캔 전',
      '입력 중',
      '보낼 예정',
      '보냄',
      '투입 기록',
      '되돌리기',
      '추가 투입 입력',
      '기록됨',
    ];
    const texts = allTexts(t);
    for (const word of banned) {
      expect(texts.filter((text) => text.includes(word))).toEqual([]);
    }
    /* 음수 글자도 없다. */
    expect(texts.filter((text) => /(^|\s)-\d/.test(text))).toEqual([]);
  });
});
