# Klaxon

On-call incident management that survives the outage it is paging you about.

Built for the H0 Hackathon — Vercel v0 + AWS Databases: https://h01.devpost.com
Live app: https://v0-klaxon.vercel.app/

## Overview

Klaxon turns alerts into incidents, pages the on-call engineer, and escalates
if no one responds. It runs on Amazon Aurora DSQL and is built around two
correctness properties:

- Survives a region outage. The database is multi-region active-active
  (Frankfurt and Ireland, with a London witness). A region can go offline and
  Klaxon keeps paging through the surviving region.
- Acknowledgement and escalation never race. Both can touch the same incident
  at the same instant; DSQL strong consistency and optimistic concurrency
  guarantee exactly one outcome — no double-page, no dropped alert.

## How it works

A monitoring tool (Grafana, Prometheus Alertmanager, or a generic JSON webhook)
POSTs to the ingest endpoint. Klaxon normalizes it into an incident, assigns the
on-call engineer, and pages them over Telegram with inline Acknowledge and
Resolve actions. An escalation engine advances unanswered incidents to the next
responder. Every incident mutation is idempotent and retried on
optimistic-concurrency conflicts.

The app authenticates to Aurora DSQL through Vercel OIDC federation with
short-lived IAM tokens; there are no database passwords.

## Stack

- Next.js (App Router), deployed on Vercel
- Amazon Aurora DSQL, multi-region
- Vercel OIDC for passwordless IAM authentication
- Telegram bot for paging
- Terraform (HCP Terraform) for the multi-region clusters
