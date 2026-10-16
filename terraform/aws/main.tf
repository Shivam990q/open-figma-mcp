# Enterprise Terraform / OpenTofu Module: AWS ECS Fargate for OpenFigma MCP
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Target deployment environment"
}

variable "figma_api_key_secret_arn" {
  type        = string
  description = "AWS Secrets Manager ARN holding FIGMA_API_KEY"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where ECS Fargate tasks run"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for Fargate tasks"
}

resource "aws_ecs_cluster" "open_figma" {
  name = "open-figma-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "open_figma" {
  family                   = "open-figma-mcp"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "open-figma-mcp"
      image     = "ghcr.io/shivam990q/open-figma-mcp:2.0.0"
      essential = true
      portMappings = [
        {
          containerPort = 3845
          hostPort      = 3845
          protocol      = "tcp"
        }
      ]
      secrets = [
        {
          name      = "FIGMA_API_KEY"
          valueFrom = var.figma_api_key_secret_arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/open-figma-${var.environment}"
          awslogs-region        = "us-east-1"
          awslogs-stream-prefix = "mcp"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3845/healthz || exit 1"]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])
}

resource "aws_iam_role" "ecs_execution" {
  name = "open-figma-ecs-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "open-figma-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}
