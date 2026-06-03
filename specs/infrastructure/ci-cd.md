# CI/CD Spec

## Overview

CI/CD is handled by a single GitHub Actions workflow that builds and pushes Docker images for both backend and frontend services to GitHub Container Registry (GHCR).

## Workflow: Build and Push Docker Images

**File:** `.github/workflows/docker-build.yml`

### Triggers

| Event | Condition |
|-------|-----------|
| `push` | Branches: `main`, `master` |
| `push` | Tags: `v*.*.*` (semver) |
| `pull_request` | Branches: `main`, `master` |
| `workflow_dispatch` | Manual trigger (no inputs) |

### Environment Variables

| Variable | Value |
|----------|-------|
| `REGISTRY` | `ghcr.io` |
| `IMAGE_NAME` | `${{ github.repository }}` (e.g., `username/apc-pdu-control`) |

### Job: `build-and-push`

**Runner:** `ubuntu-latest`

**Permissions:**
- `contents: read`
- `packages: write`

### Build Matrix

Uses a strategy matrix to build both services in parallel:

| Service | Build Context | Dockerfile |
|---------|--------------|------------|
| `backend` | `./backend` | `./backend/Dockerfile` |
| `frontend` | `./frontend` | `./frontend/Dockerfile` |

### Steps

1. **Checkout repository** (`actions/checkout@v4`)

2. **Set up QEMU** (`docker/setup-qemu-action@v3`)
   - Platform: `linux/amd64` only
   - Note: arm64 was removed to fix QEMU emulation issues (see commit `1d74fd1e`)

3. **Set up Docker Buildx** (`docker/setup-buildx-action@v3`)

4. **Log in to GHCR** (`docker/login-action@v3`)
   - Conditional: skipped on pull requests (`github.event_name != 'pull_request'`)
   - Registry: `ghcr.io`
   - Username: `${{ github.actor }}`
   - Password: `${{ secrets.GITHUB_TOKEN }}`

5. **Extract metadata** (`docker/metadata-action@v5`)
   - Image name: `ghcr.io/${IMAGE_NAME}-${service}` (e.g., `ghcr.io/user/apc-pdu-control-backend`)
   - Tag rules:

   | Tag Type | Pattern | Example |
   |----------|---------|---------|
   | Branch ref | `type=ref,event=branch` | `master` |
   | PR ref | `type=ref,event=pr` | `pr-42` |
   | Semver full | `type=semver,pattern={{version}}` | `1.2.3` |
   | Semver minor | `type=semver,pattern={{major}}.{{minor}}` | `1.2` |
   | Semver major | `type=semver,pattern={{major}}` | `1` |
   | SHA | `type=sha,prefix={{branch}}-` | `master-abc1234` |
   | Latest | `type=raw,value=latest` | `latest` (default branch only) |

6. **Build and push** (`docker/build-push-action@v5`)
   - Platform: `linux/amd64`
   - Push: only on non-PR events
   - Cache: GitHub Actions cache (`type=gha`, `mode=max`)
   - Build arg: `BUILDKIT_INLINE_CACHE=1`

### Image Naming Convention

```
ghcr.io/{owner}/{repo}-{service}:{tag}
```

Examples:
- `ghcr.io/username/apc-pdu-control-backend:latest`
- `ghcr.io/username/apc-pdu-control-frontend:v1.2.3`
- `ghcr.io/username/apc-pdu-control-backend:master-abc1234`

### PR vs Push Behavior

| Aspect | Pull Request | Push to main/master | Tag push |
|--------|-------------|-------------------|----------|
| Build | Yes | Yes | Yes |
| Push to GHCR | No | Yes | Yes |
| GHCR login | Skipped | Yes | Yes |
| `latest` tag | N/A | Yes | No |
| Semver tags | N/A | No | Yes |

### Caching Strategy

- Uses GitHub Actions cache (`type=gha`) for Docker layer caching
- `mode=max` exports all layers (not just final) for maximum cache reuse
- `BUILDKIT_INLINE_CACHE=1` enables inline cache metadata in built images

### Architecture Support

Currently builds for `linux/amd64` only. The DEPLOYMENT.md mentions multi-arch support (`linux/amd64` and `linux/arm64`), but arm64 was disabled due to QEMU emulation issues.
