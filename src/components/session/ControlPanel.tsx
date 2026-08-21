import Button from "../common/Button";
import "./ControlPanel.css";

export interface ControlPanelProps {
  frogVisible: boolean;
  onToggleFrogVisible: () => void;
  onOpenSettings: () => void;
  onAbandon: () => void;
}

export default function ControlPanel({
  frogVisible,
  onToggleFrogVisible,
  onOpenSettings,
  onAbandon,
}: ControlPanelProps) {
  return (
    <div className="control-panel" role="toolbar" aria-label="Session controls">
      <Button
        variant="ghost"
        onClick={onToggleFrogVisible}
        aria-pressed={!frogVisible}
        title="Only affects this window — the frog stays on your desktop"
      >
        {frogVisible ? "Hide frog here" : "Show frog here"}
      </Button>
      <Button variant="ghost" onClick={onOpenSettings}>
        Settings
      </Button>
      <Button variant="danger" onClick={onAbandon}>
        Abandon session
      </Button>
    </div>
  );
}
