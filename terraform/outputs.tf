# Two regional endpoints for the one logical database.
output "primary_endpoint" {
  value = "${aws_dsql_cluster.primary.identifier}.dsql.${var.primary_region}.on.aws"
}

output "secondary_endpoint" {
  value = "${aws_dsql_cluster.secondary.identifier}.dsql.${var.secondary_region}.on.aws"
}

output "primary_arn" {
  value = aws_dsql_cluster.primary.arn
}

output "secondary_arn" {
  value = aws_dsql_cluster.secondary.arn
}

output "regions" {
  value = {
    primary   = var.primary_region
    secondary = var.secondary_region
    witness   = var.witness_region
  }
}
