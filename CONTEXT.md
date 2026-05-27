# Blueberry Browser Context

## Glossary

### Workspace

The whole Blueberry app and user environment. A Workspace contains multiple Gardens plus Scratch browsing.

### Garden

A Garden is a persistent project or context space where browser work is organized visually. It contains Berries, Work Runs, Agents, and the Command Log relevant to that context.

### Berry

A Berry is a persistent, interactable Garden object. Berries can be tab-backed browsing contexts, external tool destinations, or agent-created artifacts. Examples include webpages, Google Sheets, Google Docs, leads, claims, drafts, reports, XLSX backups, notes, files, and scripts.

### Tab Berry

A Tab Berry is a live or restorable browser tab represented in the Garden. Humans and agents can enter Tab Berries to browse, scrape, write into tools, or inspect source pages.

### Artifact Berry

An Artifact Berry is a non-tab work object produced or shaped by agents or users, such as a lead card, extracted fact, outreach draft, report, script, or XLSX backup. If an artifact is backed by an external tool, expanding it opens the associated tab or file.

### Command

Anything the user asks Blueberry to do. Every Command is handled by at least one Main Agent.

### Main Agent

The primary agent responsible for a Command. Simple Commands may remain compact, while complex Commands can become visualized Work Runs.

### Work Run

A visualized execution of a complex Command inside a Garden. Work Runs show agents moving through Berries, producing outputs, writing into destination tools, and exposing telemetry.

### Command Log

A global secondary history of commands, agent responses, approvals, tool calls, operational decisions, errors, and completed Work Runs. The Command Log is reviewable but is not the main UI.
