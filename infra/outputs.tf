output "nameservers" {
  description = "Set these as the custom nameservers for the domain at Squarespace."
  value       = aws_route53_zone.primary.name_servers
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket hosting the site (set as GitHub Actions variable S3_BUCKET)."
  value       = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (set as GitHub Actions variable CF_DISTRIBUTION_ID)."
  value       = aws_cloudfront_distribution.site.id
}

output "deploy_role_arn" {
  description = "IAM role ARN GitHub Actions assumes via OIDC (set as variable AWS_DEPLOY_ROLE_ARN)."
  value       = aws_iam_role.github_deploy.arn
}

output "aws_region" {
  description = "AWS region used (set as GitHub Actions variable AWS_REGION)."
  value       = var.aws_region
}
