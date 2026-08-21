import { useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import Button from "../common/Button";

export default function DistractingAppsList() {
  const distractingApps = useSettingsStore((s) => s.distractingApps);
  const loadDistractingApps = useSettingsStore((s) => s.loadDistractingApps);
  const addDistractingApp = useSettingsStore((s) => s.addDistractingApp);
  const removeDistractingApp = useSettingsStore((s) => s.removeDistractingApp);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadDistractingApps().then(() => setLoaded(true));
  }, [loadDistractingApps]);

  return (
    <div className="distracting-apps">
      <form
        className="distracting-apps-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          addDistractingApp(draft);
          setDraft("");
        }}
      >
        <input
          type="text"
          value={draft}
          maxLength={120}
          placeholder="e.g. Discord, Twitter, Steam"
          aria-label="App name to flag as distracting"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>

      {!loaded ? (
        <div className="skeleton" style={{ height: 88 }} />
      ) : distractingApps.length === 0 ? (
        <p className="distracting-apps-empty">
          No apps flagged yet — only idle time will drive distraction detection.
        </p>
      ) : (
        <ul className="distracting-apps-list">
          {distractingApps.map((app) => (
            <li key={app}>
              <span>{app}</span>
              <button
                type="button"
                aria-label={`Remove ${app} from distracting apps`}
                onClick={() => removeDistractingApp(app)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
