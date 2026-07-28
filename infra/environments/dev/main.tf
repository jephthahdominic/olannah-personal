terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "dev_ec2" {
  source = "../../modules/dev-ec2"

  instance_type    = var.instance_type
  allowed_ssh_cidr = var.allowed_ssh_cidr
  github_repo      = var.github_repo
  ssh_public_key   = var.ssh_public_key
}

output "instance_public_ip" {
  value = module.dev_ec2.instance_public_ip
}

output "frontend_ecr_repository_url" {
  value = module.dev_ec2.frontend_ecr_repository_url
}

output "backend_ecr_repository_url" {
  value = module.dev_ec2.backend_ecr_repository_url
}

output "github_deploy_role_arn" {
  value = module.dev_ec2.github_deploy_role_arn
}
