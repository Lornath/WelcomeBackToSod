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

variable "github_branch" {
  description = "Branch in the GitHub repo permitted to deploy."
  type        = string
  default     = "main"
}

variable "aws_region" {
  description = "Primary AWS region for S3 and Route 53 records."
  type        = string
  default     = "us-east-2"
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default = {
    Project   = "welcomebacktosod"
    ManagedBy = "terraform"
  }
}
