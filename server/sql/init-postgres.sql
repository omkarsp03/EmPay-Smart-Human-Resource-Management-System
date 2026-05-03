-- EmPay local PostgreSQL bootstrap
-- Usage:
--   psql -U postgres -f server/sql/init-postgres.sql
--
-- Optional overrides (before running psql):
--   export EMPAY_DB_USER=empay_user
--   export EMPAY_DB_PASSWORD=empay_pass
--   export EMPAY_DB_NAME=empay

\set ON_ERROR_STOP on
\else
\set EMPAY_DB_USER empay_user
\endif

\if :{?EMPAY_DB_PASSWORD}
\else
\set EMPAY_DB_PASSWORD empay_pass
\endif

\if :{?EMPAY_DB_NAME}
\else
\set EMPAY_DB_NAME empay
\endif

-- Create role if missing
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'EMPAY_DB_USER', :'EMPAY_DB_PASSWORD')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles
  WHERE rolname = :'EMPAY_DB_USER'
)\gexec

-- Create database if missing
SELECT format('CREATE DATABASE %I OWNER %I', :'EMPAY_DB_NAME', :'EMPAY_DB_USER')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = :'EMPAY_DB_NAME'
)\gexec

GRANT ALL PRIVILEGES ON DATABASE :EMPAY_DB_NAME TO :EMPAY_DB_USER;

\connect :EMPAY_DB_NAME

-- Ensure schema and privileges in target DB
CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION CURRENT_USER;
GRANT USAGE ON SCHEMA public TO :EMPAY_DB_USER;
GRANT CREATE ON SCHEMA public TO :EMPAY_DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :EMPAY_DB_USER;
