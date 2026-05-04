import { createInitialEditable, type EditProfileState } from "@/data/me-edit";

let saved: EditProfileState = createInitialEditable();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeMeProfile(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getMeProfileSnapshot(): EditProfileState {
  return saved;
}

/** Same as `getMeProfileSnapshot` — for `useSyncExternalStore` SSR parity. */
export function getServerMeProfileSnapshot(): EditProfileState {
  return getMeProfileSnapshot();
}

export function setMeProfileSnapshot(next: EditProfileState) {
  saved = next;
  emit();
}
