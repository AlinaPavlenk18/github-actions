# AWS: ECS service and static site

How `gha-ci-lab` runs on AWS (region `eu-central-1`) and why the network is set up this way.

## Overview

```
Internet ──HTTP 80──▶ ALB (sg-alb) ──3000──▶ ECS Fargate task (sg-task) ──443──▶ ECR / S3 / CloudWatch Logs
Internet ──HTTPS───▶ CloudFront ──OAC (SigV4)──▶ private S3 bucket
GitHub Actions ──OIDC──▶ IAM roles (no stored AWS keys)
```

## ECS resources

| Resource | Value |
|---|---|
| Cluster | `gha-ci-lab` (Fargate) |
| Service | `gha-ci-lab-svc`, desired count 1 |
| Task definition | family `gha-ci-lab` ([deploy/ecs/task-definition.json](../deploy/ecs/task-definition.json)) |
| Task size | 0.25 vCPU / 512 MiB, Linux x86_64 |
| Container | `app`, port 3000, image `<account>.dkr.ecr.eu-central-1.amazonaws.com/gha-ci-lab:sha-<short>` |
| Execution role | `gha-ci-lab-ecs-task-execution` (`AmazonECSTaskExecutionRolePolicy`: pull from ECR, write logs) |
| Logs | CloudWatch Logs `/ecs/gha-ci-lab`, retention 7 days |
| Deployment | rolling, min healthy 100 %, max 200 %, circuit breaker with automatic rollback |
| Hardening | read-only root filesystem, no task role (the app needs no AWS API access) |

## Networking

| Item | Value | Why |
|---|---|---|
| VPC | default VPC `vpc-0340281a1433b411c` | Lab scope; no custom VPC to maintain |
| Subnets | `subnet-0c792ff9769de18a7`, `subnet-012ba9602aed8e277`, `subnet-05a7edf94dec52564` (default public subnets, one per AZ) | ALB needs at least two AZs |
| Task public IP | enabled | Outbound access to ECR/S3/Logs without a NAT Gateway (cost). Inbound is still closed by the security group |
| Load balancer | ALB `gha-ci-lab-alb` (`gha-ci-lab-alb-1133079188.eu-central-1.elb.amazonaws.com`), internet-facing, HTTP 80 → target group `gha-ci-lab-tg` (target type `ip`, health check `/health`) | Stable public endpoint; tasks change IPs on every deploy |

Production alternative: tasks in private subnets with a NAT Gateway or VPC endpoints (ECR API, ECR DKR, S3 gateway, Logs), `assignPublicIp=DISABLED`, and HTTPS on the ALB with an ACM certificate.

## Security groups

| SG | Direction | Protocol / port | Source / destination | Reason |
|---|---|---|---|---|
| `gha-ci-lab-alb` `00d95935f013f899a` | inbound | TCP 80 | `0.0.0.0/0` | Public entry point |
| | outbound | TCP 3000 | `gha-ci-lab-ecs-task` (SG reference) | ALB may only talk to the app tasks |
| `gha-ci-lab-ecs-task` `sg-0121aab7be4a4c64c` | inbound | TCP 3000 | `gha-ci-lab-alb` (SG reference) | Only the ALB can reach the app; no direct internet access to tasks |
| | outbound | TCP 443 | `0.0.0.0/0` | Pull images from ECR/S3 and send logs to CloudWatch; nothing else |

Rules reference security groups instead of IP ranges, so they stay correct when tasks get new IPs.
The default "allow all outbound" rules were removed from both groups.

Verified: a direct request to the task's public IP on port 3000 times out, while the same request through the ALB succeeds.

## Static site

| Item | Value |
|---|---|
| Bucket | `gha-ci-lab-static-880561240946`, Block Public Access on, no website hosting |
| Access | CloudFront Origin Access Control; bucket policy allows `s3:GetObject` only for distribution `E242LEJIDQTRGS` |
| URL | `https://d1ievkc8oewvnc.cloudfront.net` (HTTPS only, HTTP → HTTPS redirect) |
| Caching | managed policy CachingOptimized; invalidation `/*` after each deploy |
| Headers | managed policy SecurityHeadersPolicy (HSTS, X-Frame-Options, X-Content-Type-Options, …) |

Verified: a direct request to the S3 object URL returns 403.

## GitHub Actions → AWS (OIDC)

| Role | Trusted subject (`token.actions.githubusercontent.com:sub`) | Permissions |
|---|---|---|
| `gha-ci-lab-ecr-push` | `repo:AlinaPavlenk18@157489770/github-actions@1305933681:ref:refs/heads/main` | Push to ECR repository `gha-ci-lab` only |
| `gha-ci-lab-ecs-deploy` | `…:environment:aws-production` (required reviewer) | Register task definitions, update service `gha-ci-lab-svc`, pass the execution role to ECS tasks |
| `gha-ci-lab-s3-static` | `…:environment:aws-static` | Write to the static bucket, invalidate the distribution |

No AWS access keys are stored in GitHub; role ARNs are repository/environment variables.