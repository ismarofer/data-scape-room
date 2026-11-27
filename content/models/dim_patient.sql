{{ config(materialized='table') }}
-- Dimension: one row per PERSON (several patient files of the same person share the patient_key).
select
    patient_key,
    min(year(birth_date)) as birth_year,
    case
        when min(year(birth_date)) is null then 'n/d'
        when 2023 - min(year(birth_date)) < 18 then '0-17'
        when 2023 - min(year(birth_date)) < 45 then '18-44'
        when 2023 - min(year(birth_date)) < 65 then '45-64'
        when 2023 - min(year(birth_date)) < 80 then '65-79'
        else '80+'
    end as age_band,
    any_value(gender) as gender,
    case any_value(postal_prefix)
        when '15' then 'Área Sanitaria Norte' when '27' then 'Área Sanitaria Lugo'
        when '32' then 'Área Sanitaria Ourense' when '36' then 'Área Sanitaria Sur'
        else 'n/d'
    end as area_sanitaria,
    max(death_date) as death_date
from {{ ref('stg_patients') }}
group by patient_key
