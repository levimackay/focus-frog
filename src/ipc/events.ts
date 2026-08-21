/**
 * Typed wrappers around @tauri-apps/api's `listen`.
 *
 * Event names and payload shapes must match ARCHITECTURE.md section 8
 * exactly. This is the only place `listen` is called from.
 */
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FocusFrogEventMap, FocusFrogEventName } from "./types";

export type { UnlistenFn };

function on<K extends FocusFrogEventName>(
  event: K,
  handler: (payload: FocusFrogEventMap[K]) => void,
): Promise<UnlistenFn> {
  return listen<FocusFrogEventMap[K]>(event, (evt) => handler(evt.payload));
}

export const events = {
  onSessionUpdate: (handler: (payload: FocusFrogEventMap["session:update"]) => void) =>
    on("session:update", handler),

  onSessionCompleted: (handler: (payload: FocusFrogEventMap["session:completed"]) => void) =>
    on("session:completed", handler),

  onCompanionMessage: (handler: (payload: FocusFrogEventMap["companion:message"]) => void) =>
    on("companion:message", handler),
};
