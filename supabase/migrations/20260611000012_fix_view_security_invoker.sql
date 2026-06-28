-- Fix SECURITY DEFINER on token_effective_owner view.
-- Views run as the creator by default (bypasses RLS). security_invoker = on
-- makes the view run as the querying user, respecting RLS on the underlying tables.
CREATE OR REPLACE VIEW token_effective_owner
  WITH (security_invoker = on)
AS
SELECT
  t.*,
  COALESCE(
    (
      SELECT l.seller
        FROM listings l
       WHERE l.status = 'active'
         AND t.token_id >= l.token_id + l.editions_sold
         AND t.token_id <  l.token_id + l.editions_total
       LIMIT 1
    ),
    t.owner
  ) AS effective_owner,
  (
    SELECT l.listing_id
      FROM listings l
     WHERE l.status = 'active'
       AND t.token_id >= l.token_id + l.editions_sold
       AND t.token_id <  l.token_id + l.editions_total
     LIMIT 1
  ) AS active_listing_id
FROM tokens t;
