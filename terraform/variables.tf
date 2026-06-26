variable "project_name" {
  type    = string
  default = "klaxon"
}

# Peered regions must stay within ONE DSQL geography. EU set:
#   eu-central-1 (Frankfurt), eu-west-1 (Ireland),
#   eu-west-2 (London),       eu-west-3 (Paris).
# No cross-continent clusters.
variable "primary_region" {
  type    = string
  default = "eu-central-1" # Frankfurt — matches the current cluster
}

variable "secondary_region" {
  type    = string
  default = "eu-west-1" # Ireland
}

# Witness holds a transaction-log quorum; it has NO endpoint and must
# differ from BOTH cluster regions.
variable "witness_region" {
  type    = string
  default = "eu-west-2" # London
}

# The Vercel-managed IAM permission boundary on the app role only allows DSQL
# connect to clusters whose VercelInstallId tag matches the role's principal
# tag (ABAC). Tagging our Terraform clusters with this value lets the existing
# app role reach them with no boundary edit. Override in the TFC workspace if
# you'd rather not keep it in the repo.
variable "vercel_install_id" {
  type    = string
  default = "icfg_lXZYcYdkdbji09kXYD8gUJrZ"
}
