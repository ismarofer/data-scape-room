-- Canonical definitions (SPEC 9.6). Views `enc`, `pat`, `org` are registered from dist/parquet by 04_answers.py.
-- Placeholders {adm} / {name} are substituted by the runner.

-- name: adm_base
create or replace view adm_base as
select encounter_id, patient_key, organization_id, start_ts, stop_ts
from enc where encounter_class = 'inpatient' and stop_ts is not null;

-- name: adm_clean
create or replace view adm_clean as
select a.* from adm_base a join pat p using (patient_key)
where a.stop_ts >= a.start_ts
  and (p.deathdate is null or cast(a.start_ts as date) <= p.deathdate);

-- name: episodes
create or replace view {name} as
with o as (
  select *, lag(stop_ts) over w as prev_stop from {adm}
  window w as (partition by patient_key order by start_ts, encounter_id)),
f as (
  select *, sum(case when prev_stop is null or start_ts > prev_stop + interval 1 day then 1 else 0 end)
         over (partition by patient_key order by start_ts, encounter_id) as ep_no from o),
e as (
  select patient_key, ep_no, min(start_ts) as admit_ts, max(stop_ts) as discharge_ts,
         arg_min(organization_id, start_ts) as organization_id from f group by 1, 2),
g as (select *, lag(discharge_ts) over (partition by patient_key order by ep_no) as prev_discharge from e)
select *, date_diff('day', cast(prev_discharge as date), cast(admit_ts as date)) as days_since,
       coalesce(date_diff('day', cast(prev_discharge as date), cast(admit_ts as date)) between 2 and 30, false) as is_readmit
from g;

-- name: r1b_unique_encounters
select count(distinct encounter_id) from enc;

-- name: r2c_unique_patients
select count(*) from pat;

-- name: r3c_readmissions_base
select sum(is_readmit::int) from ep_base;

-- name: r4c_excluded
select (select count(*) from adm_base where stop_ts < start_ts)
     + (select count(*) from adm_base a join pat p using (patient_key) where p.deathdate is not null and cast(a.start_ts as date) > p.deathdate);

-- name: r5c_top_center
select o.name from ep_clean e join org o using (organization_id)
group by o.name having count(*) >= 30
order by sum(is_readmit::int)::double / count(*) desc limit 1;
