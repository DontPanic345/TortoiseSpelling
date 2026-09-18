package io.github.dontpanic345.tortoisespelling.ui.complete

import org.junit.Assert.assertEquals
import org.junit.Test

class CompletionHeadlineTest {

    @Test
    fun `a review tomorrow says see you tomorrow`() {
        assertEquals("All done — see you tomorrow", completionHeadline(nextDueDay = 101, today = 100))
    }

    @Test
    fun `a later review does not promise tomorrow`() {
        assertEquals("All done for today", completionHeadline(nextDueDay = 105, today = 100))
    }

    @Test
    fun `nothing scheduled does not promise tomorrow`() {
        assertEquals("All done for today", completionHeadline(nextDueDay = null, today = 100))
    }
}
