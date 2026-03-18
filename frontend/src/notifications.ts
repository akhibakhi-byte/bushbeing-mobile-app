import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWateringReminders(plants: any[]) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const plant of plants) {
      if (!plant.next_watering) continue;
      const nextDate = new Date(plant.next_watering);
      const now = new Date();
      if (nextDate <= now) continue;
      // Schedule for 9 AM on the watering day
      const triggerDate = new Date(nextDate);
      triggerDate.setHours(9, 0, 0, 0);
      if (triggerDate <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to water!',
          body: `${plant.nickname} needs watering today`,
          data: { plantId: plant.id },
        },
        trigger: { date: triggerDate },
      });
    }
  } catch (e) {
    console.log('Notification scheduling error:', e);
  }
}
