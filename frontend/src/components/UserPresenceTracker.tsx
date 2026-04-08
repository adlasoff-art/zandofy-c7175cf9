import { useUserPresence } from "@/hooks/use-user-presence";
import { useAutoStorePresence } from "@/hooks/useStorePresence";

export function UserPresenceTracker() {
  useUserPresence();
  useAutoStorePresence();
  return null;
}
