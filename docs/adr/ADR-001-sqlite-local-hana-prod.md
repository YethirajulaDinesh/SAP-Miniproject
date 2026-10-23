# ADR-001 Local SQLite, HANA Cloud production

Status: accepted

Domain logic is independent of SQL dialect. CAP SQLite (`@cap-js/sqlite` 3.x / Node 24 `node:sqlite`) is the development persistence. Production profile uses HANA Cloud via MTA. No S/4 application-table SQL.
