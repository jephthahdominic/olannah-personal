variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "allowed_ssh_cidr" {
  description = "Your IP address in CIDR form, e.g. 203.0.113.4/32"
  type        = string
}

variable "github_repo" {
  description = "org/repo of the GitHub repository, e.g. kibek96/my-app"
  type        = string
}

variable "ssh_public_key" {
  description = "Contents of the deploy SSH public key"
  type        = string
}
