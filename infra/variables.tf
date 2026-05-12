variable "domain_name" {
  description = "Apex domain for the site."
  type        = string
  default     = "welcomebacktosod.com"
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the deploy role (org/repo)."
  type        = string
  default     = "Lornath/WelcomeBackToSod"
}

variable "github_environment" {
  description = "GitHub Actions environment name permitted to deploy. The deploy job sets `environment: <name>` and GitHub's OIDC token rewrites `sub` to `repo:<repo>:environment:<name>`."
  type        = string
  default     = "Deploy"
}

variable "aws_region" {
  description = "Primary AWS region for S3. Defaults to us-east-1 to co-locate with the ACM cert (which CloudFront requires there)."
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default = {
    Project   = "welcomebacktosod"
    ManagedBy = "terraform"
  }
}
