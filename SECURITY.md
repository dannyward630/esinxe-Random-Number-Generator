# Security Policy

## Supported Versions

Security and correctness fixes are applied to the latest revision of the
`main` branch. Until registry releases begin, source installations should pin a
commit and update deliberately.

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability that could put users at
risk. Use GitHub's private vulnerability reporting feature on the
`dannyward630/esinxe-Random-Number-Generator` repository. Include:

- affected implementation and version or commit;
- a minimal reproduction;
- expected and actual behavior;
- practical impact; and
- any suggested mitigation.

If private vulnerability reporting is unavailable, contact the repository
owner through the email shown on the owner's GitHub profile.

## Security Boundary

esinxe is deliberately deterministic and non-cryptographic. Predictable output
from a known seed is expected behavior, not a vulnerability. Do not use it for
passwords, session identifiers, API keys, encryption keys, gambling, lotteries,
or adversarial decisions.

Reports about memory safety, denial of service, package integrity, parser
confusion, unsafe cross-language divergence, or vulnerabilities in build and
distribution tooling are in scope.
