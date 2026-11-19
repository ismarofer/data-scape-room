{{ config(materialized='table') }}
select
    patient_id,
    {{slot:patient_key}} as patient_key,
    try_cast(birthdate as date) as birth_date,
    try_cast(nullif(deathdate, '') as date) as death_date,
    gender,
    left(postal_code, 2) as postal_prefix
from {{ source('raw', 'patients') }}
