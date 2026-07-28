output "instance_public_ip" {
  value = aws_instance.dev.public_ip
}

output "frontend_ecr_repository_url" {
  value = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
