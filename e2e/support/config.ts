import path from 'node:path';

/** The application id from app/build.gradle.kts. */
export const APP_ID = 'com.falloon.tortoisespelling';

/**
 * The APK under test. Defaults to the debug build; point APK at a release build to
 * check that R8 has not stripped anything the app needs at runtime.
 */
export const APK_PATH =
    process.env.APK ?? path.resolve(import.meta.dirname, '../../app/build/outputs/apk/debug/app-debug.apk');

/**
 * Scenarios that run by default. @todo marks steps not implemented yet, @live-api needs
 * a real Anthropic key typed into the app, @slow waits minutes for a real reminder.
 * Override with --cucumberOpts.tags="..." or the E2E_TAGS environment variable.
 */
export const DEFAULT_TAGS = 'not @todo and not @live-api and not @slow';

/** Where failure artifacts (page source, screenshots) and the Appium log go. */
export const LOG_DIR = path.resolve(import.meta.dirname, '../logs');
