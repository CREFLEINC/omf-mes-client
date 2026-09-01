import { Capacitor } from '@capacitor/core';
import { Camera, type MediaResult } from '@capacitor/camera';

export class CameraPermissionDenied extends Error {
  constructor() {
    super('카메라 권한이 없습니다.');
    this.name = 'CameraPermissionDenied';
  }
}

export interface CapturedPhoto {
  fileName: string;
  mimeType: string;
  /** base64. 단말 보관소가 문자열만 담는다. */
  data: string;
  /** 화면에 미리 보일 주소. 보관소에 담지 않는다. */
  previewUrl: string;
  byteLength: number;
}

/*
 * 큐에 담길 크기를 줄인다. 원본은 한 장이 수 MB 라 세 장이면 큐가 금세 커지는데, 고장 증상을
 * 알아보는 데 원본 해상도가 필요하지는 않다.
 */
const TARGET_WIDTH = 1280;
const QUALITY = 70;

const ensureCameraPermission = async (): Promise<void> => {
  const current = await Camera.checkPermissions();
  if (current.camera === 'granted') {
    return;
  }

  const requested = await Camera.requestPermissions({ permissions: ['camera'] });
  if (requested.camera !== 'granted') {
    throw new CameraPermissionDenied();
  }
};

export const capturePhoto = async (): Promise<MediaResult> => {
  await ensureCameraPermission();
  return Camera.takePhoto({
    correctOrientation: true,
    targetWidth: TARGET_WIDTH,
    quality: QUALITY,
  });
};

const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('사진을 읽지 못했습니다.'));
    };
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });

/**
 * 찍은 사진을 큐가 담을 수 있는 모양으로 읽는다.
 *
 * 촬영 결과는 파일 주소로 오고 내용은 따로 읽어야 한다. 주소만 들고 있으면 앱이 다시 뜬 뒤
 * 그 파일이 남아 있다는 보장이 없다.
 */
export const readCapturedPhoto = async (result: MediaResult): Promise<CapturedPhoto> => {
  const source = result.uri ?? result.webPath;

  if (source === undefined) {
    throw new Error('사진 파일을 찾지 못했습니다.');
  }

  const url = Capacitor.convertFileSrc(source);
  const blob = await (await fetch(url)).blob();
  const mimeType = blob.type === '' ? 'image/jpeg' : blob.type;

  return {
    fileName: `photo-${String(Date.now())}.${mimeType.endsWith('png') ? 'png' : 'jpg'}`,
    mimeType,
    data: await toBase64(blob),
    previewUrl: url,
    byteLength: blob.size,
  };
};
