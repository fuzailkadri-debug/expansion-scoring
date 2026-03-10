-- ============================================================
-- BioRender CS Intelligence — MASTER RENEWAL QUERY
-- Run in Hex (warehouse mode, Redshift)
-- Output: one row per open renewal opportunity with ALL columns
--         needed by the app — Salesforce fields + free/self-serve
--         user counts — one file replaces both exports
--
-- To run: paste into a Hex SQL cell, set csm_name param,
--         download result as CSV, upload as "Master CSV" in app
--
-- Columns produced (29 total):
--   opportunity_name, renewal_target_amount, renewed_contract_value,
--   growth_at_renewal, renewal_date, customer_usage_health,
--   customer_relationship_health, cs_poc_relationship_score,
--   cx_notes, license_type, teamorg_id,
--   current_number_of_seats_available, seats_filled,
--   initial_number_of_seats, seat_activation_rate,
--   churn_reason, churn_reason_notes,
--   active_users_last_90_days,
--   free_users_with_dept_match, self_serve_with_dept_match,
--   total_dept_match_users,
--   free_users_without_dept_match, self_serve_without_dept_match,
--   total_free_users, total_self_serve_users, total_users,
--   undergrad_free_users, undergrad_self_serve_users, total_undergrad_users
--
-- Note: undergraduate role_category = 'Academic - Undergraduates and K12'
-- Note: churn_reason_notes sourced from closed_lost_notes__c
--       (no churn_reason_notes__c column exists on opportunity table)
-- ============================================================

WITH

-- Step 1: Open renewals tied to your full-serve accounts
fuzail_fs_accounts AS (
    SELECT DISTINCT
        parent_sf_account_id,
        child_sf_account_id,
        top_level_email_domain
    FROM prod.core.users
    WHERE csm_owner_name = 'Fuzail Kadri'    -- change to your name if needed
      AND is_full_serve = TRUE
),

open_renewals AS (
    SELECT DISTINCT
        o.id AS opportunity_id,
        o.name AS opportunity_name,
        o.accountid,
        o.top_level_account_id,
        sa.top_level_company_domain,
        -- Salesforce renewal fields
        COALESCE(o.renewal_target_amount, o.amount)                          AS renewal_target_amount,
        o.renewed_contract_value__c                                          AS renewed_contract_value,
        COALESCE(o.growth_at_renewal__c, o.expansion_arr_annualized__c)      AS growth_at_renewal,
        COALESCE(o.renewal_date__c, o.closedate)                             AS renewal_date,
        o.customer_usage_health__c                                           AS customer_usage_health,
        o.customer_relationship_health__c                                    AS customer_relationship_health,
        o.cs_poc_relationship_score__c                                       AS cs_poc_relationship_score,
        o.cx_notes__c                                                        AS cx_notes,
        o.licence_type                                                       AS license_type,
        o.teamorg_id__c                                                      AS teamorg_id,
        COALESCE(o.current_number_of_seats_available,
                 o.number_of_seats_paid_for__c)                              AS current_number_of_seats_available,
        o.seats_filled,
        o.initial_number_of_seats__c                                         AS initial_number_of_seats,
        -- Computed seat activation rate
        CASE
            WHEN COALESCE(o.current_number_of_seats_available,
                          o.number_of_seats_paid_for__c) > 0
            THEN o.seats_filled::FLOAT /
                 COALESCE(o.current_number_of_seats_available,
                          o.number_of_seats_paid_for__c)
            ELSE NULL
        END                                                                  AS seat_activation_rate,
        o.churn_reason                                                       AS churn_reason,
        o.closed_lost_notes__c                                               AS churn_reason_notes
    FROM prod.base.base__salesforce__opportunity o
    JOIN prod.core.salesforce_account sa ON o.accountid = sa.id
    WHERE o.record_type_name = 'Renewals'
      AND o.isclosed = FALSE
      AND o.isdeleted = FALSE
      AND (
          o.accountid IN (SELECT child_sf_account_id FROM fuzail_fs_accounts)
          OR o.top_level_account_id IN (SELECT parent_sf_account_id FROM fuzail_fs_accounts)
      )
),

