/** Renders a Tauri accelerator string (e.g. "CommandOrControl+Shift+Escape") for display. */
export function formatHotkey(accelerator: string): string {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform ?? navigator.userAgent);

  return accelerator
    .split("+")
    .map((part) => {
      switch (part) {
        case "CommandOrControl":
        case "CmdOrCtrl":
          return isMac ? "⌘" : "Ctrl";
        case "Command":
        case "Cmd":
          return "⌘";
        case "Control":
        case "Ctrl":
          return "Ctrl";
        case "Shift":
          return isMac ? "⇧" : "Shift";
        case "Alt":
        case "Option":
          return isMac ? "⌥" : "Alt";
        case "Escape":
          return "Esc";
        default:
          return part;
      }
    })
    .join(isMac ? "" : "+");
}
