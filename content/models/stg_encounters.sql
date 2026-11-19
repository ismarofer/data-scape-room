{{ config(materialized='table') }}
with ranked as (
    select
        encounter_id,
        patient_id,
        organization_id,
        {{slot:date_cast:start_ts}} as start_ts,
        {{slot:date_cast:stop_ts}} as stop_ts,
        {{slot:class_norm}} as encounter_class,
        description,
        loaded_at,
        row_number() over (partition by encounter_id order by loaded_at desc, source_file desc) as rn
    from {{ source('raw', 'encounters') }}
)
select * exclude (rn)
from ranked
where {{slot:dedupe}}
