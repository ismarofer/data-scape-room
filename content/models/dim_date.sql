{{ config(materialized='table') }}
-- Dimension: one row per calendar day, from the first visit or diagnosis to the last discharge.
with days as (
    select cast(start_ts as date) as d from {{ ref('stg_encounters') }} where start_ts is not null
    union all
    select cast(coalesce(stop_ts, start_ts) as date) from {{ ref('stg_encounters') }} where start_ts is not null
    union all
    select try_cast(start as date) from {{ source('raw', 'conditions') }}
),
bounds as (select min(d) as d0, max(d) as d1 from days)
select
    cast(d as date) as date,
    year(d) as year,
    month(d) as month,
    strftime(d, '%Y-%m') as year_month,
    isodow(d) as weekday,
    isodow(d) >= 6 as is_weekend
from bounds, generate_series(cast(d0 as timestamp), cast(d1 as timestamp), interval 1 day) as t(d)
