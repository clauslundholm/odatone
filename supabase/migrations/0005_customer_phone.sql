-- Task 13's fix round found the signup form collecting a phone number
-- (components/signup/SignupFlow.tsx's StepAccount) with nowhere on
-- `customers` to put it — every other field that step collects (cvr,
-- address, postcode, city) already has a column; phone did not. Nullable,
-- like the other optional contact columns it sits beside.
alter table customers add column if not exists phone text;
