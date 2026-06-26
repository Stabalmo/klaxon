# terraform/ — multi-region Aurora DSQL (IaC)

Provisions Klaxon's multi-region backbone: **two peered Aurora DSQL clusters**
(one endpoint per region) presenting a single, strongly-consistent logical
database, plus a **witness region** for quorum.

```
eu-central-1 (primary, Frankfurt) ─┐
                                   ├─ one logical DB · strong consistency · active-active
eu-west-1 (secondary, Ireland) ────┘     witness: eu-west-2 London (no endpoint)
```

This folder lives in the same GitHub repo as the app. It is managed by
**HCP Terraform (terraform.io)** with the **VCS-driven workflow** and a
**working directory of `terraform/`** — so a push that touches this folder
triggers `plan` / `apply`, while app-only pushes don't.

## One-time setup

1. **HCP Terraform** (https://app.terraform.io):
   - Create / pick an organization.
   - **New workspace → Version Control Workflow → GitHub**, connect
     `Stabalmo/klaxon`.
   - **Workspace settings → General → Terraform Working Directory:** `terraform/`
   - **Automatic Run Triggering → Only trigger runs when files in
     specified paths change:** add `terraform/` (so app commits don't run TF).

2. **AWS credentials** — workspace **Variables → Environment variables**
   (mark sensitive):
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

   IAM principal needs DSQL admin perms (`dsql:CreateCluster`,
   `dsql:UpdateCluster`, `dsql:GetCluster`, `dsql:TagResource`,
   `dsql:DeleteCluster`).

3. *(optional)* Override regions via **Terraform variables**
   (`primary_region` / `secondary_region` / `witness_region`).

4. *(optional)* Enable **Auto-apply** so a push deploys without a manual confirm.

## The GitHub "deploy" indicator

With the VCS connection, HCP Terraform posts a **commit status check** to GitHub
— a ✓ / ✗ icon on each commit and pull request showing the run result (sits next
to Vercel's deploy check). Optional README badge:

```md
[![Terraform](https://img.shields.io/badge/HCP%20Terraform-managed-7B42BC?logo=terraform)](https://app.terraform.io/app/<ORG>/workspaces/<WORKSPACE>)
```

> Note: Vercel rebuilds the app on any push to `main`. To skip app builds on
> terraform-only commits, set a Vercel **Ignored Build Step** that exits 0 when
> only `terraform/` changed.

## After apply — hand these to the app side

From TFC → workspace → **Outputs**:

| Output | Use |
|---|---|
| `primary_endpoint` | `PGHOST` for region A |
| `secondary_endpoint` | `PGHOST` for region B |
| `primary_arn` / `secondary_arn` | the app's IAM `dsql:DbConnect` policy |

Then: schema is applied once (shared logical DB), the app gets a region-aware
connection + region indicator, and the cross-region consistency demo (write
region A → read region B) is wired up.

## Cost & teardown

Two clusters + a witness incur small real AWS spend. Tear down with a **Destroy**
run in HCP Terraform. `deletion_protection` is already off.
