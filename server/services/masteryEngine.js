export function calculateMastery(attempts = []) {
  if (!attempts.length) {
    return {
      mastery: 0,
      confidence: 0,
      trend: "unknown",
    };
  }

  let weightedScore = 0;
  let totalWeight = 0;

  attempts.forEach((attempt, index) => {
    const difficulty = Math.max(
      1,
      Number(attempt.difficulty || 1)
    );

    /*
     * More recent attempts receive slightly more weight.
     */
    const recencyWeight =
      1 + index / Math.max(attempts.length, 1) * 0.5;

    /*
     * Repeated attempts slightly reduce confidence.
     */
    const attemptCount = Math.max(
      1,
      Number(attempt.attempts || 1)
    );

    const attemptPenalty = Math.max(
      0.65,
      1 - (attemptCount - 1) * 0.08
    );

    const weight =
      difficulty *
      recencyWeight *
      attemptPenalty;

    weightedScore +=
      (attempt.correct ? 1 : 0) * weight;

    totalWeight += weight;
  });

  const mastery =
    totalWeight > 0
      ? weightedScore / totalWeight
      : 0;

  /*
   * Confidence grows with the amount of evidence.
   */
  const confidence = Math.min(
    1,
    attempts.length / 10
  );

  let trend = "stable";

  if (attempts.length >= 4) {
    const recent = attempts.slice(-3);
    const previous = attempts.slice(0, -3);

    const recentAccuracy =
      recent.filter((a) => a.correct).length /
      recent.length;

    const previousAccuracy =
      previous.length > 0
        ? previous.filter((a) => a.correct).length /
          previous.length
        : recentAccuracy;

    if (recentAccuracy > previousAccuracy + 0.15) {
      trend = "improving";
    } else if (
      recentAccuracy <
      previousAccuracy - 0.15
    ) {
      trend = "declining";
    }
  }

  return {
    mastery: Number(mastery.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    trend,
  };
}