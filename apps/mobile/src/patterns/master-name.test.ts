import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '@omf-mes/i18n';

import { masterName } from './master-name';

/**
 * 마스터 명칭이 고른 언어를 따라가는가.
 *
 * 화면 문구만 옮기면 품목·사유·작업자 이름이 한국어로 남는다. 실기기 순회에서 출고 유형과
 * 승인 상태가 그렇게 남아 있었다.
 */
describe('마스터 명칭', () => {
  afterEach(() => {
    setLocale('ko');
  });

  it('고른 언어의 이름을 낸다', () => {
    setLocale('vi');

    expect(masterName({ nameKo: '생산 투입', nameVi: 'Đưa vào sản xuất' }, '원본')).toBe(
      'Đưa vào sản xuất',
    );
  });

  it('한국어를 고르면 한국어 이름을 낸다', () => {
    setLocale('ko');

    expect(masterName({ nameKo: '생산 투입', nameVi: 'Đưa vào sản xuất' }, '원본')).toBe(
      '생산 투입',
    );
  });

  /* 마스터가 아직 옮겨지지 않은 동안 빈칸을 내면 무엇을 가리키는지조차 사라진다. */
  it('고른 언어의 이름이 비면 원본을 낸다', () => {
    setLocale('vi');

    expect(masterName({ nameKo: '생산 투입', nameVi: null }, '원본')).toBe('원본');
    expect(masterName({}, '원본')).toBe('원본');
  });
});
