variable "instance_type" {
  description = "EC2 instance type for the dev box"
  type        = string
  default     = "t3.micro"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the dev box"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo allowed to assume the deploy role, in 'org/repo' format"
  type        = string
}

variable "ssh_public_key" {
  description = "Public key material for SSH access to the dev box"
  type        = string
}
