# architecture-review evals

Eval suite for the `architecture-reviewer` agent, in `claude plugin eval` format. Each case gives the
agent a short architecture contract (rule ids) and a diff, then grades the report.

- `recall-*` cases plant violations that must be found and cited by rule id.
- `precision-*` cases contain no in-scope violation; the reviewer must not fabricate one.

Each case has two graders: `report.md` (LLM rubric over the final message) and
`agent-dispatched.md` (the plugin's agent was actually used; scored in the with-plugin arm only).

```bash
claude plugin eval plugins/architecture-review                 # all cases, with vs. without plugin
claude plugin eval plugins/architecture-review --tag recall --runs 1 --ablation none
```

Results are written to `evals/results/`, which is git-ignored.
