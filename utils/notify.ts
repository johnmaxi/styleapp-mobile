import * as Haptics from "expo-haptics";

export async function notifyEvent(
  type:
    | "new_offer"
    | "bid_rejected"
    | "bid_accepted"
    | "barber_arrived"
    | "status_changed"
) {
  try {
    if (type === "new_offer") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (type === "bid_rejected") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (type === "barber_arrived") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // noop on unsupported devices
  }
}