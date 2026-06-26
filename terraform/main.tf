terraform {
  required_version = ">= 1.5"

  # State + runs are managed by HCP Terraform (terraform.io) via the
  # VCS-driven workflow. The workspace is wired to this GitHub repo with
  # working directory "terraform/", so runs trigger only on changes here.
  # No backend block is needed.

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # DSQL multi-region (aws_dsql_cluster_peering) needs a recent provider.
      version = ">= 5.90"
    }
  }
}

# Two peered regions form ONE logical, strongly-consistent database.
# AWS credentials come from the TFC workspace env vars
# (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
provider "aws" {
  region = var.primary_region
}

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

# --- Peered clusters (one endpoint each, same logical DB) -------------------

resource "aws_dsql_cluster" "primary" {
  deletion_protection_enabled = false

  multi_region_properties {
    witness_region = var.witness_region
  }

  tags = {
    Name            = "${var.project_name}-primary"
    Project         = var.project_name
    VercelInstallId = var.vercel_install_id
  }
}

resource "aws_dsql_cluster" "secondary" {
  provider                    = aws.secondary
  deletion_protection_enabled = false

  multi_region_properties {
    witness_region = var.witness_region
  }

  tags = {
    Name            = "${var.project_name}-secondary"
    Project         = var.project_name
    VercelInstallId = var.vercel_install_id
  }
}

# --- Mutual peering (resolves the circular A <-> B reference) ---------------

resource "aws_dsql_cluster_peering" "primary" {
  identifier     = aws_dsql_cluster.primary.identifier
  clusters       = [aws_dsql_cluster.secondary.arn]
  witness_region = var.witness_region
}

resource "aws_dsql_cluster_peering" "secondary" {
  provider       = aws.secondary
  identifier     = aws_dsql_cluster.secondary.identifier
  clusters       = [aws_dsql_cluster.primary.arn]
  witness_region = var.witness_region
}
