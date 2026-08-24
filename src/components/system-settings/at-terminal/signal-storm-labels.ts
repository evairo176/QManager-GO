// ─── Signal Storm — translated label bundle ──────────────────────────────────
// Pure TS. Zero React/i18next coupling. The React wrapper
// (signal-storm-game.tsx) resolves every string via `t(...)` and passes the
// frozen bundle into SignalStormEngine at construction time. Engine reads
// labels at draw time — no runtime t-function indirection.

export interface GameLabels {
  hud: {
    score: string;
    best: string;
    wave: string;
  };
  power_ups: {
    /** Prefix only. Suffix " Ns" is concatenated by the engine. */
    rapid_fire: string;
    /** Prefix only. Suffix " Ns" is concatenated by the engine. */
    spread: string;
    shield: string;
  };
  pause: {
    title: string;
    resume_hint: string;
  };
  game_over: {
    title: string;
    score_label: string;
    new_high_score: string;
    /** Prefix only. Suffix " N" is concatenated by the engine. */
    best_prefix: string;
    controls_hint: string;
  };
  boss_defeated: string;
  muted: string;
  boss_names: Record<1 | 2 | 3 | 4 | 5, string>;
  boss_subtitles: Record<1 | 2 | 3 | 4 | 5, string>;
}

/**
 * Factory that resolves every signal_storm.* key via the caller's `t`.
 *
 * Callers are expected to wrap the invocation in `useMemo([t])` so the
 * bundle's identity changes only on language swap. Engine constructor
 * re-instantiation is keyed off that identity change.
 */
export function buildGameLabels(
  t: (key: string) => string,
): GameLabels {
  return {
    hud: {
      score: t("signal_storm.hud.score"),
      best: t("signal_storm.hud.best"),
      wave: t("signal_storm.hud.wave"),
    },
    power_ups: {
      rapid_fire: t("signal_storm.power_ups.rapid_fire"),
      spread: t("signal_storm.power_ups.spread"),
      shield: t("signal_storm.power_ups.shield"),
    },
    pause: {
      title: t("signal_storm.pause.title"),
      resume_hint: t("signal_storm.pause.resume_hint"),
    },
    game_over: {
      title: t("signal_storm.game_over.title"),
      score_label: t("signal_storm.game_over.score_label"),
      new_high_score: t("signal_storm.game_over.new_high_score"),
      best_prefix: t("signal_storm.game_over.best_prefix"),
      controls_hint: t("signal_storm.game_over.controls_hint"),
    },
    boss_defeated: t("signal_storm.boss_defeated"),
    muted: t("signal_storm.muted"),
    boss_names: {
      1: t("signal_storm.boss_names.tier_1"),
      2: t("signal_storm.boss_names.tier_2"),
      3: t("signal_storm.boss_names.tier_3"),
      4: t("signal_storm.boss_names.tier_4"),
      5: t("signal_storm.boss_names.tier_5"),
    },
    boss_subtitles: {
      1: t("signal_storm.boss_subtitles.tier_1"),
      2: t("signal_storm.boss_subtitles.tier_2"),
      3: t("signal_storm.boss_subtitles.tier_3"),
      4: t("signal_storm.boss_subtitles.tier_4"),
      5: t("signal_storm.boss_subtitles.tier_5"),
    },
  };
}
