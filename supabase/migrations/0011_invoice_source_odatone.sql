/* `source` distinguished a seeded placeholder from a real Stripe row. Odatone
   now issues its own, which is neither. Its own file: a value added by
   `alter type` is not usable by another statement inside the same
   transaction, and each migration file is one transaction. */
do $$ begin
  alter type invoice_source add value if not exists 'odatone';
exception when duplicate_object then null;
end $$;
