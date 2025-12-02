provider "aws" {
  region = "us-east-1"
}

resource "aws_dynamodb_table" "profiles" {
  name           = "HealthyProfiles"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "email"

  attribute {
    name = "email"
    type = "S"
  }
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "avatars" {
  bucket = "Healthy-avatars-${random_id.suffix.hex}"
}

resource "aws_iam_role" "lambda_role" {
  name = "Healthy_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "Healthy_lambda_policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.profiles.arn
      },
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/profile"
  output_path = "${path.module}/profile_lambda.zip"
}

resource "aws_lambda_function" "profile_api" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "HealthyProfileAPI"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.profiles.name
    }
  }
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = "HealthyHTTPAPI"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.http_api.id
  name   = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.profile_api.invoke_arn
}

resource "aws_apigatewayv2_route" "profile_route" {
  api_id = aws_apigatewayv2_api.http_api.id
  route_key = "ANY /profile"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.profile_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}
