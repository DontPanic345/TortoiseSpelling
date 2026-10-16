import { useState } from "preact/hooks";
import type { MarkedDay, WordProgress } from "../../domain/progress";
import { CompletionPanel } from "../complete/CompletionPanel";
import { AddIcon, CheckIcon, MoreIcon } from "../common/icons";
import { TopBar } from "../common/TopBar";
import { TestIds } from "../testIds";
import { allDone, hasWords, planTotal, type HomeUiState } from "./homeState";

export interface HomeContentProps {
  state: HomeUiState;
  onStartReview: () => void;
  onPracticeMore: () => void;
  onAddWord: () => void;
  onOpenWords: () => void;
  onOpenSettings: () => void;
  onExport: () => void;
  /** The browser's locale for the week strip's weekday letters; tests pin one. */
  locale?: string;
}

export function HomeContent({
  state,
  onStartReview,
  onPracticeMore,
  onAddWord,
  onOpenWords,
  onOpenSettings,
  onExport,
  locale,
}: HomeContentProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const choose = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <main class="screen home">
      <TopBar
        title="Tortoise Spelling"
        actions={
          <div class="menu-anchor">
            <button
              type="button"
              class="icon-button"
              aria-label="More"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreIcon />
            </button>
            {menuOpen && (
              <div class="menu" role="menu">
                <button type="button" role="menuitem" onClick={choose(onAddWord)}>
                  Add word
                </button>
                <button type="button" role="menuitem" onClick={choose(onOpenWords)}>
                  All words
                </button>
                <button type="button" role="menuitem" onClick={choose(onOpenSettings)}>
                  Settings
                </button>
              </div>
            )}
          </div>
        }
      />

      {!state.loading && !hasWords(state) && <FirstRunPanel onAddWord={onAddWord} />}

      {!state.loading && hasWords(state) && (
        <>
          <div class="greeting">
            <h2 class="greeting-title">{state.greeting}</h2>
            <p class="greeting-date">{state.dateLabel}</p>
          </div>

          {allDone(state) ? (
            <div class="card home-card">
              <CompletionPanel
                reviewedCount={state.reviewedToday}
                // The week card just below shows the streak; saying it twice is noise.
                streak={0}
                nextDueDay={state.nextDueDay}
                today={state.today}
                onPracticeMore={onPracticeMore}
              />
            </div>
          ) : (
            <TodayCard
              count={planTotal(state.plan)}
              newCount={state.plan.newCount}
              reviewedToday={state.reviewedToday}
              onStart={onStartReview}
            />
          )}

          <WeekCard week={state.week} streak={state.streak} locale={locale} />
          <WordsCard progress={state.progress} onOpenWords={onOpenWords} />

          {state.showBackupNudge && (
            <div class="card home-card backup-nudge" data-testid={TestIds.HOME_BACKUP_NUDGE}>
              <p>This browser can clear its storage. Export a backup now and then, so you never lose your words.</p>
              <button type="button" class="button tonal" onClick={onExport}>
                Export
              </button>
            </div>
          )}
        </>
      )}

      <button type="button" class="fab" data-testid={TestIds.HOME_ADD_WORD} onClick={onAddWord}>
        <AddIcon />
        Add word
      </button>
    </main>
  );
}

/** The tortoise is decoration: assistive technology has nothing useful to say about it. */
function Tortoise({ size }: { size: number }) {
  return (
    <span class="tortoise" style={{ fontSize: `${size}px` }} aria-hidden="true">
      🐢
    </span>
  );
}

function TodayCard(props: { count: number; newCount: number; reviewedToday: number; onStart: () => void }) {
  const { count, newCount, reviewedToday, onStart } = props;
  return (
    <div class="card today-card">
      <Tortoise size={48} />
      <div class="today-count" data-testid={TestIds.HOME_PRACTICE_COUNT}>
        {count}
      </div>
      <div class="today-label">{count === 1 ? "word to practise today" : "words to practise today"}</div>
      {newCount > 0 && <div>{newCount === 1 ? "1 of them is new" : `${newCount} of them are new`}</div>}
      <button type="button" class="button start-button" onClick={onStart}>
        Start
      </button>
      {reviewedToday > 0 && <small>Reviewed today: {reviewedToday}</small>}
    </div>
  );
}

