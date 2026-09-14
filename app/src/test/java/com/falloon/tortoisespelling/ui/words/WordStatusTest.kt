package com.falloon.tortoisespelling.ui.words

import com.falloon.tortoisespelling.data.Word
import com.falloon.tortoisespelling.domain.WordFilter
import org.junit.Assert.assertEquals
import org.junit.Test

class WordStatusTest {

    private fun word(
        isNew: Boolean = false,
        suspended: Boolean = false,
        dueOn: Long = 100,
    ) = Word(
        text = "cat",
        normalizedText = "cat",
        definition = "An animal.",
        example = "",
        dueOn = dueOn,
        isNew = isNew,
        suspended = suspended,
    )

    @Test
    fun `a new word reads as new`() {
        assertEquals("new", statusLabel(word(isNew = true), today = 100))
    }

    @Test
    fun `suspension outranks everything else`() {
        // A suspended word is not coming back tomorrow, whatever its due date says.
        assertEquals("suspended", statusLabel(word(suspended = true, dueOn = 100), today = 100))
        assertEquals("suspended", statusLabel(word(suspended = true, isNew = true), today = 100))
    }

    @Test
    fun `a word due today says so`() {
        assertEquals("due today", statusLabel(word(dueOn = 100), today = 100))
    }

    @Test
    fun `an overdue word still reads as due today rather than a negative`() {
        assertEquals("due today", statusLabel(word(dueOn = 95), today = 100))
    }

    @Test
    fun `a future word shows when it returns`() {
        assertEquals("tomorrow", statusLabel(word(dueOn = 101), today = 100))
        assertEquals("in 5 days", statusLabel(word(dueOn = 105), today = 100))
    }
}

class NoMatchesBodyTest {

    @Test
    fun `a search with no filter names the query`() {
        assertEquals("Nothing in your list matches “xyz”.", noMatchesBody("xyz", WordFilter.ALL))
    }

    @Test
    fun `a filter with no search names the filter`() {
        assertEquals("No suspended words.", noMatchesBody("", WordFilter.SUSPENDED))
        assertEquals("No due words.", noMatchesBody("  ", WordFilter.DUE))
    }

    @Test
    fun `a filter combined with a search names both`() {
        assertEquals("No suspended words match “xyz”.", noMatchesBody("xyz", WordFilter.SUSPENDED))
    }
}
