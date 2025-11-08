# Deployment Methods Comparison

## Two Approaches for Automated Deployment

### Approach 1: Self-Hosted Runner (Recommended for Home Networks) ✅

**How it works**: GitHub Actions runner runs **ON your Raspberry Pi**

```
Your Pi ←→ GitHub (pulls code and runs jobs locally)
```

**Pros**:
- ✅ **No internet exposure** - Pi stays on private network
- ✅ **No port forwarding** required
- ✅ **More secure** - No SSH exposed to internet
- ✅ **Faster builds** - No network transfer of binaries
- ✅ **Works anywhere** - Home network, behind firewall, NAT, etc.
- ✅ **Simpler setup** - No SSH key management
- ✅ **Free** - GitHub allows free self-hosted runners

**Cons**:
- ⚠️ Pi must be online for deployments to work
- ⚠️ Uses Pi's CPU for building (2-3 minutes per deployment)
- ⚠️ Requires installing GitHub runner software on Pi

**Use When**:
- Your Pi is on a home network (most common)
- Behind a router/NAT
- No public IP address
- Security is a priority

**Setup Time**: 10 minutes

---

### Approach 2: Remote SSH (For Public IPs or VPS)

**How it works**: GitHub Actions runs on GitHub servers and SSHs into your Pi

```
GitHub Servers → [Internet] → Your Pi (via SSH)
```

**Pros**:
- ✅ Builds happen on GitHub servers (faster hardware)
- ✅ Pi doesn't need to be powerful
- ✅ Can deploy to multiple Pis easily
- ✅ Standard CI/CD pattern

**Cons**:
- ❌ **Requires public IP** or port forwarding
- ❌ **Exposes SSH to internet** - Security risk!
- ❌ **Complex setup** - SSH keys, firewall rules, fail2ban
- ❌ **Only works if Pi is publicly accessible**
- ❌ **Not suitable for home networks** behind NAT

**Use When**:
- Pi has a public IP address (rare)
- Pi is on a VPS/cloud server
- Corporate network with proper firewall
- You know what you're doing with security

**Setup Time**: 30 minutes + security hardening

---

## Comparison Table

| Feature | Self-Hosted Runner | Remote SSH |
|---------|-------------------|------------|
| **Works on home network** | ✅ Yes | ❌ No (without port forwarding) |
| **Security** | 🟢 High | 🟡 Medium (if done right) |
| **Setup complexity** | 🟢 Easy | 🟡 Medium |
| **Internet exposure** | ✅ None | ❌ SSH port exposed |
| **Build speed** | 🟡 Moderate (on Pi) | 🟢 Fast (GitHub servers) |
| **Requires public IP** | ❌ No | ✅ Yes |
| **Port forwarding** | ❌ No | ✅ Required |
| **Free** | ✅ Yes | ✅ Yes |
| **Deploy to multiple Pis** | 🟡 Need runner on each | 🟢 Easy |

---

## Recommended Setup by Network Type

### Home Network (Most Users)

```
✅ Use: Self-Hosted Runner
```

Your network:
```
Internet → Router (NAT) → [Private Network]
                           └─ Raspberry Pi (192.168.1.x)
```

**Why**: Your Pi has a private IP (192.168.x.x or 10.0.x.x) and is behind a router. GitHub Actions running on remote servers cannot reach it without exposing SSH to the internet.

**Setup**: Run `setup-github-runner.sh` on your Pi

---

### VPS / Cloud Server

```
✅ Use: Remote SSH (or Self-Hosted Runner)
```

Your setup:
```
Internet → Raspberry Pi (Public IP: 1.2.3.4)
```

**Why**: Your Pi has a public IP, so GitHub Actions can SSH directly.

**Setup**: Use `.github/workflows/deploy-pi5.yml` with proper SSH hardening

---

### Corporate Network

```
✅ Use: Self-Hosted Runner (or VPN + Remote SSH)
```

**Why**: Corporate firewalls typically block inbound SSH. Self-hosted runner works without any firewall changes.

---

## Security Considerations

### Self-Hosted Runner Security

**What you're exposing**: Nothing to the internet

**Risks**:
- Runner has access to your GitHub repository secrets
- Malicious code in workflows could affect your Pi
- Compromised GitHub account = compromised runner

