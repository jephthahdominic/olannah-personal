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
  description = "Dev box: outbound only, all access via Tailscale"

  ingress = []

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
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

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_ecr_pull.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_ecr_pull" {
  name = "dev-app-ec2-ecr-pull"
  role = aws_iam_role.ec2_ecr_pull.name
}

resource "aws_instance" "dev" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.dev.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_ecr_pull.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail
    dnf install -y docker
    systemctl enable --now docker
    usermod -aG docker ec2-user

    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    curl -fSL https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/0.7.1/linux-amd64/docker-credential-ecr-login -o /usr/local/bin/docker-credential-ecr-login
    chmod +x /usr/local/bin/docker-credential-ecr-login

    mkdir -p /home/ec2-user/.docker
    cat > /home/ec2-user/.docker/config.json <<'DOCKERCFG'
    {"credHelpers": {"${local.ecr_registry}": "ecr-login"}}
    DOCKERCFG
    chown -R ec2-user:ec2-user /home/ec2-user/.docker

    mkdir -p /home/ec2-user/app
    chown ec2-user:ec2-user /home/ec2-user/app

    curl -fsSL https://pkgs.tailscale.com/stable/amazon-linux/2023/tailscale.repo -o /etc/yum.repos.d/tailscale.repo
    dnf install -y tailscale
    systemctl enable --now tailscaled
    tailscale up --authkey="${var.tailscale_auth_key}" --ssh --hostname=olannah-dev --accept-dns=false
  EOF

  tags = {
    Name = "olannah-dev"
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
