export type TransferStatus = "SENT" | "IN_TRANSIT" | "READY_TO_COLLECT" | "COLLECTED";

const NEXT_STATUS: Record<TransferStatus, TransferStatus | null> = {
  SENT: "IN_TRANSIT",
  IN_TRANSIT: "READY_TO_COLLECT",
  READY_TO_COLLECT: "COLLECTED",
  COLLECTED: null,
};

export function canTransitionTransfer(current: TransferStatus, next: TransferStatus) {
  return NEXT_STATUS[current] === next;
}