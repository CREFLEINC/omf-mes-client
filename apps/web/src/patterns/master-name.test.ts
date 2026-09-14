import { setLocale } from '@omf-mes/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import { masterName } from './master-name';

/**
 * ⚠ **고른 언어를 되돌려 놓는다.** `setLocale` 은 모듈 하나가 든 전역이라, 두고 나가면 같은
 * 프로세스에서 뒤에 도는 파일이 **베트남어로 선 채** 한국어를 기대하며 잰다.
 */
afterEach(() => {
  setLocale('ko');
});

describe('마스터 명칭', () => {
  it('한국어를 고르면 nameKo 를 쓴다', () => {
    setLocale('ko');

    expect(masterName({ nameKo: '생산 투입', nameVi: 'Đưa vào sản xuất' }, '원본')).toBe(
      '생산 투입',
    );
  });

  it('베트남어를 고르면 nameVi 를 쓴다', () => {
    setLocale('vi');

    expect(masterName({ nameKo: '생산 투입', nameVi: 'Đưa vào sản xuất' }, '원본')).toBe(
      'Đưa vào sản xuất',
    );
  });

  /** ⛔ 빈칸을 내면 무엇을 가리키는지조차 사라진다 — 옮기기 전에는 원본이라도 보이는 편이 낫다. */
  it('고른 언어의 이름이 없으면 원본으로 되돌린다', () => {
    setLocale('vi');

    expect(masterName({ nameKo: '생산 투입', nameVi: null }, '원본')).toBe('원본');
    expect(masterName({}, '원본')).toBe('원본');
  });

  /**
   * ⚠ **공백만 있는 것도 빈 것이다.** ERP 수신본이 빈 문자열로 오는 자리가 있어, 널만 보면
   * 이름 자리에 아무것도 그려지지 않는다.
   */
  it('공백만 있는 이름도 없는 것으로 본다', () => {
    setLocale('vi');

    expect(masterName({ nameVi: '   ' }, '원본')).toBe('원본');
  });

  /** 값이 있으면 둘레 공백을 떼고 낸다 — 표 안에서 들쭉날쭉하게 서지 않는다. */
  it('이름의 둘레 공백을 뗀다', () => {
    setLocale('vi');

    expect(masterName({ nameVi: '  Đạt  ' }, '원본')).toBe('Đạt');
  });
});
