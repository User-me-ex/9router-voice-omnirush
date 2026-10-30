# Security

This repository is experimental and AI-assisted. It has not received a security review
from the 9Router maintainers.

## Reporting

If you find a leaked credential, please report it privately to the repository owner and
do not open a public issue containing the secret. If you find a security vulnerability,
open a minimal issue without exploit details or contact the repository owner.

## Scope

The real-time voice gateway is a network service. Before exposing it beyond localhost:

- Require the WS token for all non-loopback clients.
- Terminate TLS at a trusted reverse proxy.
- Restrict origins and network access.
- Review the authentication and authorization paths in `live-gateway.js`.
- Do not rely on loopback detection when a reverse tunnel sits in front of the service.

No API keys, OAuth tokens, databases, or certificates are included in this repository.
