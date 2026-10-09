package expo.modules.bayaancar

enum class GateDecision { DELIVER, WAIT, FAIL }

/**
 * Decides what happens to a car play request or transport while JS may not be
 * ready. Android Auto can bind the library service with no Activity, and then
 * no React tree (player, car bridge) exists. A request waits a short grace
 * period in case the phone app is starting, then fails with a visible error
 * instead of staying queued and playing minutes later.
 */
object CarRequestGate {
  /** No JS runtime at all: the phone app is not running. */
  const val GRACE_MS = 3_000L

  /** A JS runtime registered the module but has not marked ready: the app is booting. */
  const val BOOTING_GRACE_MS = 10_000L

  const val UNAVAILABLE_MESSAGE = "Open Bayaan on your phone to get started"

  fun graceMs(jsRuntimePresent: Boolean): Long = if (jsRuntimePresent) BOOTING_GRACE_MS else GRACE_MS

  /** [waitingSinceMs] is when the current queued request started waiting, or null if nothing waits. */
  fun decide(jsReady: Boolean, jsRuntimePresent: Boolean, waitingSinceMs: Long?, nowMs: Long): GateDecision = when {
    jsReady -> GateDecision.DELIVER
    waitingSinceMs == null -> GateDecision.WAIT
    nowMs - waitingSinceMs < graceMs(jsRuntimePresent) -> GateDecision.WAIT
    else -> GateDecision.FAIL
  }
}
