package com.falloon.spellwise.domain

import com.falloon.spellwise.data.Word
import kotlin.random.Random

/**
 * Spread [newWords] through [dueWords] rather than appending them.
 *
 * All-new-last makes the tail of a session disproportionately hard, which is
 * exactly when attention is lowest.
 */
fun interleaveSession(
    dueWords: List<Word>,
    newWords: List<Word>,
    random: Random = Random.Default,
): List<Word> {
    if (newWords.isEmpty()) {
        return dueWords.shuffled(random)
    }
    val queue = dueWords.shuffled(random).toMutableList()
    newWords.shuffled(random).forEachIndexed { index, word ->
        val position = ((index + 1) * (queue.size + 1)) / (newWords.size + 1)
        queue.add(position.coerceIn(0, queue.size), word)
    }
    return queue
}

/**
 * How many new words may still be introduced today.
 *
 * Counts words *introduced* today, not words reviewed today: the latter would let a
 * heavy review day silently consume the entire new-word allowance.
 */
fun remainingNewToday(newWordsPerDay: Int, introducedToday: Int): Int =
    (newWordsPerDay - introducedToday).coerceAtLeast(0)
