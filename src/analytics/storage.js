export function getStorage(key) {
  try {
    return uni.getStorageSync(key);
  } catch (error) {
    console.warn('getStorageSync failed', error);
    return null;
  }
}

export function setStorage(key, value) {
  try {
    uni.setStorageSync(key, value);
  } catch (error) {
    console.warn('setStorageSync failed', error);
  }
}

export function removeStorage(key) {
  try {
    uni.removeStorageSync(key);
  } catch (error) {
    console.warn('removeStorageSync failed', error);
  }
}
