-- Post-condition check on the PYQ seed.
--
-- The seed resolves exam_id with a subquery; if no exam named 'BPSC' existed
-- it would have inserted 283 rows with a null exam_id, which the app filters
-- on — the bank would be present in the table and invisible in the product.
-- That is exactly the kind of silent half-failure worth turning into a loud
-- one, so this raises rather than letting it pass.

do $$
declare
  total int;
  orphaned int;
  bihar int;
begin
  select count(*) into total
    from public.mains_questions where source = 'PYQ';
  select count(*) into orphaned
    from public.mains_questions where source = 'PYQ' and exam_id is null;
  select count(*) into bihar
    from public.mains_questions where source = 'PYQ' and bihar_angle;

  if total <> 283 then
    raise exception 'PYQ seed: expected 283 rows, found %', total;
  end if;
  if orphaned > 0 then
    raise exception 'PYQ seed: % rows have no exam_id and would be invisible', orphaned;
  end if;
  if bihar <> 63 then
    raise exception 'PYQ seed: expected 63 Bihar-angle rows, found %', bihar;
  end if;

  raise notice 'PYQ seed verified: % rows, % Bihar-angle, 0 orphaned', total, bihar;
end $$;
