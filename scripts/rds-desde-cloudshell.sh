#!/usr/bin/env bash
# Ejecutar en AWS CloudShell (region us-east-2). Antes exporta la contrasena maestra:
#   export RDS_PASSWORD='TuPasswordSeguro123!'
set -euo pipefail

REGION="${REGION:-us-east-2}"
: "${RDS_PASSWORD:?Define RDS_PASSWORD antes de ejecutar, ej: export RDS_PASSWORD='TuClave123!' }"

VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text)
SUBNET_A=$(aws ec2 describe-subnets --region "$REGION" --filters Name=vpc-id,Values="$VPC_ID" Name=availability-zone,Values=us-east-2a --query "Subnets[0].SubnetId" --output text)
SUBNET_B=$(aws ec2 describe-subnets --region "$REGION" --filters Name=vpc-id,Values="$VPC_ID" Name=availability-zone,Values=us-east-2b --query "Subnets[0].SubnetId" --output text)

# SG de las EC2 (ajusta si el tuyo es otro)
WEB_SG="${WEB_SG:-sg-0c503203721415736}"

# Nota: el nombre del SG no puede empezar por "sg-" (restriccion AWS en algunas cuentas).
RDS_SG_NAME="rds-lab7-mysql"
RDS_SG=$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=group-name,Values=$RDS_SG_NAME" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || true)
if [ -z "$RDS_SG" ] || [ "$RDS_SG" = "None" ]; then
  RDS_SG=$(aws ec2 create-security-group --region "$REGION" --group-name "$RDS_SG_NAME" --description "RDS lab7 MySQL" --vpc-id "$VPC_ID" --query "GroupId" --output text)
fi
aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$RDS_SG" --protocol tcp --port 3306 --source-group "$WEB_SG" 2>/dev/null || true

SUBNET_GROUP="lab7-rds-subnet"
if ! aws rds describe-db-subnet-groups --region "$REGION" --db-subnet-group-name "$SUBNET_GROUP" &>/dev/null; then
  aws rds create-db-subnet-group --region "$REGION" \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --db-subnet-group-description "Lab7 RDS" \
    --subnet-ids "$SUBNET_A" "$SUBNET_B"
fi

DB_ID="${DB_ID:-lab7-mysql}"
if aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$DB_ID" &>/dev/null; then
  echo "Ya existe la instancia RDS $DB_ID. Endpoint:"
  aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$DB_ID" --query "DBInstances[0].Endpoint.Address" --output text
  exit 0
fi

aws rds create-db-instance --region "$REGION" \
  --db-instance-identifier "$DB_ID" \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version "8.0" \
  --master-username admin \
  --master-user-password "$RDS_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids "$RDS_SG" \
  --db-subnet-group-name "$SUBNET_GROUP" \
  --backup-retention-period 0 \
  --no-publicly-accessible \
  --no-multi-az \
  --db-name lab7 \
  --tags "Key=Name,Value=lab7-mysql"

echo "RDS en creacion (suele tardar 8-15 min). Espera y luego ejecuta:"
echo "  aws rds wait db-instance-available --region $REGION --db-instance-identifier $DB_ID"
echo "  aws rds describe-db-instances --region $REGION --db-instance-identifier $DB_ID --query 'DBInstances[0].Endpoint' --output json"
