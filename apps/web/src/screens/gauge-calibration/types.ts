import type { components } from '@omf-mes/api-client';

/**
 * W-05-10이 다루는 모양들.
 *
 * ⭐ **계측기를 가리키는 칸이 `equipmentId`·`equipmentCode`다** — 계측기는 설비의 한 종류이고
 * 계측기 전용 자원을 두지 않기로 했다(2026-08-19 개정). 「gauge」라는 낱말은 화면 이름에만
 * 있고 자료에는 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Calibration = components['schemas']['Calibration'];

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface CalibrationView {
  calibrationId: number;
  equipmentId: number;
  /** 계약이 선택으로 두었다 — 오지 않으면 `null`이고 표는 내부 번호를 대신 그리지 않는다. */
  equipmentCode: string | null;
  historyTypeCode: string;
  performedOn: string;
  resultCode: string;
  certificateNo: string | null;
  agencyTypeCode: string | null;
  agencyName: string | null;
  /** 차기 검교정 예정일. 검교정·합격일 때 계측기 마스터로 옮겨 간다. */
  nextDueOn: string | null;
  toleranceNote: string | null;
  performedByUserId: number | null;
  remarks: string | null;
}

export interface CalibrationListResult {
  items: CalibrationView[];
  page: PageMeta;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

export const toCalibrationView = (source: Calibration): CalibrationView => ({
  calibrationId: source.calibrationId,
  equipmentId: source.equipmentId,
  equipmentCode: nullable(source.equipmentCode),
  historyTypeCode: source.historyTypeCode,
  performedOn: source.performedOn,
  resultCode: source.resultCode,
  certificateNo: nullable(source.certificateNo),
  agencyTypeCode: nullable(source.agencyTypeCode),
  agencyName: nullable(source.agencyName),
  nextDueOn: nullable(source.nextDueOn),
  toleranceNote: nullable(source.toleranceNote),
  performedByUserId: nullable(source.performedByUserId),
  remarks: nullable(source.remarks),
});

/**
 * 이력을 실시일 내림차순으로 세운다 — **화면이 정하는 읽기 차례**다.
 *
 * ⚠ **계약에 정렬 조건이 없다.** 그래서 이것은 「최신부터 받았다」는 뜻이 아니고, 어느 건을
 * 받았는지는 화면이 알 수 없다. 여기서 정하는 것은 받은 것을 어떤 차례로 읽히게 할 것인가뿐이다.
 *
 * ⛔ **원본 배열을 뒤집지 않는다** — 조회 캐시가 준 배열을 제자리에서 정렬하면 다른 소비처가
 * 보는 차례까지 바뀐다.
 *
 * 같은 날이 여럿이면 **나중에 넣은 것이 위**다(식별자 내림차순) — 정정하려고 덧붙인 이력이
 * 원래 것 아래에 묻히면 덧붙인 뜻이 사라진다.
 */
export const byRecentFirst = (items: readonly CalibrationView[]): CalibrationView[] =>
  [...items].sort((left, right) => {
    if (left.performedOn !== right.performedOn)
      return left.performedOn < right.performedOn ? 1 : -1;

    return right.calibrationId - left.calibrationId;
  });
