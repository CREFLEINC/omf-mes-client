export interface DeviceModel {
  model: string | null;
  platform: string | null;
}

const MODEL = /Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\s*[;)]/;
const PLATFORM = /(Android [\d.]+)/;

/**
 * 어느 기기에서 도는지 화면이 말할 수 있게 한다.
 *
 * 등록이 안 되거나 스캐너가 이상할 때 관리자가 먼저 묻는 것이 기종과 운영체제다. 사용자
 * 문자열 말고는 이 정보를 얻을 자리가 없고, 읽지 못하는 문자열도 있으므로 null 을 낸다.
 */
export const readDeviceModel = (userAgent: string): DeviceModel => ({
  model: MODEL.exec(userAgent)?.[1]?.trim() ?? null,
  platform: PLATFORM.exec(userAgent)?.[1] ?? null,
});
