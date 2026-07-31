variable "instance_type" {
  description = "EC2 instance type for the dev box"
  type        = string
  default     = "t3.micro"
}

variable "github_repo" {
  description = "GitHub repo allowed to assume the deploy role, in 'org/repo' format"
  type        = string
}

variable "tailscale_auth_key" {
  description = "Tailscale auth key (tagged tag:dev-server) the dev box uses to join the tailnet at boot"
  type        = string
  sensitive   = true
}
