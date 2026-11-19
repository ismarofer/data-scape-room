{{ config(materialized='table') }}
with admissions as (
    select
        e.encounter_id,
        p.patient_key,
        e.organization_id,
        e.start_ts,
        e.stop_ts
    from {{ ref('stg_encounters') }} e
    join {{ ref('stg_patients') }} p using (patient_id)
    where {{slot:class_filter}}
      and e.stop_ts is not null
),
flagged as (
    select *, lag(stop_ts) over (partition by patient_key order by start_ts, encounter_id) as prev_stop
    from admissions
),
numbered as (
    select *,
        sum(case when {{slot:new_episode}} then 1 else 0 end)
            over (partition by patient_key order by start_ts, encounter_id) as episode_no
    from flagged
)
select
    patient_key || '-' || episode_no as episode_id,
    patient_key,
    episode_no,
    min(start_ts) as admit_ts,
    max(stop_ts) as discharge_ts,
    arg_min(organization_id, start_ts) as organization_id
from numbered
group by patient_key, episode_no
