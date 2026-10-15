# Equities cost worksheet — local artifact check

2026-09-07. Explanatory research artifact only; no product route, provider, persistent storage or deployment.

Artifact: [equities-cost-worksheet.html](../artifacts/equities-cost-worksheet.html), SHA256 `464521d488c7b218417d6d800588f77ae32f7fefbc8fd1243db45bbd52e3ba3e`.

Astra checked the actual file in the already installed Chrome through Playwright, inside an isolated network namespace. Desktop and 390-pixel mobile screenshots were inspected. Default missing fees leave a partial $540 subtotal and 5.40% ratio at illustrative $10,000 capital; explicit zero fees complete that hypothetical estimate. A 50% allocation plus $35 monthly incremental fees gives $690 annually and 6.90%. Invalid capital clears the prior result; reset restores it; no horizontal mobile overflow, page errors or network attempts were observed. [Browser receipt](EQUITIES-cost-browser-check.json).

The existing independent GPT reviewer separately read the entire HTML and exercised 60 arithmetic, boundary, unknown-value, update and reset cases in a stub DOM. All passed without material findings. That check does not claim browser rendering or native validation; the root browser check supplies those observations. [Independent receipt](EQUITIES-cost-independent-check.json).

These checks establish the worksheet's limited calculation/display behavior. They do not verify actual bills, strategy returns, trading costs, taxes, an API budget or EQ001 implementation. Shared hosting allocation and additional equities costs are separate, blank inputs remain unknown, and no data is saved or transmitted.
