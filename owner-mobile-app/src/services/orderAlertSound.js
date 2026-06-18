import { Platform, Vibration } from "react-native";
import Sound from "react-native-sound";

const ALERT_SOUND_FILENAME = "owner_order_alert.mp3";
const VIBRATION_PATTERN = Platform.select({
  android: [0, 900, 450, 900],
  default: [0, 900, 450, 900],
});

let soundInstance = null;
let loadPromise = null;
let isAlertActive = false;
let isVibrationActive = false;

const logDev = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

Sound.setCategory("Playback");

const releaseSound = () => {
  if (!soundInstance) {
    return;
  }

  soundInstance.release();
  soundInstance = null;
};

const loadAlertSound = async () => {
  if (soundInstance) {
    return soundInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    const nextSound = new Sound(ALERT_SOUND_FILENAME, Sound.MAIN_BUNDLE, (error) => {
      loadPromise = null;

      if (error) {
        logDev("[order-alert] failed to load sound", error);
        nextSound.release();
        resolve(null);
        return;
      }

      nextSound.setNumberOfLoops(-1);
      nextSound.setVolume(1);
      soundInstance = nextSound;
      resolve(soundInstance);
    });
  });

  return loadPromise;
};

const startVibration = () => {
  if (isVibrationActive) {
    return;
  }

  Vibration.vibrate(VIBRATION_PATTERN, true);
  isVibrationActive = true;
};

const stopVibration = () => {
  Vibration.cancel();
  isVibrationActive = false;
};

export const startOrderAlertSound = async () => {
  if (isAlertActive) {
    startVibration();
    return;
  }

  isAlertActive = true;
  startVibration();

  const sound = await loadAlertSound();

  if (!isAlertActive || !sound) {
    return;
  }

  sound.play((success) => {
    if (!success) {
      logDev("[order-alert] playback failed");
      releaseSound();
    }
  });
};

export const stopOrderAlertSound = () => {
  isAlertActive = false;
  stopVibration();

  if (!soundInstance) {
    return;
  }

  soundInstance.stop(() => {
    releaseSound();
  });
};
