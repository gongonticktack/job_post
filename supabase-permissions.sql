GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON companies TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON jobs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON skills TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON job_skills TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow anon read companies" ON companies;
DROP POLICY IF EXISTS "allow anon write companies" ON companies;
DROP POLICY IF EXISTS "allow anon update companies" ON companies;
DROP POLICY IF EXISTS "allow anon read jobs" ON jobs;
DROP POLICY IF EXISTS "allow anon write jobs" ON jobs;
DROP POLICY IF EXISTS "allow anon update jobs" ON jobs;
DROP POLICY IF EXISTS "allow anon read skills" ON skills;
DROP POLICY IF EXISTS "allow anon write skills" ON skills;
DROP POLICY IF EXISTS "allow anon update skills" ON skills;
DROP POLICY IF EXISTS "allow anon read job_skills" ON job_skills;
DROP POLICY IF EXISTS "allow anon write job_skills" ON job_skills;
DROP POLICY IF EXISTS "allow anon update job_skills" ON job_skills;

CREATE POLICY "allow anon read companies"
ON companies FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "allow anon write companies"
ON companies FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "allow anon update companies"
ON companies FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "allow anon read jobs"
ON jobs FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "allow anon write jobs"
ON jobs FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "allow anon update jobs"
ON jobs FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "allow anon read skills"
ON skills FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "allow anon write skills"
ON skills FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "allow anon update skills"
ON skills FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "allow anon read job_skills"
ON job_skills FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "allow anon write job_skills"
ON job_skills FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "allow anon update job_skills"
ON job_skills FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);
