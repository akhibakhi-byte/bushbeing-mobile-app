import { Audio } from 'expo-av';

const WATER_SOUND_URL = 'https://customer-assets.emergentagent.com/job_hydrate-preview/artifacts/ve45yskl_Water%20Flow_Final.mp3';

let waterSound: Audio.Sound | null = null;

export async function playWaterSound() {
  try {
    if (waterSound) {
      await waterSound.unloadAsync();
      waterSound = null;
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: WATER_SOUND_URL },
      { shouldPlay: true, volume: 1.0 }
    );
    waterSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        waterSound = null;
      }
    });
  } catch (e) {
    console.log('Sound playback error:', e);
  }
}
