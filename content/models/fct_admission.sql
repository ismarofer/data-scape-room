{{ config(materialized='table') }}
with e as (
    select *, lag(discharge_ts) over (partition by patient_key order by episode_no) as prev_discharge_ts
    from {{ ref('int_admission_episodes') }}
)
select
    episode_id,
    patient_key,
    organization_id,
    admit_ts,
    discharge_ts,
    cast(admit_ts as date) as admit_date,
    date_diff('day', cast(admit_ts as date), cast(discharge_ts as date)) as length_of_stay_days,
    prev_discharge_ts,
    date_diff('day', cast(prev_discharge_ts as date), cast(admit_ts as date)) as days_since_prev_discharge,
    coalesce(date_diff('day', cast(prev_discharge_ts as date), cast(admit_ts as date)) {{slot:window}}, false) as is_readmission_30d
from e
