CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  title TEXT,
  description TEXT NOT NULL,
  annual_income_min INTEGER,
  annual_income_max INTEGER,
  annual_income_raw TEXT,
  required_skills TEXT,
  preferred_skills TEXT,
  notes TEXT,
  source_url TEXT UNIQUE,
  crawled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL
);

CREATE TABLE job_skills (
  job_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  skill_type TEXT NOT NULL CHECK (skill_type IN ('required', 'preferred')),
  PRIMARY KEY (job_id, skill_id, skill_type),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_crawled_at ON jobs(crawled_at);
CREATE INDEX idx_job_skills_skill_type ON job_skills(skill_type);
