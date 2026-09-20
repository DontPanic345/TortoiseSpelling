package io.github.dontpanic345.tortoisespelling.data

import io.github.dontpanic345.tortoisespelling.data.remote.ClaudeClient
import io.github.dontpanic345.tortoisespelling.data.remote.LookupResult
import io.github.dontpanic345.tortoisespelling.data.remote.StaleCard
import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.domain.cardsNeedingRefresh
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Keeps flagged words from going stale.
 *
 * A word that has climbed to a week-long interval has had its definition and example
 * read a dozen times, and by then the sentence teaches nothing. When a review session
 * starts, every flagged word in it is handed back to Claude for a new definition and
 * example, at most once a day.
 *
 * The rewrite deliberately does not race the session it was started by: it lands in
 * the database while the user reviews the old card, and shows up the *next* time the
 * word comes round. Doing it any sooner would mean sitting through a spinner, and a
 * definition that changed halfway through answering would be worse than a stale one.
 *
 * Runs on an application-scoped coroutine rather than the review ViewModel's, so
 * quitting the session partway does not cancel the work. It is not, however, a
 * WorkManager job: if the process dies the remaining words simply keep their old
 * cards, and because a word's day is only marked as it is reached, the ones that
 * missed out are picked up by the next session.
 */
class CardRefresher(
    private val repository: WordRepository,
    private val settings: SettingsStore,
    private val claude: ClaudeClient,
    private val scope: CoroutineScope,
) {

    /** One session's refresh at a time; two overlapping runs would double-spend. */
    private val running = Mutex()

    /**
     * Start rewriting the flagged cards among [words], in the background.
     *
     * Returns immediately. Words are done one at a time on purpose: this is work for
     * later, so there is nothing to be gained by hitting the API in parallel.
     */
    fun refreshInBackground(words: List<Word>) {
        val apiKey = settings.current().apiKey
        if (apiKey.isBlank()) {
            return
        }
        val due = cardsNeedingRefresh(words, Days.today())
        if (due.isEmpty()) {
            return
        }
        scope.launch {
            running.withLock {
                for (word in due) {
                    refresh(word, apiKey)
                }
            }
        }
    }

    private suspend fun refresh(word: Word, apiKey: String) {
        // Claim the day first. A word whose lookup fails waits until tomorrow rather
        // than being retried on every session start, which is what a rejected key or
        // an exhausted rate limit would otherwise do.
        repository.markRefreshAttempted(word, Days.today())

        val result = claude.lookup(
            word = word.text,
            apiKey = apiKey,
            stale = StaleCard(definition = word.definition, example = word.example),
        )
        if (result !is LookupResult.Success) {
            return
        }
        // Only what actually came back is replaced, so a half-empty answer can't wipe
        // a definition that was fine. result.word is ignored on purpose: the row
        // already exists under this spelling, and a refresh is not a rename.
        val definition = result.definition.ifBlank { word.definition }
        val example = result.example.ifBlank { word.example }
        if (definition == word.definition && example == word.example) {
            return
        }
        repository.refreshContent(
            word = word,
            definition = definition,
            example = example,
            partOfSpeech = result.partOfSpeech ?: word.partOfSpeech,
        )
    }
}