-- Active users last 90 days — computed from core.users since no column on opportunity
active_users_90d AS (
    SELECT
        r.opportunity_id,
        COUNT(DISTINCT u.userid) AS active_users_last_90_days
    FROM open_renewals r
    JOIN prod.core.users u
      ON (u.child_sf_account_id = r.accountid
          OR u.parent_sf_account_id = r.top_level_account_id)
    WHERE u.is_full_serve = TRUE
      AND u.last_access_date >= DATEADD(DAY, -90, CURRENT_DATE)
    GROUP BY r.opportunity_id
),

-- Step 2: Build domain sets per opportunity
-- 2a: Domains from full-serve users at each opportunity's account hierarchy
fs_user_domains AS (
    SELECT DISTINCT
        r.opportunity_id,
        u.top_level_email_domain AS domain
    FROM open_renewals r
    JOIN prod.core.users u
      ON (u.child_sf_account_id = r.accountid
          OR u.parent_sf_account_id = r.top_level_account_id)
    WHERE u.is_full_serve = TRUE
      AND u.top_level_email_domain IS NOT NULL
),

-- 2b: Account-level top_level_company_domain
account_domains AS (
    SELECT DISTINCT
        r.opportunity_id,
        r.top_level_company_domain AS domain
    FROM open_renewals r
    WHERE r.top_level_company_domain IS NOT NULL
),

-- 2c: Union all domains, exclude personal email providers
all_domains AS (
    SELECT opportunity_id, domain FROM fs_user_domains
    UNION
    SELECT opportunity_id, domain FROM account_domains
),

filtered_domains AS (
    SELECT opportunity_id, domain
    FROM all_domains
    WHERE LOWER(domain) NOT IN (
        'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
        'live.com','aol.com','msn.com','ymail.com','mail.com','protonmail.com',
        'me.com','qq.com','163.com','126.com','web.de','gmx.de','gmx.net',
        'yahoo.co.uk','yahoo.co.in','hotmail.co.uk','mail.ru','naver.com',
        'comcast.net','att.net','verizon.net','sbcglobal.net','cox.net',
        'charter.net','earthlink.net','optonline.net','googlemail.com'
    )
),

-- Step 3: Full-serve user departments per opportunity (for dept matching)
fs_departments AS (
    SELECT DISTINCT
        r.opportunity_id,
        u.top_level_email_domain,
        u.department
    FROM open_renewals r
    JOIN prod.core.users u
      ON (u.child_sf_account_id = r.accountid
          OR u.parent_sf_account_id = r.top_level_account_id)
    WHERE u.is_full_serve = TRUE
      AND u.department IS NOT NULL
      AND u.department != ''
),

-- Step 4: Find all free and self-serve users matching the domains
-- Free: subscription_status = 'free' or NULL, not full-serve
-- Self-serve: individual-paid, team-paid (incl outstanding invoice), not full-serve
-- Active in last 180 days: signed up OR logged in within 180 days
candidate_users AS (
    SELECT
        u.userid,
        u.top_level_email_domain,
        u.department,
        u.role_category,
        CASE
            WHEN u.is_full_serve = TRUE THEN 'full_serve'
            WHEN u.subscription_status IN (
                'individual-paid','team-paid',
                'individual-paid - outstanding invoice',
                'team-paid - outstanding invoice'
            ) THEN 'self_serve'
            WHEN u.subscription_status = 'free' OR u.subscription_status IS NULL
                THEN 'free'
            ELSE 'other'
        END AS user_type
    FROM prod.core.users u
    WHERE u.is_full_serve = FALSE
      AND u.is_biorender_employee = FALSE
      AND (
          u.subscription_status IN (
              'free','individual-paid','team-paid',
              'individual-paid - outstanding invoice',
              'team-paid - outstanding invoice'
          )
          OR u.subscription_status IS NULL
      )
      AND (
          u.signup_date >= DATEADD(DAY, -180, CURRENT_DATE)
          OR u.last_access_date >= DATEADD(DAY, -180, CURRENT_DATE)
      )
),

