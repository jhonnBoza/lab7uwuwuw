# Parte A - Entorno local (Nginx + 3 backends)

## 1) Instalar dependencias

En la carpeta del proyecto:

```powershell
npm install
```

## 2) Levantar los 3 backends Node

Abrir 3 terminales distintas en la misma carpeta y ejecutar:

Terminal 1:

```powershell
$env:PORT=8081; $env:NAME="backend-1"; node .\server.js
```

Terminal 2:

```powershell
$env:PORT=8082; $env:NAME="backend-2"; node .\server.js
```

Terminal 3:

```powershell
$env:PORT=8083; $env:NAME="backend-3"; node .\server.js
```

## 3) Levantar Nginx en puerto 80

### Opcion A (si tienes nginx instalado en Windows)

Copiar el archivo `nginx.conf` de este proyecto al directorio de configuracion de Nginx y reiniciar Nginx.

Comandos tipicos (ajusta segun tu ruta):

```powershell
nginx -t
nginx -s reload
```

### Opcion B (Docker, si no tienes nginx instalado)

```powershell
docker run --name lab7-nginx -p 80:80 -v "${PWD}\nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine
```

## 4) Probar round robin

Ejecuta varias veces:

```powershell
curl http://localhost
```

Debe ir alternando entre `backend-1`, `backend-2` y `backend-3`.
