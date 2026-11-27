{{ config(materialized='table') }}
-- Fact: one row each time a condition is diagnosed. Joins the person (dim_patient) and the day (dim_date).
select
    p.patient_key,
    c.encounter_id,
    try_cast(c.start as date) as diagnosis_date,
    c.code as condition_code,
    c.description
from {{ source('raw', 'conditions') }} c
join {{ ref('stg_patients') }} p using (patient_id)
where try_cast(c.start as date) is not null
