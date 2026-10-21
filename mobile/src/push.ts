import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Asks for notification permission and returns this phone's push token. */
export async function devicePushToken(): Promise<string> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Xevra",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Notification permission was denied.");
  const token = await Notifications.getDevicePushTokenAsync();
  const value = typeof token.data === "string" ? token.data : "";
  if (!value) throw new Error("This phone did not return a push token.");
  return value;
}
