import { orderOfflineMessages } from "./retention";

/** The fields of an undelivered message that the delivery plan needs. */
export interface StoredMessage {
  id: string;
  sender_id: string;
  created_at: string;
}

export interface DeliveryPlan<M extends StoredMessage> {
  /** Messages in the order they should be delivered. */
  ordered: M[];
  /** Waiting messages per sender, for the buddy list "(n)" badges. */
  unreadBySender: Record<string, number>;
}

/** Plans delivery of messages stored while the recipient was offline (Req 9). */
export function planDelivery<M extends StoredMessage>(rows: readonly M[]): DeliveryPlan<M> {
  const unreadBySender: Record<string, number> = {};
  for (const m of rows) unreadBySender[m.sender_id] = (unreadBySender[m.sender_id] ?? 0) + 1;
  return { ordered: orderOfflineMessages([...rows]), unreadBySender };
}
