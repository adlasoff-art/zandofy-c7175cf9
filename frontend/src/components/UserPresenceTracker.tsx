import { useUserPresence } from "@/hooks/use-user-presence";

export function UserPresenceTracker() {
  useUserPresence();
  return null;
}
