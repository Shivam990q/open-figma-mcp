# Enterprise Terraform / OpenTofu Module: GCP Cloud Run v2 for OpenFigma MCP
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "GCP Region for Cloud Run"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Target deployment environment"
}

resource "google_cloud_run_v2_service" "open_figma" {
  name     = "open-figma-mcp-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }

    containers {
      image = "ghcr.io/shivam990q/open-figma-mcp:2.0.0"
      ports {
        container_port = 3845
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      env {
        name = "FIGMA_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "figma-api-key"
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 3845
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 3845
        }
        period_seconds = 10
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}
