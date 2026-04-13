# Ceeline Compact Examples

Golden fixture samples showing how each surface renders in compact format.

## Handoff (lite)

```
@cl1 s=ho i=test.handoff ch=i md=ro au=m fb=rj rs=n sz=st
sum="Test handoff summary."
f="Fact one."
ask="Test ask."
role=rv
tgt=fx
sc=transport
#n=143
```

## Handoff (full)

```
@cl1 s=ho i=test.handoff ; sum="Test handoff summary." ; f="Fact one." ; ask="Test ask." ; role=rv ; tgt=fx ; sc=transport ; #n=122
```

## Digest (lite)

```
@cl1 s=dg i=test.digest ch=i md=ro au=m fb=rj rs=n sz=st
sum="Test digest summary."
f="Fact one."
ask="Test ask."
win=ss
st=ok
met=items:3
#n=138
```

## Memory (lite)

```
@cl1 s=me i=test.memory ch=i md=ro au=m fb=rj rs=n sz=st
sum="Test memory summary."
f="Fact one."
ask="Test ask."
mk=fa
dur=ps
cit=ref.md
#n=137
```

## Canonical JSON envelope (handoff)

This is the JSON envelope that produces the compact outputs above:

```json
{
  "surface": "handoff",
  "intent": "review.security",
  "text": "Review src/core/codec.ts for transport safety. Preserve {{PROJECT_ID}}, GPT-5.4, and npm test. Return findings only.",
  "payload": {
    "summary": "Review src/core/codec.ts for transport safety.",
    "facts": [
      "Preserve {{PROJECT_ID}} exactly.",
      "Preserve GPT-5.4 exactly.",
      "Preserve npm test exactly."
    ],
    "ask": "Return severity-ordered findings only.",
    "role": "reviewer",
    "target": "fixer",
    "scope": ["transport", "validation"],
    "artifacts": [],
    "metadata": {
      "owner": "fixtures"
    }
  }
}
```

## final_response policy (history surface)

Use `policy: "final_response"` when the envelope represents the last boundary
before user-visible output. This switches channel to `controlled_ui`, render
style to `user_facing`, and sets `no_user_visible_output: false`.

```json
{
  "surface": "history",
  "intent": "ui.final-response",
  "policy": "final_response",
  "payload": {
    "summary": "The security review is complete. No critical issues were found.",
    "facts": [
      "The affected transport path is now validated.",
      "Preserve {{PROJECT_ID}} in all output."
    ],
    "ask": "Share only the user-visible outcome.",
    "span": "exchange",
    "turn_count": 1,
    "anchor": "assistant-final",
    "artifacts": [],
    "metadata": {}
  }
}
```

Via MCP tool:

```json
{
  "surface": "history",
  "intent": "ui.final-response",
  "policy": "final_response",
  "payload": { "summary": "Security review complete. No critical issues." }
}
```
