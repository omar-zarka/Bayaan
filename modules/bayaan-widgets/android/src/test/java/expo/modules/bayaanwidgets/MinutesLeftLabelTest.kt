package expo.modules.bayaanwidgets

import expo.modules.bayaanwidgets.continuelistening.minutesLeftLabel
import org.junit.Assert.assertEquals
import org.junit.Test

class MinutesLeftLabelTest {
  @Test fun roundsUpToWholeMinutes() = assertEquals("47m left", minutesLeftLabel(46 * 60 + 1.0))
  @Test fun neverShowsZero() = assertEquals("1m left", minutesLeftLabel(5.0))
  @Test fun splitsHours() = assertEquals("1h 58m left", minutesLeftLabel(118 * 60.0))
  @Test fun exactHour() = assertEquals("1h 0m left", minutesLeftLabel(3600.0))
}
