# Parte C — Login + CRUD + RDS + ALB (lab completo tipo curso)

Esta parte une lo que ya tienes en AWS (ALB + 2 EC2 + target group) con una **aplicacion web** y una **base MySQL en RDS** compartida por las dos instancias.

## Requisitos previos

- Parte B lista: ALB, target group puerto **8080**, health **`/health`**, 2 EC2 en distintas AZ.
- Mismo **JWT_SECRET** en ambas EC2 (si no, el login en una instancia falla al pegarle la otra).
- Repo propio (por ejemplo [tu GitHub](https://github.com/jhonnBoza/lab7uwuwuw)).

## 1) Crear RDS MySQL

1. Consola AWS → **RDS** → **Create database**.
2. Engine: **MySQL** (8.x).
3. Template: **Free tier** si aplica, o instancia pequena (`db.t3.micro` / `db.t4g.micro`).
4. Identificador, usuario maestro y contrasena (guardalos).
5. **VPC**: la misma que tus EC2.
6. **Public access**: para laboratorio simple puedes usar **Yes** (mas facil desde EC2 sin NAT). En produccion seria privado + subnets privadas.
7. **VPC security group**: crea `sg-rds-lab7`:
   - Inbound: **MySQL/Aurora 3306** desde el **security group de las EC2** (`sg-web`), no desde `0.0.0.0/0`.
8. Crea la base (por ejemplo `lab7`) desde **RDS Query Editor** o con cliente MySQL desde una EC2:

```sql
CREATE DATABASE IF NOT EXISTS lab7 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

(Ajusta si tu plantilla de RDS ya creo una base con otro nombre.)

## 2) Variables de entorno en cada EC2

En **ambas** instancias (mismos valores salvo `INSTANCE_NAME`):

```bash
sudo tee /etc/sysconfig/lab7 >/dev/null <<'EOF'
PORT=8080
INSTANCE_NAME=web-server-1
JWT_SECRET=TU_SECRETO_LARGO_IGUAL_EN_AMBAS_EC2
DB_HOST=tu-endpoint.region.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=TU_PASSWORD_RDS
DB_NAME=lab7
EOF
```

En la segunda instancia cambia solo `INSTANCE_NAME=web-server-2`.

## 3) Desplegar el codigo

```bash
sudo dnf install -y git nodejs npm
sudo mkdir -p /opt/lab7 && sudo chown ec2-user:ec2-user /opt/lab7
cd /opt/lab7
git clone https://github.com/jhonnBoza/lab7uwuwuw.git .
npm install
```

Servicio systemd (recomendado):

```bash
sudo tee /etc/systemd/system/lab7.service >/dev/null <<'EOF'
[Unit]
Description=Lab7 app
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/lab7
EnvironmentFile=/etc/sysconfig/lab7
ExecStart=/usr/bin/node /opt/lab7/server.js
Restart=always
RestartSec=3
User=ec2-user

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now lab7
curl -s http://127.0.0.1:8080/health
```

Repite el clon/`npm install`/systemd en la **segunda** EC2 (o usa un script identico).

## 4) Target group y ALB

- Target group: puerto **8080**, health path **`/health`** (sin cambios).
- Listener ALB **80** → forward al TG (sin cambios).
- La app sirve **`/`** como SPA y **`/api/*`** como API; el balanceador reparte peticiones entre EC2; **RDS es la fuente unica de verdad** para usuarios y tareas.

## 5) Probar

1. Navegador: `http://<DNS-DEL-ALB>/`
2. Registrarse, crear tareas, marcar hechas, borrar.
3. Recargar varias veces: debe seguir funcionando (JWT + RDS compartido).
4. `http://<DNS-DEL-ALB>/health` → `ok`.

## 6) Evidencias sugeridas

- RDS: engine, endpoint, SG con 3306 desde SG de EC2.
- EC2: variables (sin mostrar password en captura, tapa con rectangulo).
- Pantalla de la app detras del DNS del ALB.
- Target group: **healthy** en ambas instancias.

## 7) Problemas frecuentes

- **401 al alternar instancias**: `JWT_SECRET` distinto entre EC2.
- **500 en API**: SG de RDS no permite 3306 desde SG de EC2, o credenciales/host mal escritos.
- **Health unhealthy**: app no escucha en 8080 o `/health` no responde 200.
