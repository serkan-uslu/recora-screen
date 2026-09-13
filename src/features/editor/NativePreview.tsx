import { LoaderCircle, Monitor } from "lucide-react";
import { usePreviewEditingController, type PreviewEditingProps } from "../../controllers/usePreviewEditingController";
import { useNativePreviewController } from "../../controllers/useNativePreviewController";

export function NativePreview(props: PreviewEditingProps & { hidden: boolean }) {
  const { project, hidden, onError } = props;
  const interactions = usePreviewEditingController(props);
  const {
    desktop,
    ref,
    stageRef,
    aspect,
    previewWidth,
    ready,
  } = useNativePreviewController({ project, hidden, onError });
  return (
    <div className="preview-stage" ref={stageRef}>
      <div
        {...interactions}
        className="native-preview"
        ref={ref}
        style={{
          width: previewWidth,
          height: previewWidth / aspect,
        }}
      >
        {!ready ? (
          <div className="preview-placeholder">
            <LoaderCircle size={25} className="spin" />
            <span>Preparing preview…</span>
          </div>
        ) : !desktop ? (
          <div className="preview-placeholder">
            <Monitor size={30} />
            <span>Native video preview</span>
            <p>
              Open the desktop app to play this recording.
              <br />
              Your project and editing controls are connected.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
