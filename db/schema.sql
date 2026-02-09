-- Create database (run once)
CREATE DATABASE IF NOT EXISTS medicine_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE medicine_app;

-- Orders are created as 'draft' from the order page and become 'confirmed'
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code VARCHAR(32) NOT NULL,
  order_date DATE NOT NULL,
  doctor_name VARCHAR(255) NOT NULL,
  patient_name VARCHAR(255) NOT NULL,
  hn VARCHAR(64) NOT NULL,
  boiling_methods_json JSON NOT NULL,
  status ENUM('draft','confirmed') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_code (order_code),
  KEY idx_orders_status_created (status, created_at),
  KEY idx_orders_date (order_date),
  KEY idx_orders_hn (hn)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  medicine_weight DECIMAL(12,2) NOT NULL,
  medicine_unit VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
