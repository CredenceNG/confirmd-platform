# Cloudflare Tunnel Setup for MinIO Public URLs

## Option A: Cloudflare Tunnel (Recommended)

### 1. Install Cloudflare Tunnel
```bash
# Download cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Or using Homebrew on macOS
brew install cloudflared
```

### 2. Authenticate with Cloudflare
```bash
cloudflared tunnel login
```

### 3. Create a Tunnel
```bash
cloudflared tunnel create confirmd-platform
```

### 4. Configure the Tunnel
Create `~/.cloudflared/config.yml`:
```yaml
tunnel: confirmd-platform
credentials-file: ~/.cloudflared/your-tunnel-id.json

ingress:
  - hostname: minio.yourcompany.com
    service: http://localhost:9000
  - hostname: minio-console.yourcompany.com
    service: http://localhost:9001
  - service: http_status:404
```

### 5. Add DNS Records
```bash
cloudflared tunnel route dns confirmd-platform minio.yourcompany.com
cloudflared tunnel route dns confirmd-platform minio-console.yourcompany.com
```

### 6. Run the Tunnel
```bash
cloudflared tunnel run confirmd-platform
```

### 7. Update Docker Compose
```yaml
environment:
  - SHORTENED_URL_DOMAIN=https://minio.yourcompany.com/confirmd-dev-bucket
```

## Option B: Docker Compose Integration

Add to your `docker-compose-dev.yml`:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: confirmd-platform-cloudflared
    restart: always
    depends_on:
      - minio
    command: tunnel --no-autoupdate run --token YOUR_TUNNEL_TOKEN
    networks:
      - default

  utility:
    environment:
      - SHORTENED_URL_DOMAIN=https://minio.yourcompany.com/confirmd-dev-bucket
```

## Option C: Ngrok Alternative (For Testing)

```bash
# Install ngrok
brew install ngrok

# Expose MinIO port
ngrok http 9000

# Update environment variable
export SHORTENED_URL_DOMAIN=https://your-ngrok-id.ngrok.io/confirmd-dev-bucket
```

## Benefits of Cloudflare Tunnel:
- ✅ Free for personal use
- ✅ No need to open firewall ports
- ✅ Built-in DDoS protection
- ✅ SSL/TLS encryption
- ✅ Global CDN
- ✅ Access controls available

## URL Structure After Setup:
- Local: `http://localhost:9000/confirmd-dev-bucket/persist/{id}`
- Public: `https://minio.yourcompany.com/confirmd-dev-bucket/persist/{id}`
