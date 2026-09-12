package com.falloon.tortoisespelling.data.remote

import org.junit.Assert.assertEquals
import org.junit.Test

class LookupModelTest {

    private fun candidate(id: String, createdAt: String) = LookupModel.Candidate(id, createdAt)

    @Test
    fun `picks the newest haiku-tier model`() {
        val models = listOf(
            candidate("claude-opus-5", "2026-05-01T00:00:00Z"),
            candidate("claude-haiku-4-5-20251001", "2025-10-01T00:00:00Z"),
            candidate("claude-haiku-5-20260601", "2026-06-01T00:00:00Z"),
            candidate("claude-sonnet-5", "2026-02-01T00:00:00Z"),
        )
        assertEquals("claude-haiku-5-20260601", LookupModel.pick(models))
    }

    @Test
    fun `ignores an old retired-tier haiku in favour of the current one`() {
        val models = listOf(
            candidate("claude-3-haiku-20240307", "2024-03-07T00:00:00Z"),
            candidate("claude-haiku-4-5-20251001", "2025-10-01T00:00:00Z"),
        )
        assertEquals("claude-haiku-4-5-20251001", LookupModel.pick(models))
    }

    @Test
    fun `prefers the clean alias over a dated snapshot on a date tie`() {
        val models = listOf(
            candidate("claude-haiku-4-5-20251001", "2025-10-01T00:00:00Z"),
            candidate("claude-haiku-4-5", "2025-10-01T00:00:00Z"),
        )
        assertEquals("claude-haiku-4-5", LookupModel.pick(models))
    }

    @Test
    fun `falls back when no model looks like the cheap tier`() {
        // The tier was renamed out from under us — only opus/sonnet remain recognisable.
        val models = listOf(
            candidate("claude-opus-5", "2026-05-01T00:00:00Z"),
            candidate("claude-sonnet-5", "2026-02-01T00:00:00Z"),
        )
        assertEquals(LookupModel.FALLBACK, LookupModel.pick(models))
    }

    @Test
    fun `falls back on an empty list`() {
        assertEquals(LookupModel.FALLBACK, LookupModel.pick(emptyList()))
    }

    @Test
    fun `matching is case-insensitive`() {
        val models = listOf(candidate("Claude-HAIKU-9", "2027-01-01T00:00:00Z"))
        assertEquals("Claude-HAIKU-9", LookupModel.pick(models))
    }
}
