package com.falloon.tortoisespelling

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.falloon.tortoisespelling.ui.Routes
import com.falloon.tortoisespelling.ui.add.AddWordScreen
import com.falloon.tortoisespelling.ui.complete.CompletionScreen
import com.falloon.tortoisespelling.ui.home.HomeScreen
import com.falloon.tortoisespelling.ui.review.ReviewScreen
import com.falloon.tortoisespelling.ui.settings.SettingsScreen
import com.falloon.tortoisespelling.ui.theme.TortoiseSpellingTheme
import com.falloon.tortoisespelling.ui.words.WordListScreen

class MainActivity : ComponentActivity() {

    /**
     * Set when launched from the reminder. Held in state rather than read once, because
     * the activity is singleTop: a tap while it is already open arrives via onNewIntent.
     */
    private var startInReview by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // The launch intent is redelivered on every recreation (rotation, theme change,
        // process-death restore) and when reopened from Recents, extras included. Acting
        // on it again would drop the user back into review, so only a fresh launch counts.
        val launchedFromHistory =
            (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0
        if (savedInstanceState == null && !launchedFromHistory) {
            startInReview = intent.getBooleanExtra(EXTRA_START_REVIEW, false)
        }

        setContent {
            TortoiseSpellingTheme {
                TortoiseSpellingNavHost(
                    startInReview = startInReview,
                    onReviewLaunchHandled = { startInReview = false },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_START_REVIEW, false)) {
            startInReview = true
        }
    }

    companion object {
        const val EXTRA_START_REVIEW = "startReview"
    }
}

@androidx.compose.runtime.Composable
private fun TortoiseSpellingNavHost(
    startInReview: Boolean,
    onReviewLaunchHandled: () -> Unit,
) {
    val navController = rememberNavController()

    // A stale notification can outlive the words that prompted it; review simply finds
    // an empty queue and forwards to the completion screen, so no guard is needed here.
    LaunchedEffect(startInReview) {
        if (startInReview) {
            // Tapping the reminder while already reviewing must not stack a second session.
            navController.navigate(Routes.REVIEW) { launchSingleTop = true }
            onReviewLaunchHandled()
        }
    }

    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.HOME) {
            HomeScreen(
                onStartReview = { navController.navigate(Routes.REVIEW) },
                onPracticeMore = { navController.navigate(Routes.PRACTICE) },
                onAddWord = { navController.navigate(Routes.ADD) },
                onOpenWords = { navController.navigate(Routes.WORDS) },
                onOpenSettings = { navController.navigate(Routes.SETTINGS) },
            )
        }

        composable(Routes.REVIEW) {
            ReviewScreen(
                practiceMode = false,
                onFinished = {
                    navController.navigate(Routes.COMPLETION) {
                        popUpTo(Routes.REVIEW) { inclusive = true }
                    }
                },
                onQuit = { navController.popBackStack(Routes.HOME, inclusive = false) },
            )
        }

        composable(Routes.PRACTICE) {
            ReviewScreen(
                practiceMode = true,
                onFinished = { navController.popBackStack(Routes.HOME, inclusive = false) },
                onQuit = { navController.popBackStack(Routes.HOME, inclusive = false) },
            )
        }

        composable(Routes.COMPLETION) {
            CompletionScreen(
                onDone = { navController.popBackStack(Routes.HOME, inclusive = false) },
                onPracticeMore = { navController.navigate(Routes.PRACTICE) },
            )
        }

        composable(Routes.ADD) {
            AddWordScreen(editingId = null, onDone = { navController.popBackStack() })
        }

        composable(
            route = Routes.EDIT,
            arguments = listOf(navArgument(Routes.EDIT_ARG) { type = NavType.LongType }),
        ) { entry ->
            AddWordScreen(
                editingId = entry.arguments?.getLong(Routes.EDIT_ARG),
                onDone = { navController.popBackStack() },
            )
        }

        composable(Routes.WORDS) {
            WordListScreen(
                onBack = { navController.popBackStack() },
                onEdit = { wordId -> navController.navigate(Routes.edit(wordId)) },
            )
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
