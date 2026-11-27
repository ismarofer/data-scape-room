{{ config(materialized='table') }}
-- Dimension: one row per centre.
select
    organization_id,
    name,
    feed as source_system
from {{ source('raw', 'organizations') }}
