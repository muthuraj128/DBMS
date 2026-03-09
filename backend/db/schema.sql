-- PostgreSQL DDL: normalized schema for Canteen Pre-order app
-- Requires: PostgreSQL with "pgcrypto" extension for UUID and bcrypt

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Trigger helper: set updated_at on UPDATE
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('ADMIN','USER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('PENDING','FINISHED','CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('PENDING','PAID');
  END IF;
END$$;

-- Per-day sequence table for generating order numbers (YYYYMMDD-0001)
CREATE TABLE IF NOT EXISTS order_sequence (
  id serial PRIMARY KEY,
  date varchar(8) NOT NULL UNIQUE,
  last_number int NOT NULL DEFAULT 0
);

-- Function to generate next order number safely under concurrency
CREATE OR REPLACE FUNCTION next_order_number()
RETURNS text AS $$
DECLARE
  today varchar(8) := to_char(now() at time zone 'UTC','YYYYMMDD');
  seq int;
BEGIN
  LOOP
    UPDATE order_sequence SET last_number = last_number + 1 WHERE date = today RETURNING last_number INTO seq;
    IF FOUND THEN
      RETURN today || '-' || lpad(seq::text,4,'0');
    END IF;
    -- row for today doesn't exist, try inserting it
    BEGIN
      INSERT INTO order_sequence(date,last_number) VALUES (today,1);
      RETURN today || '-0001';
    EXCEPTION WHEN unique_violation THEN
      -- concurrent insert, retry loop
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  name varchar(255),
  phone varchar(50),
  password varchar(255) NOT NULL,
  role role NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Ensure a password column exists (handles pre-existing tables that lack it or use a different name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('password','password_hash')
  ) THEN
    ALTER TABLE users ADD COLUMN password varchar(255) NOT NULL DEFAULT '';
  END IF;
END$$;

-- Dishes
CREATE TABLE IF NOT EXISTS dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  description text,
  price_cents int NOT NULL CHECK (price_cents >= 0),
  available_quantity int NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  available_from_minutes int NOT NULL CHECK (available_from_minutes >= 0 AND available_from_minutes <= 1439),
  available_to_minutes int NOT NULL CHECK (available_to_minutes >= 0 AND available_to_minutes <= 1439),
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_availability_range CHECK (available_from_minutes < available_to_minutes)
);
CREATE INDEX IF NOT EXISTS idx_dishes_name ON dishes(name);
DROP TRIGGER IF EXISTS dishes_set_updated_at ON dishes;
CREATE TRIGGER dishes_set_updated_at BEFORE UPDATE ON dishes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Orders (order_number uses next_order_number())
-- Create orders table with `user_id` column type matching existing users.id type
DO $$
DECLARE
  users_exists boolean;
  users_id_udt text;
  user_id_col_type text;
BEGIN
  -- Determine if users table exists in public schema
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO users_exists;

  IF users_exists THEN
    SELECT udt_name INTO users_id_udt
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    LIMIT 1;

    IF users_id_udt = 'uuid' THEN
      user_id_col_type := 'uuid';
    ELSIF users_id_udt IN ('int2','int4','int8') THEN
      -- Map integer types to integer for FK
      user_id_col_type := 'integer';
    ELSE
      RAISE NOTICE 'Unexpected users.id type %, defaulting to uuid', users_id_udt;
      user_id_col_type := 'uuid';
    END IF;
  ELSE
    -- If users table does not exist, default to uuid (users table is created earlier in this script)
    user_id_col_type := 'uuid';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    EXECUTE format('CREATE TABLE orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number text NOT NULL UNIQUE,
      user_id %s NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      pickup_time timestamptz NOT NULL,
      status order_status NOT NULL DEFAULT ''PENDING'',
      payment_status payment_status NOT NULL DEFAULT ''PENDING'',
      payment_method varchar(100),
      payment_date timestamptz,
      total_cents int NOT NULL CHECK (total_cents >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )', user_id_col_type);

    -- set default for order_number using next_order_number()
    EXECUTE 'ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT next_order_number();';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_pickup_time ON orders (pickup_time);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);';
    EXECUTE 'CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();';
  END IF;
END$$;

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id uuid REFERENCES dishes(id),
  dish_name text NOT NULL,
  unit_price_cents int NOT NULL CHECK (unit_price_cents >= 0),
  quantity int NOT NULL CHECK (quantity > 0)
);

-- Canteen configuration (opening hours, timezone)
CREATE TABLE IF NOT EXISTS canteen_config (
  id serial PRIMARY KEY,
  open_minutes int NOT NULL DEFAULT 480,
  close_minutes int NOT NULL DEFAULT 1020,
  timezone varchar(64) DEFAULT 'UTC'
);

