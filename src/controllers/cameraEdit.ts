import type { CameraLayoutSettings, EditOperation, Range } from '../../shared/types';

export function cameraEdit(selection: Range, scope: 'selection' | 'entire', settings: Partial<CameraLayoutSettings>): EditOperation {
  return scope === 'selection' && selection.endMs > selection.startMs
    ? { type: 'camera.layout.set', ...selection, settings }
    : { type: 'camera.update', settings };
}
