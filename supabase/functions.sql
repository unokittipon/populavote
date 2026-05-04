-- Run AFTER schema.sql

-- Atomic: mark intent verified + insert N vote rows.
-- If the intent isn't 'pending' or trans_ref is duplicate, raises and rolls back.
create or replace function verify_and_award_votes(
  p_intent_id uuid,
  p_trans_ref text,
  p_points int
) returns void as $$
declare
  v_candidate_id uuid;
begin
  -- Atomically flip status from pending → verified.
  -- If status was already verified/rejected/expired, no row updates and we error.
  update payment_intents
  set status = 'verified',
      slip_trans_ref = p_trans_ref,
      verified_at = now()
  where id = p_intent_id and status = 'pending'
  returning candidate_id into v_candidate_id;

  if v_candidate_id is null then
    raise exception 'Intent not found, already processed, or expired';
  end if;

  -- Insert N vote rows in a single statement
  insert into votes (candidate_id, payment_intent_id)
  select v_candidate_id, p_intent_id
  from generate_series(1, p_points);
end;
$$ language plpgsql;

-- Helpful: expire stale pending intents (call periodically or on-demand)
create or replace function expire_stale_intents() returns int as $$
declare
  n int;
begin
  update payment_intents
  set status = 'expired'
  where status = 'pending'
    and created_at < now() - interval '30 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$ language plpgsql;
