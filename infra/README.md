# Healthy AWS Infrastructure

This directory contains the Infrastructure as Code (IaC) for deploying the Healthy backend to AWS.

## Architecture

The backend uses a serverless architecture:
- **DynamoDB**: Stores user profiles (`HealthyProfiles` table).
- **S3**: Stores user avatars (`Healthy-avatars-{random_suffix}`).
- **Lambda**: Handles API requests (e.g., Profile API).
- **API Gateway**: Exposes Lambda functions as HTTP endpoints.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) installed.
- AWS CLI configured with credentials (`aws configure`).

## Deployment

1.  **Navigate to the terraform directory:**
    ```bash
    cd infra/terraform
    ```

2.  **Initialize Terraform:**
    ```bash
    terraform init
    ```

3.  **Plan the deployment:**
    ```bash
    terraform plan
    ```

4.  **Apply the changes:**
    ```bash
    terraform apply
    ```
    Type `yes` when prompted.

5.  **Output:**
    Terraform will output the `api_endpoint`. You can use this URL to configure your frontend or test the API.

## Lambda Functions

The Lambda code is located in `infra/lambda`.
- `profile/`: Contains the Node.js code for the Profile API.

## Notes

- The Terraform configuration uses `us-east-1` region by default.
- The S3 bucket name includes a random suffix to ensure uniqueness.
