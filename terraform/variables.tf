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
