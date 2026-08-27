import { Camera, type MediaResult } from '@capacitor/camera';

export class CameraPermissionDenied extends Error {
  constructor() {
    super('카메라 권한이 없습니다.');
    this.name = 'CameraPermissionDenied';
  }
}

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
  return Camera.takePhoto({ correctOrientation: true });
};
