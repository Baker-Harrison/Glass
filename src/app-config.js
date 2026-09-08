// App identity, independent of the signed-in provider account.
export const profile = { displayName: "Glass", initials: "G" };

// Future updater integration owns this flag. Never infer availability from
// authentication, startup, or the installed version alone.
export const features = { updateAvailable: false };
