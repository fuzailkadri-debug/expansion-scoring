# Hex Queries for Free/Self-Serve User Identification

Run these queries in Hex to get free user counts that feed into the expansion scoring model.

---

## MAIN QUERY (Current Production Query)

This is the natural language prompt used to generate the current expansion scoring data:

```
Find all open renewals on Salesforce under CSM owner Fuzail Kadri

Identify email domains from those accounts by:
1. Starting with domains from full-serve users
2. Expanding to the top-level domain
3. Finding all users who share either the specific domain OR the top-level domain
4. Exclude personal email domains like Gmail.com

Find free users signed up OR logged in within the last 180 days and self-serve
(individual/team paid) users matching those domains.

Flag users whose department matches any full-serve user's department at the same institution.

**IMPORTANT: Exclude the undergraduate role category**

Aggregate the numbers for each opportunity so I can see the total instead of each user's info.

Output a downloadable CSV with:
- account name
- opportunity name
- department name
- number of free users
- number of self-serve users
- how many match department names (num_users_with_dept_match)
```

**Key Filters Applied:**
- ✅ Undergraduate role category excluded
- ✅ Personal email domains excluded (Gmail, etc.)
- ✅ 180-day activity window
- ✅ Department matching flagged

**Output file:** `csv_export_-_users_by_opportunity_&_department_[DATE].csv`

---

## Alternative SQL Queries

If you need to run SQL directly instead of using natural language, use these queries:

### Query 1: Combined Free + Self-Serve Summary (MAIN OUTPUT)

This is the primary query - gives you total expansion-eligible users per domain.

```sql
-- MAIN QUERY: Combined Free + Self-Serve User Summary
-- Output: One row per email domain with total expansion-eligible users

SELECT
    SPLIT_PART(email, '@', 2) AS email_domain,
    COUNT(DISTINCT user_id) AS total_expansion_users,
    COUNT(DISTINCT CASE 
        WHEN subscription_type = 'free' OR mrr = 0 OR mrr IS NULL 
        THEN user_id 
    END) AS free_users,
    COUNT(DISTINCT CASE 
        WHEN mrr > 0 AND mrr < 50 
        THEN user_id 
    END) AS selfserve_users,
    COUNT(DISTINCT CASE 
        WHEN last_active_date >= CURRENT_DATE - INTERVAL '90 days' 
        THEN user_id 
    END) AS active_last_90d,
    STRING_AGG(DISTINCT COALESCE(department, 'Unknown'), ', ') AS departments
FROM users
WHERE 
    -- Free OR self-serve (low MRR individual plans)
    (
        subscription_type = 'free' 
        OR mrr IS NULL 
        OR mrr = 0 
        OR (mrr > 0 AND mrr < 50)
    )
    -- Active in last 180 days
    AND last_active_date >= CURRENT_DATE - INTERVAL '180 days'
    -- Exclude undergraduates
    AND (role_category IS NULL OR role_category != 'undergraduate')
GROUP BY 
    email_domain
HAVING 
    COUNT(DISTINCT user_id) >= 1
ORDER BY 
    total_expansion_users DESC;
```

**Export this as CSV** → Save as `hex_free_users.csv`

---

## Query 2: Department-Level Breakdown

Use this to see which departments have free users (for targeted outreach).

```sql
-- Department-level breakdown for matching
SELECT
    SPLIT_PART(email, '@', 2) AS email_domain,
    COALESCE(department, 'Unknown') AS department,
    organization_name,
    COUNT(DISTINCT user_id) AS free_user_count,
    COUNT(DISTINCT CASE 
        WHEN last_active_date >= CURRENT_DATE - INTERVAL '90 days' 
        THEN user_id 
    END) AS active_last_90d
FROM users
WHERE 
    (subscription_type = 'free' OR mrr = 0 OR mrr IS NULL)
    AND last_active_date >= CURRENT_DATE - INTERVAL '180 days'
    AND (role_category IS NULL OR role_category != 'undergraduate')
GROUP BY 
    email_domain,
    department,
    organization_name
HAVING 
    COUNT(DISTINCT user_id) >= 1
ORDER BY 
    email_domain,
    free_user_count DESC;
```

---

## Query 3: Targeted Domain Lookup

When you want to check specific accounts, add their domains to this query.

```sql
-- Targeted lookup for specific domains
SELECT
    SPLIT_PART(email, '@', 2) AS email_domain,
    COALESCE(department, 'Unknown') AS department,
    COUNT(DISTINCT user_id) AS free_user_count,
    STRING_AGG(DISTINCT role_category, ', ') AS role_categories,
    MAX(last_active_date) AS most_recent_activity
FROM users
WHERE 
    (subscription_type = 'free' OR mrr = 0 OR mrr IS NULL)
    AND last_active_date >= CURRENT_DATE - INTERVAL '180 days'
    AND (role_category IS NULL OR role_category != 'undergraduate')
    -- ADD YOUR DOMAINS HERE
    AND SPLIT_PART(email, '@', 2) IN (
        'sdsu.edu',
        'usask.ca',
        'oregonstate.edu',
        'fsu.edu',
        'augusta.edu',
        'gsu.edu',
        'uef.fi',
        'lanl.gov'
        -- Add more as needed
    )
GROUP BY 
    email_domain,
    department
ORDER BY 
    email_domain,
    free_user_count DESC;
```

---

## Query 4: Top 50 Opportunities

Quick scan of highest-potential domains.

```sql
-- Top 50 domains by free user count
SELECT
    SPLIT_PART(email, '@', 2) AS email_domain,
    organization_name,
    COUNT(DISTINCT user_id) AS free_user_count,
    COUNT(DISTINCT CASE 
        WHEN last_active_date >= CURRENT_DATE - INTERVAL '30 days' 
        THEN user_id 
    END) AS active_last_30d,
    COUNT(DISTINCT department) AS unique_departments
FROM users
WHERE 
    (subscription_type = 'free' OR mrr = 0 OR mrr IS NULL)
    AND last_active_date >= CURRENT_DATE - INTERVAL '180 days'
    AND (role_category IS NULL OR role_category != 'undergraduate')
GROUP BY 
    email_domain,
    organization_name
HAVING 
    COUNT(DISTINCT user_id) >= 5
ORDER BY 
    free_user_count DESC
LIMIT 50;
```

---

## Common Domain Patterns

Use these patterns to match Hex results to your Salesforce accounts:

| Institution Type | Domain Pattern | Examples |
|-----------------|----------------|----------|
| US Universities | `.edu` | sdsu.edu, fsu.edu, oregonstate.edu |
| Canadian Universities | `.ca` | usask.ca |
| UK Institutions | `.ac.uk` | greenwich.ac.uk |
| German Institutions | `.de` | mh-hannover.de |
| Italian Institutions | `.it` | unipv.it |
| Czech Institutions | `.cz` | cas.cz |
| Research Institutes | `.org`, `.gov` | lanl.gov |

---

## Output Format

The main query (Query 1) should produce CSV with these columns:

| Column | Description |
|--------|-------------|
| email_domain | Domain to match with Salesforce |
| total_expansion_users | **This goes into the scoring model** |
| free_users | Breakdown: completely free |
| selfserve_users | Breakdown: paying individually |
| active_last_90d | Recency indicator |
| departments | Which departments have free users |

---

## Notes

1. **Adjust field names** to match your Hex schema (user_id, email, subscription_type, mrr, last_active_date, department, role_category)

2. **MRR threshold ($50)** - Adjust based on your actual self-serve plan pricing

3. **180-day window** - Can be adjusted if you want more/less recent users

4. **Undergraduate exclusion** - Remove this filter if your licenses include undergrads