-- Admin creation helper: create or update an admin user
-- This function hashes the provided plaintext password using bcrypt (pgcrypto's crypt()).
CREATE OR REPLACE FUNCTION create_admin_user(p_email text, p_name text, p_phone text, p_password text)
RETURNS void AS $$
DECLARE
  has_name boolean;
  has_phone boolean;
  has_updated_at boolean;
  pwd_col text;           -- actual password column name (password or password_hash)
  role_val text;           -- correct admin role literal for this table
  role_udt text;
  constraint_def text;
  sql text;
  email_param text;
BEGIN
  -- detect which optional columns exist on users table
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='name') INTO has_name;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='phone') INTO has_phone;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='updated_at') INTO has_updated_at;

  -- detect password column name (password_hash takes precedence if both exist)
  SELECT column_name INTO pwd_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users' AND column_name IN ('password_hash','password')
  ORDER BY column_name DESC  -- password_hash > password alphabetically
  LIMIT 1;
  IF pwd_col IS NULL THEN
    RAISE EXCEPTION 'users table has no password or password_hash column';
  END IF;

  -- detect the correct admin role value
  SELECT udt_name INTO role_udt
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users' AND column_name='role';

  IF role_udt = 'role' THEN
    -- custom enum type created by this script uses uppercase
    role_val := 'ADMIN';
  ELSE
    -- varchar/text column – inspect CHECK constraint for expected casing
    SELECT pg_get_constraintdef(c.oid) INTO constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' AND t.relname = 'users' AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
    LIMIT 1;

    IF constraint_def LIKE '%''admin''%' THEN
      role_val := 'admin';
    ELSIF constraint_def LIKE '%''Admin''%' THEN
      role_val := 'Admin';
    ELSE
      role_val := 'ADMIN';
    END IF;
  END IF;

  -- pre-compute the email parameter position (always the last positional param)
  IF has_name AND has_phone THEN email_param := '$4';
  ELSIF has_name OR has_phone THEN email_param := '$3';
  ELSE email_param := '$2';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    -- build dynamic UPDATE depending on available columns
    sql := 'UPDATE users SET ' || pwd_col || ' = crypt($1, gen_salt(''bf''))';
    IF has_name THEN
      sql := sql || ', name = $2';
    END IF;
    IF has_phone THEN
      sql := sql || ', phone = ' || (CASE WHEN has_name THEN '$3' ELSE '$2' END);
    END IF;
    sql := sql || ', role = ' || quote_literal(role_val);
    IF has_updated_at THEN
      sql := sql || ', updated_at = now()';
    END IF;
    sql := sql || ' WHERE email = ' || email_param;

    IF has_name AND has_phone THEN
      EXECUTE sql USING p_password, p_name, p_phone, p_email;
    ELSIF has_name AND NOT has_phone THEN
      EXECUTE sql USING p_password, p_name, p_email;
    ELSIF NOT has_name AND has_phone THEN
      EXECUTE sql USING p_password, p_phone, p_email;
    ELSE
      EXECUTE sql USING p_password, p_email;
    END IF;

  ELSE
    -- build dynamic INSERT depending on available columns
    sql := 'INSERT INTO users (email';
    IF has_name THEN sql := sql || ', name'; END IF;
    IF has_phone THEN sql := sql || ', phone'; END IF;
    sql := sql || ', ' || pwd_col || ', role) VALUES ($1';
    IF has_name THEN sql := sql || ', $2'; END IF;
    IF has_phone THEN sql := sql || ', ' || (CASE WHEN has_name THEN '$3' ELSE '$2' END); END IF;
    sql := sql || ', crypt(' || (CASE WHEN has_name AND has_phone THEN '$4' WHEN (has_name OR has_phone) THEN '$3' ELSE '$2' END) || ', gen_salt(''bf'')), ' || quote_literal(role_val) || ')';

    IF has_name AND has_phone THEN
      EXECUTE sql USING p_email, p_name, p_phone, p_password;
    ELSIF has_name AND NOT has_phone THEN
      EXECUTE sql USING p_email, p_name, p_password;
    ELSIF NOT has_name AND has_phone THEN
      EXECUTE sql USING p_email, p_phone, p_password;
    ELSE
      EXECUTE sql USING p_email, p_password;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Example usage (run manually or from your DB tool):
-- SELECT create_admin_user('admin@example.com', 'Admin', '', 'ChangeMe123!');
-- NOTE: change the password immediately after first login, and do not leave default credentials in production.

-- Notes:
--  - Application code should perform order creation inside a transaction that:
--      * checks dish availability and conditionally decrements available_quantity
--      * creates the order and order_items
--      * relies on next_order_number() for a per-day unique order_number
--  - All timestamps are stored as timestamptz (UTC); convert in frontend as needed.
