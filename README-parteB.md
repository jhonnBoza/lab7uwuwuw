# Parte B - Despliegue en AWS (ALB + 2 EC2)

Para el lab **completo** (login + CRUD + RDS detras del mismo ALB), sigue ademas **`README-parteC.md`**.

Esta parte replica la idea de la Parte A, pero en AWS:

- Un `Application Load Balancer` publico recibe trafico HTTP.
- Dos instancias EC2 (en subredes distintas) ejecutan el mismo `server.js`.
- El ALB balancea entre ambas y usa health checks en `/health`.

## 1) Topologia objetivo

- **VPC**: `10.0.0.0/16`
- **Subred publica A**: primera AZ (ej. `us-east-2a`, bloque tipo `10.0.1.0/24`)
- **Subred publica B**: segunda AZ (ej. `us-east-2b`, bloque tipo `10.0.2.0/24`)
- **ALB**: listener HTTP `:80`
- **Target Group**: protocolo HTTP, puerto `8080`, health check `/health`
- **EC2 x2**: `t2.micro` o `t3.micro` (segun cuota de tu cuenta), una por subred

## 2) Security Groups recomendados

### SG del ALB (`sg-alb`)

- Inbound:
  - `HTTP 80` desde `0.0.0.0/0`
- Outbound:
  - Todo permitido (default)

### SG de EC2 (`sg-web`)

- Inbound:
  - `TCP 8080` **solo** desde `sg-alb`
  - `TCP 22` desde tu IP publica (solo admin)
- Outbound:
  - Todo permitido (default)

## 3) Preparar cada EC2

En cada instancia (Amazon Linux / Ubuntu), clona o copia este proyecto y ejecuta:

```bash
npm install
PORT=8080 NAME=web-server-1 node server.js
```

En la segunda:

```bash
npm install
PORT=8080 NAME=web-server-2 node server.js
```

Notas:

- El servidor ahora escucha en `0.0.0.0` por defecto (requerido para ALB).
- Si quieres persistencia, ejecútalo con `pm2`, `systemd` o Docker.

## 4) Crear y asociar Target Group

1. Crea un Target Group `tg-lab7-web` tipo `Instances`.
2. Configura:
   - Protocol: `HTTP`
   - Port: `8080`
   - Health check path: `/health`
3. Registra ambas EC2 como targets.
4. Verifica estado `healthy` en los dos nodos.

## 5) Crear ALB

1. Tipo: `Application Load Balancer`
2. Scheme: `internet-facing`
3. Listener: `HTTP :80`
4. Subredes: publica A y publica B
5. Security Group: `sg-alb`
6. Regla default del listener: forward a `tg-lab7-web`

## 6) Pruebas

Con el DNS del ALB:

```bash
curl http://<ALB_DNS>
curl http://<ALB_DNS>
curl http://<ALB_DNS>
```

Debes ver respuestas alternadas entre `web-server-1` y `web-server-2`.

Health check:

```bash
curl http://<ALB_DNS>/health
```

Debe responder `ok`.

## 7) Endurecer SG despues de pruebas (como pide el lab)

En CloudShell (ajusta IDs si los tuyos son otros):

```bash
REGION=us-east-2
MYIP=$(curl -s https://checkip.amazonaws.com | tr -d '\n')
ALB_SG=sg-00e9d43b0848b01cc

# Repite WEB_SG por cada SG adjunto a tus 2 EC2 (en tu caso suele bastar uno)
WEB_SG=sg-0c503203721415736

# Quitar 8080 abierto a Internet (temporal de pruebas)
aws ec2 revoke-security-group-ingress --region $REGION --group-id $WEB_SG --protocol tcp --port 8080 --cidr 0.0.0.0/0 2>/dev/null || true

# Asegurar 8080 solo desde el ALB
aws ec2 authorize-security-group-ingress --region $REGION --group-id $WEB_SG --protocol tcp --port 8080 --source-group $ALB_SG || true

# Quitar SSH abierto a todo Internet
aws ec2 revoke-security-group-ingress --region $REGION --group-id $WEB_SG --protocol tcp --port 22 --cidr 0.0.0.0/0 2>/dev/null || true

# SSH solo desde tu IP
aws ec2 authorize-security-group-ingress --region $REGION --group-id $WEB_SG --protocol tcp --port 22 --cidr ${MYIP}/32 || true
```

Si la segunda EC2 usa otro SG (ej. `sg-01266dbdb22431fd6`), ejecuta el mismo bloque cambiando `WEB_SG`.

## 8) Troubleshooting rapido

- Si target aparece `unhealthy`:
  - Revisa que Node este levantado en `8080`.
  - Revisa SG de EC2: permitir `8080` desde `sg-alb`.
  - Revisa que el proceso no este escuchando solo en localhost.
- Si no abre el ALB:
  - Revisa SG del ALB: `80` abierto a internet.
  - Verifica que el ALB sea `internet-facing`.

- Si `curl` desde CloudShell al DNS del ALB hace timeout pero el navegador funciona:
  - Prueba `curl -4`; a veces IPv6 no tiene ruta.
  - Confirma regla **TCP 80** desde `0.0.0.0/0` en el SG del ALB.
