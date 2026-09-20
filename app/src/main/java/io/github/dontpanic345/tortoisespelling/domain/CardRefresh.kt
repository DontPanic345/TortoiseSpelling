package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Word

/**
 * Which of [words] should have their card rewritten by Claude today.
 *
 * A word qualifies when the user asked for it (`autoRefresh`) and it has not already
 * been rewritten today. The daily cap is what keeps the feature cheap: a review
 * session can be started, abandoned and started again several times a day, and
 * without the cap each of those would spend another call on every flagged word.
 *
 * [Word.refreshedOn] is compared for equality with [today] rather than ordered
 * against it, so a clock that has been wound backwards refreshes again instead of
 * locking the word out until it catches up.
 */
fun cardsNeedingRefresh(words: List<Word>, today: Long): List<Word> =
    words.filter { it.autoRefresh && it.refreshedOn != today }
