/**
 * The only sign-in implementation wired into the app.
 * To use another provider later, replace the body of signInWithMicrosoft
 * in AuthContext and point this name at the new provider. Session storage
 * and the login screen stay the same.
 */
export const ACTIVE_SIGN_IN_PROVIDER = 'microsoft' as const

export type SignInProviderId = typeof ACTIVE_SIGN_IN_PROVIDER
