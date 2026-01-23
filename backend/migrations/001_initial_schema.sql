CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  permissions_json JSONB NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  employment_status VARCHAR(20) DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(10) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  old_value_json JSONB,
  new_value_json JSONB,
  ip_address VARCHAR(45)
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_users_role ON users(role_id);

INSERT INTO roles (role_name, permissions_json) VALUES
('Admin', '{"all": true}'),
('Manager', '{"performance": "team", "pips": "team"}'),
('Employee', '{"performance": "self", "leave": "self"}'),
('Compliance Officer', '{"read_all": true}'),
('Whistleblowing Officer', '{"whistleblowing": true}');