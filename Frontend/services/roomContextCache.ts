import AsyncStorage from "@react-native-async-storage/async-storage";

type CachedRoomContext = {
  hostName?: string;
  caregiverName?: string;
};

const keyOf = (roomId: string) => `ebms.roomContextCache.v1.${roomId}`;

export async function getCachedRoomContext(roomId: string): Promise<CachedRoomContext | null> {
  if (!roomId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyOf(roomId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    return {
      hostName: typeof v.hostName === "string" ? v.hostName : undefined,
      caregiverName: typeof v.caregiverName === "string" ? v.caregiverName : undefined,
    };
  } catch {
    return null;
  }
}

export async function mergeCachedRoomContext(roomId: string, patch: CachedRoomContext): Promise<void> {
  if (!roomId) return;
  try {
    const current = (await getCachedRoomContext(roomId)) || {};
    const next: CachedRoomContext = {
      hostName: patch.hostName || current.hostName,
      caregiverName: patch.caregiverName || current.caregiverName,
    };
    await AsyncStorage.setItem(keyOf(roomId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