**Mitigations**:
- ✅ Use dedicated user for runner
- ✅ Limit runner permissions
- ✅ Review workflow changes before merging
- ✅ Use branch protection rules
- ✅ Enable 2FA on GitHub account
- ✅ Monitor runner logs

**Risk Level**: 🟢 Low (if you control the repository)

---

### Remote SSH Security

**What you're exposing**: SSH port (22) to entire internet

**Risks**:
- Constant brute-force attack attempts
- Potential SSH vulnerabilities
- Misconfiguration = compromised system
- DDoS target

**Required Mitigations**:
- ✅ SSH key authentication ONLY (no passwords)
- ✅ Fail2ban (automatic IP banning)
- ✅ UFW firewall
- ✅ Custom SSH port (not 22)
- ✅ Rate limiting
- ✅ IP whitelist (if possible)
- ✅ Monitor auth logs daily
- ✅ Keep SSH updated

**Risk Level**: 🟡 Medium to 🔴 High (if not hardened properly)

---

## Performance Comparison

### Build Times

**Self-Hosted Runner (on Raspberry Pi 5)**:
- Checkout code: 5 seconds
- Build binaries: 2-3 minutes
- Deploy: 10 seconds
- **Total: ~3-4 minutes**

**Remote SSH (GitHub servers + Pi 5)**:
- Build on GitHub: 1-2 minutes
- Transfer binaries: 10 seconds
- SSH deployment: 20 seconds
- **Total: ~2-3 minutes**

**Difference**: Self-hosted is ~1 minute slower, but more secure for home use.

---

## Cost Comparison

### Self-Hosted Runner

**GitHub Actions minutes**: Free (unlimited for self-hosted)
**Pi power usage**: ~7W = $0.05/day = $1.50/month
**Internet**: No extra cost
**Total**: **$1.50/month**

### Remote SSH

**GitHub Actions minutes**: Free (2,000/month for public repos)
**Pi power usage**: Same as above
**Internet**: Same
**Port forwarding**: Free (if you own the router)
**VPN alternative**: $5-10/month (if using VPN instead of port forwarding)
**Total**: **$1.50-11.50/month**

---

## Hybrid Approach (Advanced)

For maximum security with remote builds:

1. **Build on GitHub servers** (fast)
2. **Use Tailscale VPN** to access Pi (secure)
3. **Deploy via VPN tunnel** (no port forwarding)

**Benefits**: Fast builds + Secure deployment
**Complexity**: High
**Setup time**: 1 hour
**Monthly cost**: Free (Tailscale personal is free)

---

## Quick Decision Guide

**Answer these questions**:

1. **Is your Pi on a home network?**
   - Yes → Use Self-Hosted Runner ✅
   - No (VPS/Cloud) → Either approach works

2. **Do you have a public IP address?**
   - No → Must use Self-Hosted Runner ✅
   - Yes → Can use Remote SSH (with hardening)

3. **Are you comfortable exposing SSH to internet?**
   - No → Use Self-Hosted Runner ✅
   - Yes, and I'll harden it → Remote SSH is okay

4. **Do you need to deploy to multiple Pis?**
   - Yes → Remote SSH might be easier (one workflow, multiple targets)
   - No → Self-Hosted Runner is simpler

5. **What's your priority?**
   - Security → Self-Hosted Runner ✅
   - Speed → Remote SSH (if you have public IP)
   - Simplicity → Self-Hosted Runner ✅

---

## Migration Path

### Start with Self-Hosted Runner

1. **Week 1-4**: Use self-hosted runner
2. **Evaluate**: Are builds too slow?
3. **If needed**: Migrate to remote SSH (if you have public IP)

### Files to use:

**Self-Hosted Runner**:
- `.github/workflows/deploy-pi5-self-hosted.yml`
- `deployment/setup-github-runner.sh`

**Remote SSH**:
- `.github/workflows/deploy-pi5.yml`
- `deployment/setup-pi.sh`

---

## Conclusion

**For 95% of users (home networks)**:

✅ **Use Self-Hosted Runner**

It's:
- Secure (no internet exposure)
- Simple (no port forwarding)
- Free (unlimited builds)
- Fast enough (3-4 minutes)

**Only use Remote SSH if**:
- You have a public IP
- You're experienced with SSH security
- You need to deploy to many Pis centrally

**Bottom line**: Unless you have a specific reason to expose SSH to the internet, use the self-hosted runner approach. It's the modern, secure way to do CI/CD on private networks.
