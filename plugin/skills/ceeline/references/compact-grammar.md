# Ceeline Compact Grammar Reference

## Header

Every compact message starts with a header line:

```
@cl1 s=<surface> i=<intent> [key=value ...]
```

- `@cl1` — version marker (Ceeline v1)
- `s=` — surface code (required)
- `i=` — intent identifier (required)

### Surface codes

| Surface        | Code |
|----------------|------|
| handoff        | ho   |
| digest         | dg   |
| memory         | me   |
| reflection     | rf   |
| tool_summary   | ts   |
| routing        | rt   |
| prompt_context | pc   |
| history        | hs   |

### Header constraint keys

| Key   | Meaning             | Values                         |
|-------|---------------------|--------------------------------|
| ch=   | channel             | i=internal, c=controlled_ui    |
| md=   | mode                | ro=read_only, ad=advisory, mu=mutating |
| au=   | audience            | m=machine, o=operator, u=user  |
| fb=   | fallback            | rj=reject, vb=verbose, pt=pass_through |
| rs=   | render style        | n=none, t=terse, nm=normal, uf=user_facing |
| sz=   | sanitizer           | st=strict, sd=standard         |
| mx=   | max_render_tokens   | integer                        |

## Body clauses

After the header, body clauses follow. In **lite** density, each clause is on
its own line. In **full** and **dense** density, clauses are separated by ` ; `.

### Common clauses

| Key    | Meaning              | Applies to     |
|--------|----------------------|----------------|
| sum=   | summary              | all surfaces   |
| f=     | fact                 | all surfaces   |
| ask=   | ask                  | all surfaces   |
| tok=   | preserve token       | full/dense only |
| cls=   | preserve class       | lite only      |
| x_*=   | extension field      | all            |

### Surface-specific clauses

**handoff** (s=ho):

| Key   | Meaning | Values                                           |
|-------|---------|--------------------------------------------------|
| role= | role    | pl=planner, rv=reviewer, co=coordinator, pa=parent_agent |
| tgt=  | target  | im=implementer, fx=fixer, sa=subagent, rv=reviewer |
| sc=   | scope   | comma-separated list                             |

**digest** (s=dg):

| Key  | Meaning | Values                           |
|------|---------|----------------------------------|
| win= | window  | tr=turn, ss=session, rn=run      |
| st=  | status  | ok=ok, wr=warn, er=error         |
| met= | metrics | key:value,key:value (numeric)    |

**memory** (s=me):

| Key  | Meaning     | Values                              |
|------|-------------|-------------------------------------|
| mk=  | memory_kind | fa=fact, de=decision, rs=research   |
| dur= | durability  | sn=session, pj=project, ps=persistent |
| cit= | citations   | comma-separated list                |

**reflection** (s=rf):

| Key  | Meaning         | Values                                        |
|------|-----------------|-----------------------------------------------|
| rty= | reflection_type | sc=self_critique, hy=hypothesis, pr=plan_revision, cc=confidence_check |
| cnf= | confidence      | number (0–1)                                  |
| rev= | revision        | string                                        |

**tool_summary** (s=ts):

| Key  | Meaning    | Values                                  |
|------|------------|-----------------------------------------|
| tn=  | tool_name  | string                                  |
| out= | outcome    | ok=success, fl=failure, pt=partial, sk=skipped |
| ela= | elapsed_ms | number                                  |

**routing** (s=rt):

| Key   | Meaning    | Values                                        |
|-------|------------|-----------------------------------------------|
| str=  | strategy   | dr=direct, bc=broadcast, cn=conditional, fb=fallback |
| cand= | candidates | comma-separated list                          |
| sel=  | selected   | string                                        |

**prompt_context** (s=pc):

| Key  | Meaning    | Values                                         |
|------|------------|-------------------------------------------------|
| ph=  | phase      | sy=system, ij=injection, rt=retrieval, gr=grounding |
| pri= | priority   | number                                          |
| src= | source_ref | string                                          |

**history** (s=hs):

| Key  | Meaning    | Values                                    |
|------|------------|-------------------------------------------|
| spn= | span       | tr=turn, ex=exchange, ss=session, pj=project |
| tc=  | turn_count | number                                    |
| anc= | anchor     | string                                    |

## Integrity trailer

Every compact message ends with:

```
#n=<bytecount>
```

The byte count covers all content *before* the trailer (including the space or
newline separator). The parser verifies this on read. On mismatch, parse
succeeds but emits an `integrity_mismatch` warning.

## Density rules

| Density | Separator    | Includes tok= | Includes cls=, ch=, md=, etc. |
|---------|-------------|---------------|-------------------------------|
| lite    | newline     | no            | yes (in header)               |
| full    | ` ; `       | yes           | yes (in header)               |
| dense   | ` ; `       | yes           | no (dropped from header)      |

## Quoting

Values containing spaces or special characters are double-quoted:
- `sum="Hello world"`
- `tok="npm test"`

Values without spaces are unquoted:
- `role=rv`
- `sc=transport,validation`