-- Step 5: Join users to opportunities via domains
opp_users AS (
    SELECT
        fd.opportunity_id,
        cu.userid,
        cu.top_level_email_domain,
        cu.department,
        cu.role_category,
        cu.user_type,
        CASE WHEN fsd.department IS NOT NULL THEN TRUE ELSE FALSE END AS has_dept_match,
        CASE
            WHEN cu.role_category = 'Academic - Undergraduates and K12' THEN 'undergrad'
            ELSE 'non_undergrad'
        END AS grad_segment
    FROM filtered_domains fd
    JOIN candidate_users cu ON cu.top_level_email_domain = fd.domain
    LEFT JOIN fs_departments fsd
      ON fsd.opportunity_id = fd.opportunity_id
      AND fsd.top_level_email_domain = cu.top_level_email_domain
      AND LOWER(TRIM(fsd.department)) = LOWER(TRIM(cu.department))
      AND cu.department IS NOT NULL AND cu.department != ''
)

-- Step 6: Aggregate per opportunity — one row per opportunity
SELECT
    r.opportunity_name,
    r.renewal_target_amount,
    r.renewed_contract_value,
    r.growth_at_renewal,
    r.renewal_date,
    r.customer_usage_health,
    r.customer_relationship_health,
    r.cs_poc_relationship_score,
    r.cx_notes,
    r.license_type,
    r.teamorg_id,
    r.current_number_of_seats_available,
    r.seats_filled,
    r.initial_number_of_seats,
    r.seat_activation_rate,
    r.churn_reason,
    r.churn_reason_notes,
    COALESCE(a90.active_users_last_90_days, 0)                               AS active_users_last_90_days,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad' AND ou.user_type = 'free'      AND ou.has_dept_match = TRUE  THEN ou.userid END) AS free_users_with_dept_match,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad' AND ou.user_type = 'self_serve' AND ou.has_dept_match = TRUE  THEN ou.userid END) AS self_serve_with_dept_match,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad'                                 AND ou.has_dept_match = TRUE  THEN ou.userid END) AS total_dept_match_users,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad' AND ou.user_type = 'free'      AND ou.has_dept_match = FALSE THEN ou.userid END) AS free_users_without_dept_match,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad' AND ou.user_type = 'self_serve' AND ou.has_dept_match = FALSE THEN ou.userid END) AS self_serve_without_dept_match,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad' AND ou.user_type = 'free'                                    THEN ou.userid END) AS total_free_users,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad' AND ou.user_type = 'self_serve'                              THEN ou.userid END) AS total_self_serve_users,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'non_undergrad'                                                              THEN ou.userid END) AS total_users,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'undergrad'     AND ou.user_type = 'free'                                    THEN ou.userid END) AS undergrad_free_users,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'undergrad'     AND ou.user_type = 'self_serve'                              THEN ou.userid END) AS undergrad_self_serve_users,
    COUNT(DISTINCT CASE WHEN ou.grad_segment = 'undergrad'                                                                  THEN ou.userid END) AS total_undergrad_users
FROM open_renewals r
LEFT JOIN active_users_90d a90 ON a90.opportunity_id = r.opportunity_id
LEFT JOIN opp_users ou ON ou.opportunity_id = r.opportunity_id
GROUP BY
    r.opportunity_name,
    r.renewal_target_amount,
    r.renewed_contract_value,
    r.growth_at_renewal,
    r.renewal_date,
    r.customer_usage_health,
    r.customer_relationship_health,
    r.cs_poc_relationship_score,
    r.cx_notes,
    r.license_type,
    r.teamorg_id,
    r.current_number_of_seats_available,
    r.seats_filled,
    r.initial_number_of_seats,
    r.seat_activation_rate,
    r.churn_reason,
    r.churn_reason_notes,
    a90.active_users_last_90_days
ORDER BY total_users DESC
