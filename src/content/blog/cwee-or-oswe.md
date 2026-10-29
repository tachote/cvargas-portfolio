---
title: "CWEE or OSWE — which one to choose?"
date: "2025-03-25"
summary: "Personal comparison of HTB CWEE and OffSec OSWE: price, course, exam, report, and a prep path — without spoiling either exam."
lang: "en"
medium_url: "https://medium.com/@deeptester/cwee-or-oswe-which-one-choose-2987443a0e0a"
draft: false
---

**Disclaimer.** Personal opinion. Debatable. I will not leak exam technical detail.

I am an Application Security Engineer at Fluid Attacks. At the time of writing I had roughly two years in AppSec (web, mobile, API), with certs including BSCP, CASA, eMAPT, CSWAE, C-APIPEN, and CAPenX. Below is my experience with **OSWE** and **CWEE**, then a comparison.

## OSWE journey

I bought OffSec Learn One (~$2,000): one year of materials/labs, two exam attempts, plus KLCP and OSWP. I studied May 2024, about 8–10 hours a day for ~14 days, finished the material and labs, then sat the exam (48 hours + 24 hours reporting). Flags come from the hosts in the start email. After ~36 hours I had flags and report submitted; approval arrived about three days later.

### OSWE thoughts

With a year of web code-review already behind me, course and exam felt manageable. The material is not freshly updated, but the vulns, examples, and labs still hold up. It is part of OSCE3 — if that is the goal, OSWE is on the path.

## CWEE journey

I started February 2025: ~20 days at 7–10 hours/day on the material, then the exam. Requirements are similar in spirit to OSWE (flags on given targets). SysReptor’s public CWEE report template exists here: [HTB-CWEE-Report.pdf](https://docs.sysreptor.com/assets/reports/HTB-CWEE-Report.pdf). Early progress, then two stuck days; an ~8-hour break (food, gym) cleared it. Rest of the flags in about three days; finished in six days total, then ~20 days waiting for the pass email.

### CWEE thoughts

Course and exam were much harder than OSWE for me. Skills assessments are mandatory and demanding. The exam covers more vulns and more complexity. Worth it; recognition will keep growing.

## Comparison (prices as of March 2025)

### Price

**CWEE**

1. 6 months Platinum (~6000 cubes + 1500 as you finish modules): ~$408 + voucher ~$350 → **~$758**
2. Gold Annual (modules through Tier III, paths, voucher): ~$1260, or ~$1000 on offer

**OSWE**

1. Learn One (1 year labs, 2 attempts, KLCP/OSWP): ~$2749 / ~$2299 offer
2. Course + Cert bundle (3 months, 1 attempt): ~$1749

CWEE includes two attempts by default. Price gap is often >$1000.

### Course

**CWEE:** 15 modules, skills assessments per topic plus module finals, custom HTB Academy apps, strong manual + tooling path. Platform UX is excellent.

**OSWE:** 17 modules listed, ~11 with substantial content; labs often built around real CVEs. Feels advanced because the codebases are messy and real.

Both cover overlapping ground (insecure deserialization, prototype pollution, SSRF, XSS, …) with different teaching styles. CWEE wins on platform, volume, and hard skills assessments; OSWE wins on CVE-in-real-apps depth. They complement each other.

Other notes:

- CWEE requires completing the course/assessments for the cert — a feature, not a bug.
- Coverage differs at the edges (e.g. insecure random in OSWE, DNS rebinding in CWEE).

### Exam

**CWEE:** 10 days (long for my taste; ~8 would feel right), not proctored, automation allowed, flag format. Harder and broader than OSWE for me. Not fully whitebox; substantial blackbox with ways to go whitebox.

**OSWE:** 48h + 24h report, proctored, autopwn script required, no automated tools. Duration forces focus. Fewer vulns than CWEE, all high level. Fully whitebox — part of why it felt easier to me.

Why I preferred CWEE’s exam environment: faster targets/restarts, no VM required to audit code, higher difficulty ceiling. OSWE’s pluses: no AI/automation forces real understanding and scripting autonomy; proctoring adds seriousness some employers care about.

### Report

**CWEE:** Strict Markdown structure, professional write-up, exploit **and** fix with changelog and rationale. Wrong format (e.g. PDF, image rules) can fail you.

**OSWE:** Simpler evidence + description; format less rigid. Easier in my experience.

I prefer CWEE’s report bar — forcing a fix signals you can work with developers across the SDLC.

## Final take

- Budget-tight → **CWEE** (quality/price).
- Budget open → **CWEE first as prep, then OSWE** (OSWE feels more advanced, not always “harder”).
- Ideal: **both**. Not a ranking contest.

## How I would prepare for CWEE

1. Solid general web vulns (XSS, SQLi, CSRF, …). PortSwigger Academy first; BSCP if you can.
2. Read code across languages (PHP, Python, C#, JS, Java, …). [PentesterLab Code Review badge](https://pentesterlab.com/badges/codereview) helps a lot.
3. Do **every** course exercise consciously, with notes. Exam tracks the path.
4. Report format is non-negotiable (VS Code + Markdown Preview works).
5. AI is allowed and useful for scripts/opaque code — still verify.
6. Be patient. Stuck is normal; break, walk, retry.

## Bonus: starting path into AppSec

1. HTTP and browser basics (light pass).
2. [PentesterLab Essential](https://pentesterlab.com/badges/essential).
3. All of [PortSwigger Web Security Academy](https://portswigger.net/web-security) (free, excellent, Burp).
4. [PentesterLab Code Review](https://pentesterlab.com/badges/codereview).
5. CWEE, then OSWE.

Certs prove you can exploit documented classes of bugs. Research and new vectors are a different bar (Kettle, Heyes, Nyffenegger, Muñoz, Stampar, and many others — often without a wall of certs). Do not let the cert count inflate the ego.
