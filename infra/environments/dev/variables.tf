variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "github_repo" {
  description = "org/repo of the GitHub repository, e.g. olannah/olannah"
  type        = string
}

variable "tailscale_auth_key" {
  description = "Tailscale auth key (tagged tag:dev-server) for the dev box to join the tailnet"
  type        = string
  sensitive   = true
}