const DAY_DESCRIPTIONS: Record<MarkedDay["mark"], string> = {
  PRACTICED: "practised",
  NOTHING_DUE: "nothing was due",
  MISSED: "missed",
  PENDING: "not practised yet",
  BEFORE_START: "before you started",
};

function WeekCard({ week, streak, locale }: { week: MarkedDay[]; streak: number; locale?: string }) {
  return (
    <div class="card home-card" data-testid={TestIds.HOME_WEEK}>
      <div class="card-heading">
        <h3>This week</h3>
        {streak > 0 && (
          // Not the completion panel's "🔥 N day streak" wording: both can be on screen at once.
          <span class="streak">{streak === 1 ? "🔥 1 day in a row" : `🔥 ${streak} days in a row`}</span>
        )}
      </div>
      <div class="week">
        {week.map((day, index) => (
          <DayDot key={day.day} day={day} isToday={index === week.length - 1} locale={locale} />
        ))}
      </div>
    </div>
  );
}

function DayDot({ day, isToday, locale }: { day: MarkedDay; isToday: boolean; locale?: string }) {
  const at = day.day * 86_400_000;
  const letter = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(at);
  const name = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(at);
  const description = DAY_DESCRIPTIONS[day.mark];
  return (
    <div class={`day${isToday ? " today" : ""}`} role="img" aria-label={`${isToday ? "Today" : name}, ${description}`}>
      <span class={`dot ${day.mark.toLowerCase().replace("_", "-")}`}>
        {day.mark === "PRACTICED" && <CheckIcon />}
        {day.mark === "NOTHING_DUE" && <span class="dash" />}
      </span>
      <span class="day-letter">{letter}</span>
    </div>
  );
}

function WordsCard({ progress, onOpenWords }: { progress: WordProgress; onOpenWords: () => void }) {
  const segments = [
    { count: progress.known, kind: "known" },
    { count: progress.learning, kind: "learning" },
    { count: progress.new, kind: "new" },
  ].filter((segment) => segment.count > 0);
  return (
    <div class="card home-card" data-testid={TestIds.HOME_PROGRESS}>
      <div class="card-heading">
        <h3>Your words</h3>
        {/* Not "All words": that's the menu item, which the e2e suite finds by its text. */}
        <button type="button" class="text-button" onClick={onOpenWords}>
          See all
        </button>
      </div>
      <div
        class="progress-bar"
        role="img"
        aria-label={`${progress.known} known, ${progress.learning} learning, ${progress.new} new`}
      >
        {segments.map((segment) => (
          <span key={segment.kind} class={`segment ${segment.kind}`} style={{ flexGrow: segment.count }} />
        ))}
      </div>
      <div class="legend">
        <span class="legend-entry known">{progress.known} known</span>
        <span class="legend-entry learning">{progress.learning} learning</span>
        <span class="legend-entry new">{progress.new} new</span>
      </div>
      <small class="hint">A word is known once it goes three weeks between reviews.</small>
    </div>
  );
}

function FirstRunPanel({ onAddWord }: { onAddWord: () => void }) {
  return (
    <>
      <div class="first-run">
        <Tortoise size={72} />
        <h2>No words yet</h2>
        <p>
          Add a word you keep misspelling. Any chat AI, such as Claude or ChatGPT, can write its definitions and
          example sentences for you, or you can type them yourself.
        </p>
        <button type="button" class="button" onClick={onAddWord}>
          Add your first word
        </button>
      </div>
      <div class="card home-card how-it-works">
        <h3>How it works</h3>
        <Step emoji="📝" text="Add the words you keep getting wrong." />
        <Step emoji="✍️" text="Spell each one from memory, from its definition and an example." />
        <Step emoji="🐢" text="A few minutes a day. Each word comes back just before you'd forget it." />
      </div>
    </>
  );
}

function Step({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div class="step">
      <span class="step-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span>{text}</span>
    </div>
  );
}
