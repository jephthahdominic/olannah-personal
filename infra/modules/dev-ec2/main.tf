data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  ecr_registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_security_group" "dev" {
  name_prefix = "dev-app-"
  description = "Dev box: SSH, frontend, backend"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "Frontend"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Backend"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_key_pair" "dev" {
  key_name_prefix = "dev-app-"
  public_key      = var.ssh_public_key
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2_ecr_pull" {
  name               = "dev-app-ec2-ecr-pull"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ec2_ecr_pull" {
  role       = aws_iam_role.ec2_ecr_pull.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "ec2_ecr_pull" {
  name = "dev-app-ec2-ecr-pull"
  role = aws_iam_role.ec2_ecr_pull.name
}

resource "aws_instance" "dev" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.dev.key_name
  vpc_security_group_ids = [aws_security_group.dev.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_ecr_pull.name

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    dnf install -y docker
    systemctl enable --now docker
    usermod -aG docker ec2-user

    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    curl -SL https://amazon-ecr-credential-helper-releases.s3.us-east-1.amazonaws.com/0.7.1/linux-amd64/docker-credential-ecr-login -o /usr/local/bin/docker-credential-ecr-login
    chmod +x /usr/local/bin/docker-credential-ecr-login

    mkdir -p /home/ec2-user/.docker
    cat > /home/ec2-user/.docker/config.json <<'DOCKERCFG'
    {"credHelpers": {"${local.ecr_registry}": "ecr-login"}}
    DOCKERCFG
    chown -R ec2-user:ec2-user /home/ec2-user/.docker

    mkdir -p /home/ec2-user/app
    chown ec2-user:ec2-user /home/ec2-user/app
  EOF

  tags = {
    Name = "dev-app"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "app-frontend"
  image_tag_mutability = "MUTABLE"
}

resource "aws_ecr_repository" "backend" {
  name                 = "app-backend"
  image_tag_mutability = "MUTABLE"
}
