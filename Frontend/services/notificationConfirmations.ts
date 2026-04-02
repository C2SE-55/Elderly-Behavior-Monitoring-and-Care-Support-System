import type { RoomMemberRole } from "@/services/api";
import { getNotificationLogs, updateNotificationLog } from "@/services/notificationLog";

export type GenericConfirmation = {
  kind: "generic-confirmation";
  confirmations: { host: boolean; caretaker: boolean };
  first_confirmed_by?: RoomMemberRole;
  last_confirmed_by?: RoomMemberRole;
  status: "pending" | "half" | "done";
};

const computeStatus = (c: { host: boolean; caretaker: boolean }): GenericConfirmation["status"] => {
  const count = (c.host ? 1 : 0) + (c.caretaker ? 1 : 0);
  if (count >= 2) return "done";
  if (count === 1) return "half";
  return "pending";
};

export const getGenericConfirmationFromData = (data: any): GenericConfirmation | null => {
  const c = data?.confirmation;
  if (!c || c.kind !== "generic-confirmation") return null;
  if (!c.confirmations) return null;
  return c as GenericConfirmation;
};

export async function confirmNotificationLog(logId: string, role: RoomMemberRole): Promise<GenericConfirmation | null> {
  const logs = await getNotificationLogs();
  const entry = logs.find((x) => x.id === logId);
  if (!entry) return null;

  const existing = getGenericConfirmationFromData(entry.data) || {
    kind: "generic-confirmation" as const,
    confirmations: { host: false, caretaker: false },
    status: "pending" as const,
  };

  if (role === "host" && existing.confirmations.host) return existing;
  if (role === "caretaker" && existing.confirmations.caretaker) return existing;

  const nextConfirmations =
    role === "host"
      ? { ...existing.confirmations, host: true }
      : { ...existing.confirmations, caretaker: true };
  const next: GenericConfirmation = {
    kind: "generic-confirmation",
    confirmations: nextConfirmations,
    first_confirmed_by: existing.first_confirmed_by || role,
    last_confirmed_by: role,
    status: computeStatus(nextConfirmations),
  };

  await updateNotificationLog(logId, {
    data: {
      ...(entry.data || {}),
      confirmation: next,
    },
  });

  return next;
}

