-- Simplified PostgreSQL schema for Canteen Pre-order app
-- Run this on a fresh database. This file avoids DO blocks and dynamic SQL.
-- Requires: PostgreSQL and the "pgcrypto" extension for UUIDs and bcrypt (crypt).

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE role AS ENUM ('ADMIN','USER');
CREATE TYPE order_status AS ENUM ('PENDING','FINISHED','CANCELLED');
CREATE TYPE payment_status AS ENUM ('PENDING','PAID');

-- Trigger helper: set updated_at on UPDATE
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Per-day sequence table for generating order numbers (YYYYMMDD-0001)
CREATE TABLE order_sequence (
  id serial PRIMARY KEY,
  date varchar(8) NOT NULL UNIQUE,
  last_number int NOT NULL DEFAULT 0
);

-- Function to generate next order number safely using INSERT...ON CONFLICT
CREATE OR REPLACE FUNCTION next_order_number()
RETURNS text AS $$
DECLARE
  today varchar(8) := to_char(now() at time zone 'UTC','YYYYMMDD');
  seq int;
BEGIN
  INSERT INTO order_sequence(date, last_number)
    VALUES (today, 1)
    ON CONFLICT (date) DO UPDATE SET last_number = order_sequence.last_number + 1
    RETURNING last_number INTO seq;
  RETURN today || '-' || lpad(seq::text,4,'0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  name varchar(255),
  phone varchar(50),
  password varchar(255) NOT NULL,
  role role NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Dishes
CREATE TABLE dishes (
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

CREATE INDEX idx_dishes_name ON dishes(name);

CREATE TRIGGER dishes_set_updated_at BEFORE UPDATE ON dishes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Orders
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT next_order_number(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pickup_time timestamptz NOT NULL,
  status order_status NOT NULL DEFAULT 'PENDING',
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  payment_method varchar(100),
  payment_date timestamptz,
  total_cents int NOT NULL CHECK (total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_pickup_time ON orders (pickup_time);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_created_at ON orders (created_at);

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Order items
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id uuid REFERENCES dishes(id),
  dish_name text NOT NULL,
  unit_price_cents int NOT NULL CHECK (unit_price_cents >= 0),
  quantity int NOT NULL CHECK (quantity > 0)
);

-- Canteen configuration (opening hours, timezone)
CREATE TABLE canteen_config (
  id serial PRIMARY KEY,
  open_minutes int NOT NULL DEFAULT 480,
  close_minutes int NOT NULL DEFAULT 1020,
  timezone varchar(64) DEFAULT 'UTC'
);

-- Example admin insert (commented out). Change password immediately in production.
-- INSERT INTO users (email, name, phone, password, role) VALUES (
--   'admin@example.com', 'Admin', '', crypt('ChangeMe123!', gen_salt('bf')), 'ADMIN'
-- );

-- End of simplified schema
