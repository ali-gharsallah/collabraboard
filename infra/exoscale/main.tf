# O-Live — Terraform Exoscale (runbook §1-§10 du canon « solde 4 écarts », 2026-07-29).
# PRÉPARÉ, JAMAIS APPLIQUÉ depuis une session Claude (interdit du canon) : l'acte humain
# est `terraform apply` avec des clés API PAR ENVIRONNEMENT (jamais la clé racine — §1).
terraform {
  required_providers { exoscale = { source = "exoscale/exoscale", version = ">= 0.59" } }
}

variable "zone"          { default = "ch-gva-2" }   # §2 : primaire Genève ; DR : ch-dk-1 (§10)
variable "zone_dr"       { default = "ch-dk-1" }
variable "ssh_cidr"      { description = "IP/bastion admin — JAMAIS 0.0.0.0/0 (§2)" }
variable "environnement" { default = "staging" }    # staging d'abord — prod après restauration TESTÉE (§4)

# ── §2 Réseau : un scan externe ne voit que 443 ──
resource "exoscale_security_group" "app" { name = "olive-${var.environnement}-app" }
resource "exoscale_security_group_rule" "https" {
  security_group_id = exoscale_security_group.app.id
  type = "INGRESS" protocol = "TCP" start_port = 443 end_port = 443 cidr = "0.0.0.0/0"
}
resource "exoscale_security_group_rule" "ssh" {
  security_group_id = exoscale_security_group.app.id
  type = "INGRESS" protocol = "TCP" start_port = 22 end_port = 22 cidr = var.ssh_cidr
}
resource "exoscale_security_group" "data" { name = "olive-${var.environnement}-data" }
# Postgres/Redis : JAMAIS publics — accès par le réseau privé uniquement (§2)
resource "exoscale_security_group_rule" "pg_prive" {
  security_group_id = exoscale_security_group.data.id
  type = "INGRESS" protocol = "TCP" start_port = 5432 end_port = 5432
  user_security_group_id = exoscale_security_group.app.id
}
resource "exoscale_security_group_rule" "redis_prive" {
  security_group_id = exoscale_security_group.data.id
  type = "INGRESS" protocol = "TCP" start_port = 6379 end_port = 6379
  user_security_group_id = exoscale_security_group.app.id
}
resource "exoscale_private_network" "prive" { zone = var.zone name = "olive-${var.environnement}-net" }

# ── §3 Compute : app / data (+ staging = même module, var.environnement) ──
data "exoscale_template" "ubuntu" { zone = var.zone name = "Linux Ubuntu 24.04 LTS 64-bit" }
resource "exoscale_compute_instance" "app" {
  zone = var.zone name = "olive-${var.environnement}-app" type = "standard.large"
  template_id = data.exoscale_template.ubuntu.id disk_size = 100
  security_group_ids = [exoscale_security_group.app.id]
  network_interface { network_id = exoscale_private_network.prive.id }
}
resource "exoscale_compute_instance" "data" {
  zone = var.zone name = "olive-${var.environnement}-data" type = "standard.extra-large"
  template_id = data.exoscale_template.ubuntu.id disk_size = 400
  security_group_ids = [exoscale_security_group.data.id]
  network_interface { network_id = exoscale_private_network.prive.id }
}

# ── §6 SOS : GED (versioning — cohérent R109-R115) + backups (§4 WAL + snapshots) ──
resource "exoscale_sos_bucket" "ged"     { zone = var.zone name = "olive-${var.environnement}-ged" }
resource "exoscale_sos_bucket" "backups" { zone = var.zone name = "olive-${var.environnement}-backups" }
resource "exoscale_sos_bucket" "dr"      { zone = var.zone_dr name = "olive-${var.environnement}-dr" }  # §10 cross-zone
