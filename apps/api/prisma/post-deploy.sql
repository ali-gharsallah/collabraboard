-- RLS : isolation tenant au niveau moteur (defense-in-depth, en plus du filtrage applicatif)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clients USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON kyc_files USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON documents USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON domain_events USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- R84 : verrous d'édition — isolation tenant (kyc_lock_requests hérite via son lock)
ALTER TABLE kyc_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_lock_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kyc_locks USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON kyc_lock_requests USING (
  lock_id IN (SELECT id FROM kyc_locks WHERE tenant_id = current_setting('app.tenant_id')::uuid));

-- Immuabilité : audit et change tracker append-only
CREATE OR REPLACE FUNCTION audit_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER qh_no_mutate BEFORE UPDATE OR DELETE ON kyc_question_history
  FOR EACH ROW EXECUTE FUNCTION audit_immutable();
CREATE TRIGGER audit_no_mutate BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_immutable();
