# Addendum: metamorphic-check and sequence corrections (Fable co-head, private)

Date: 2026-09-07 UTC. Corrects the metamorphic examples and two sequence points in .context/cohead-robinhood-return/2026-09-07-cost-challenge-addendum-and-sequence.md (preserved unchanged).

## Corrected metamorphic checks
Split into two classes. Deterministic stages (packet builder, claim validator, proposal hashing, gate, cost records) get hard invariants that fail a build. Model stages get diagnostics whose rates are reported, never asserted as invariants.

| Perturbation | Deterministic-stage expectation (hard) | Model-stage expectation (diagnostic) |
|---|---|---|
| Source URL or provenance field changed, content identical | It is bound provenance: packet id, proposal id and receipt hash MUST change; outputs must reference the new ids. Not an irrelevant perturbation. | Report whether the decision changed; no expectation asserted. |
| JSON whitespace; key order in unordered maps | Canonicalization identical; hashes identical. | n/a |
| Array element order | Identical only where the schema declares the array a set; otherwise order is meaningful and hashes change. | n/a |
| Alias or ticker renamed, entity_id and facts unchanged | Validator and gate outputs identical after identity resolution. | Decision-stability diagnostic: rate of changed decisions across renamed packets; a change is reported, not automatically a defect. |
| Unit-consistent rescaling with unit field updated | Validated numerical economics (ratios, weights, limits) compare equal; claim bytes and hashes may legitimately change. | Report decision stability. |
| Cited financial value changed | Dependent structured claims must equal the new value or fail validation; an unchanged dependent claim is a validator defect. | Report whether the PM's cited facts followed the packet; a PM citing the old value is a memo-validation failure, not a model invariant claim. |
| Post-cutoff item injected | Packet rejected before any stage. | n/a |
None of these is a proof of decontamination or honesty; they are protocol tests with distinct expected behaviours.

## Sequence corrections
- S5: a paid dataset is conditional on demonstrable need after the sample audit and the current-source comparison; it is not a universal prerequisite of the factor experiment.
- S2: Treasury rights sub-question remains open. Astra's bounded read of the linked privacy policy found no copyright or public-domain language, so no closure is assumed; the register records "open" until an actual terms page or source statement is found.
