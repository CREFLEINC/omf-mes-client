import { describe, expect, it } from 'vitest';

import { readDeviceModel } from './device-model';

const PM95 =
  'Mozilla/5.0 (Linux; Android 13; PM95 Build/TKQ1.241202.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.199 Mobile Safari/537.36';

describe('기기 정보 읽기', () => {
  it('실기 문자열에서 기종과 운영체제를 읽는다', () => {
    expect(readDeviceModel(PM95)).toEqual({ model: 'PM95', platform: 'Android 13' });
  });

  /* 빌드 번호가 붙지 않는 기기가 있다. */
  it('빌드 번호가 없어도 기종을 읽는다', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SYN-DEV-01) AppleWebKit/537.36';

    expect(readDeviceModel(ua)).toEqual({ model: 'SYN-DEV-01', platform: 'Android 14' });
  });

  it('안드로이드가 아니면 둘 다 읽지 못한다', () => {
    expect(readDeviceModel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toEqual({
      model: null,
      platform: null,
    });
  });

  it('빈 문자열도 예외를 내지 않는다', () => {
    expect(readDeviceModel('')).toEqual({ model: null, platform: null });
  });
});
