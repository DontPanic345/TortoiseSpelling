package com.falloon.tortoisespelling.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.falloon.tortoisespelling.data.TodayPlan
import com.falloon.tortoisespelling.data.WordRepository
import com.falloon.tortoisespelling.di.AppContainer
import com.falloon.tortoisespelling.domain.Days
import com.falloon.tortoisespelling.domain.MarkedDay
import com.falloon.tortoisespelling.domain.WordProgress
import com.falloon.tortoisespelling.domain.greeting
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val plan: TodayPlan = TodayPlan(0, 0),
    val streak: Int = 0,
    val reviewedToday: Int = 0,
    val totalWords: Int = 0,
    val nextDueDay: Long? = null,
    val week: List<MarkedDay> = emptyList(),
    val progress: WordProgress = WordProgress(new = 0, learning = 0, known = 0),
    val greeting: String = "",
    val dateLabel: String = "",
) {
    val hasWords: Boolean get() = totalWords > 0

    /** Nothing left today, but there is a list to come back to. */
    val allDone: Boolean get() = hasWords && plan.isClear
}

class HomeViewModel(private val repository: WordRepository) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    /** Called on every resume: due counts move with the clock, not with user actions. */
    fun refresh() {
        viewModelScope.launch {
            val plan = repository.todayPlan()
            val total = repository.observeWordCount().first()

            // A day with nothing due must bridge the streak rather than break it.
            if (total > 0 && plan.isClear) {
                repository.markTodaySatisfied()
            }

            _state.value = HomeUiState(
                loading = false,
                plan = plan,
                streak = repository.currentStreak(),
                reviewedToday = repository.reviewedToday(),
                totalWords = total,
                nextDueDay = repository.nextDueDay(),
                week = repository.lastWeek(),
                progress = repository.progress(),
                greeting = greeting(LocalTime.now().hour),
                dateLabel = LocalDate.now().format(DATE_FORMAT),
            )
        }
    }

    fun nextReviewLabel(): String {
        val next = _state.value.nextDueDay ?: return "nothing scheduled yet"
        return Days.relativeLabel(next)
    }

    companion object {
        /** "Monday 14 September". */
        private val DATE_FORMAT = DateTimeFormatter.ofPattern("EEEE d MMMM")

        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { HomeViewModel(container.repository) }
        }
    }
}
