export async function initOneSignal() {
  return null;
}

export async function loginOneSignal() {
  return null;
}

export async function logoutOneSignal() {
  return null;
}

export async function requestPushPermission() {
  return {
    permission: "default",
    optedIn: false,
    subscriptionId: null,
    externalId: null,
  };
}

export async function getPushState() {
  return {
    permission: "default",
    optedIn: false,
    subscriptionId: null,
    externalId: null,
  };
}