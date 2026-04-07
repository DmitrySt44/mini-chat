const ONESIGNAL_APP_ID = "0ee2af92-ab64-451e-9e70-1bdce50487fe";

let initialized = false;

function ensureDeferred() {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  return window.OneSignalDeferred;
}

function runOneSignal(callback) {
  return new Promise((resolve, reject) => {
    const deferred = ensureDeferred();

    deferred.push(async function (OneSignal) {
      try {
        const result = await callback(OneSignal);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function initOneSignal() {
  if (initialized) return;

  await runOneSignal(async function (OneSignal) {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      serviceWorkerPath: "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: {
        enable: false
      },
      allowLocalhostAsSecureOrigin: false
    });
  });

  initialized = true;
}

export async function loginOneSignal(userId) {
  if (!userId) return;

  await initOneSignal();

  await runOneSignal(async function (OneSignal) {
    await OneSignal.login(userId);
  });
}

export async function logoutOneSignal() {
  await initOneSignal();

  await runOneSignal(async function (OneSignal) {
    try {
      await OneSignal.logout();
    } catch (error) {
      console.error("Ошибка logout OneSignal:", error);
    }
  });
}

export async function requestPushPermission() {
  await initOneSignal();

  return await runOneSignal(async function (OneSignal) {
    await OneSignal.Notifications.requestPermission();

    return {
      permission: OneSignal.Notifications.permission,
      optedIn: OneSignal.User.PushSubscription.optedIn,
      subscriptionId: OneSignal.User.PushSubscription.id,
      externalId: OneSignal.User.externalId
    };
  });
}

export async function getPushState() {
  await initOneSignal();

  return await runOneSignal(async function (OneSignal) {
    return {
      permission: OneSignal.Notifications.permission,
      optedIn: OneSignal.User.PushSubscription.optedIn,
      subscriptionId: OneSignal.User.PushSubscription.id,
      externalId: OneSignal.User.externalId
    };
  });
}