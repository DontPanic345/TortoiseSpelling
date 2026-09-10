package com.falloon.spellwise

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
import com.falloon.spellwise.ui.Routes
import com.falloon.spellwise.ui.add.AddWordScreen
import com.falloon.spellwise.ui.complete.CompletionScreen
import com.falloon.spellwise.ui.home.HomeScreen
import com.falloon.spellwise.ui.review.ReviewScreen
import com.falloon.spellwise.ui.settings.SettingsScreen
import com.falloon.spellwise.ui.theme.SpellwiseTheme
import com.falloon.spellwise.ui.words.WordListScreen

class MainActivity : ComponentActivity() {

    /**
     * Set when launched from the reminder. Held in state rather than read once, because
     * the activity is singleTop: a tap while it is already open arrives via onNewIntent.
     */
    private var startInReview by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        startInReview = intent?.getBooleanExtra(EXTRA_START_REVIEW, false) == true

        setContent {
            SpellwiseTheme {
                SpellwiseNavHost(
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
private fun SpellwiseNavHost(
    startInReview: Boolean,
    onReviewLaunchHandled: () -> Unit,
) {
    val navController = rememberNavController()

    // A stale notification can outlive the words that prompted it; review simply finds
    // an empty queue and forwards to the completion screen, so no guard is needed here.
    LaunchedEffect(startInReview) {
        if (startInReview) {
            navController.navigate(Routes.REVIEW)
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
