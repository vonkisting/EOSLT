# PoolHub database schema (expected by this app)

This document describes the table and column names the app uses when querying `POOLHUB_DATABASE_URL`. If your database uses different names, update the queries in `lib/poolhub-queries.ts` to match.

---

## Tables and columns the app expects

### **Venues**

| Column | Type   | Notes                                      |
|--------|--------|--------------------------------------------|
| Name   | string | Venue name; used for location dropdowns    |

**Query:** `SELECT DISTINCT Name FROM Venues ORDER BY Name`

---

### **Leagues** (table name is plural in code)

| Column       | Type   | Notes                    |
|-------------|--------|---------------------------|
| Name        | string | League name; used for League dropdown and to filter seasons |
| Season      | string | Season value; distinct values per Name populate the Season dropdown |
| LeagueGUID  | string | GUID for the league/season row; used to query Players |

**Queries:**
- League names: `SELECT DISTINCT Name FROM Leagues ORDER BY Name`
- Seasons for a league: `SELECT DISTINCT Season FROM Leagues WHERE Name = @p1 ORDER BY Season`
- League GUID: `SELECT TOP 1 LeagueGUID FROM Leagues WHERE Name = @p1 AND Season = @p2`

---

### **Season**

| Column       | Type   | Notes                              |
|-------------|--------|-------------------------------------|
| SeasonGUID  | string | Primary key / unique id            |
| LeagueGUID  | string | Foreign key to Leagues.LeagueGUID  |
| SeasonName  | string | Display name in dropdown            |

**Query:** `SELECT SeasonGUID, LeagueGUID, SeasonName FROM Season WHERE LeagueGUID = @p1 ORDER BY SeasonName`

---

### **Players**

| Column     | Type           | Notes                              |
|------------|----------------|-------------------------------------|
| LeagueGUID | string         | Filter by selected league (from Leagues row) |
| FirstName  | string         | Player first name                  |
| LastName   | string         | Player last name (display: "FirstName LastName") |
| Weeks      | number or null | Optional                           |
| LegacyAve  | number or null | Optional                           |
| RaceTo     | number or null | Optional                           |

**Query:** `SELECT FirstName, LastName, Weeks, LegacyAve, RaceTo FROM Players WHERE LeagueGUID = @p1 ORDER BY LastName, FirstName`

---

### **OverallPlayerStats**

| Column       | Type   | Notes                              |
|-------------|--------|-------------------------------------|
| LeagueGUID  | string | Filter: WHERE LeagueGUID = selected league GUID |
| (others)   |        | All columns returned via SELECT *; shown in League & Season card under the GUID |

**Query:** `SELECT * FROM OverallPlayerStats WHERE LeagueGUID = @p1`

---

## How to get the real schema from your database

Run these in your SQL Server client (e.g. SSMS, Azure Data Studio) against the PoolHub database to list tables and columns.

**List all tables:**

```sql
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
```

**List columns for a table (replace `Leagues` with your table name):**

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Leagues'
ORDER BY ORDINAL_POSITION;
```

**One-shot: all columns for all user tables:**

```sql
SELECT t.TABLE_SCHEMA, t.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE
FROM INFORMATION_SCHEMA.TABLES t
JOIN INFORMATION_SCHEMA.COLUMNS c ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
WHERE t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION;
```

If your tables use different names (e.g. `League` instead of `Leagues`, or `Name` instead of `LeagueName`), update the SQL and TypeScript types in `lib/poolhub-queries.ts` to match.
