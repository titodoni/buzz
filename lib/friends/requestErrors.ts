const GENERIC = "Something went wrong. Please try again."

/** Words for the database's friend-request limits (migration 20261124124357), or the generic line. */
export function requestErrorMessage(error: { message?: string } | null): string {
  const m = error?.message ?? ""
  if (/wait before asking again/.test(m)) return "They said no for now. You can ask again in an hour."
  if (/too many requests/.test(m)) return "You've sent a lot of friend requests. Try again later."
  return GENERIC
}
