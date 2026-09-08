-- ============================================================
-- PAY PERIOD ENGINE
-- Adds explicit cutoff attribution to paychecks (V1 lean detection)
-- ============================================================

ALTER TABLE public.paychecks ADD COLUMN period_end DATE;

CREATE INDEX idx_paychecks_user_period_end ON public.paychecks(user_id, period_end);

-- Backfill: for each paycheck, pick the cutoff anchor (prev-month 28th,
-- this-month 13th, this-month 28th, next-month 13th) whose weekend-shifted
-- payout date equals paychecks.date. Rows matching no candidate stay NULL.
-- Weekday shift: Saturday (DOW 6) -> -1 day, Sunday (DOW 0) -> -2 days.
UPDATE public.paychecks AS p
SET period_end = cand.pe
FROM (
  SELECT
    p0.id AS id,
    c.pe AS pe,
    CASE
      WHEN extract(DOW FROM c.pe) = 6 THEN c.pe - 1
      WHEN extract(DOW FROM c.pe) = 0 THEN c.pe - 2
      ELSE c.pe
    END AS payout
  FROM public.paychecks p0
  CROSS JOIN LATERAL (
    SELECT (make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 28) - INTERVAL '1 month')::date AS pe
    UNION ALL
    SELECT make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 13)
    UNION ALL
    SELECT make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 28)
    UNION ALL
    SELECT (make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 13) + INTERVAL '1 month')::date AS pe
  ) AS c
) AS cand
WHERE p.id = cand.id AND p.date = cand.payout;