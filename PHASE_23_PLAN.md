# Phase 23: Onboarding Wizard & Health Check - Implementation Plan

## Overview

Phase 23 implements the long-planned `pnpm setup` wizard mentioned in the README.md and enhances the existing health check system. This phase transforms the current manual `.env` editing process into a guided, interactive experience while adding comprehensive system diagnostics.

## Background

Currently, users must manually:
- Copy `.env.example` to `.env`
- Edit configuration values by hand
- Follow complex setup guides for each integration
- Troubleshoot misconfigurations without assistance

The current health check system provides basic monitoring but lacks comprehensive diagnostics and setup validation.

## Goals

### Primary: Onboarding Wizard
- **Replace manual `.env` editing** with an interactive CLI wizard
- **Guide users through integration setup** with step-by-step assistance
- **Validate configurations** in real-time during setup
- **Provide clear error messages** and troubleshooting guidance

### Secondary: Enhanced Health Check System
- **Comprehensive system diagnostics** beyond basic uptime
- **Configuration validation** to detect misconfigurations
- **Integration health checks** for all optional services
- **Proactive health monitoring** with intelligent alerting

## Detailed Implementation

### 1. Interactive CLI Wizard (`pnpm setup`)

#### Core Wizard Engine
- **File**: `src/setup/wizard.ts`
- **Purpose**: Main wizard orchestrator with step-by-step flow
- **Features**:
  - Interactive prompts using `inquirer` or similar
  - Configuration validation and testing
  - Progress tracking and resume capability
  - Colored output and clear messaging

#### Configuration Steps
1. **Welcome & Prerequisites Check**
   - Verify Node.js version (>=22)
   - Check pnpm installation
   - Explain the setup process

2. **Identity Configuration** (Optional)
   - Agent name, operator name
   - Vault path selection
   - Claude Code allowed paths

3. **Required Configuration**
   - **Telegram Bot Setup**:
     - Guide through BotFather process
     - Token validation
     - Chat ID discovery assistance
   - **LLM Provider Selection**:
     - Choose providers (Anthropic, OpenAI, Gemini, Ollama)
     - API key validation
     - Model availability testing

4. **Optional Integrations** (User selects which to configure)
   - **Gmail**: OAuth flow assistance, credential validation
   - **Google Calendar**: Uses same OAuth, automatic detection
   - **Slack**: Bot creation guidance, token validation
   - **Miniflux**: Connection testing, feed validation
   - **n8n**: API key testing, workflow discovery
   - **Browser Automation**: Playwright installation check
   - **Docker Services**: Service discovery and health URL testing

5. **Security Configuration**
   - Dashboard authentication setup
   - Webhook secret generation
   - Quiet hours configuration

6. **Final Steps**
   - Configuration summary and review
   - First-run health check
   - Service startup guidance

#### Validation Engine
- **File**: `src/setup/validators.ts`
- **Purpose**: Real-time validation for each configuration item
- **Features**:
  - API key validation by making test calls
  - OAuth flow testing
  - Service connectivity checks
  - Format validation (URLs, tokens, etc.)

#### Configuration Manager
- **File**: `src/setup/config-manager.ts`
- **Purpose**: Safe `.env` file manipulation
- **Features**:
  - Backup existing configurations
  - Incremental updates without data loss
  - Template-based generation
  - Comments and documentation injection

### 2. Enhanced Health Check System

#### System Diagnostics
- **File**: `src/health/diagnostics.ts`
- **Purpose**: Comprehensive system health assessment
- **Features**:
  - Configuration validation (all env vars properly set)
  - Integration connectivity testing
  - Dependency availability checks
  - Performance metrics collection

#### Integration Health Checks
- **File**: `src/health/integration-checks.ts`
- **Purpose**: Deep health checks for each integration
- **Features**:
  - **Telegram**: Bot responsiveness, permission validation
  - **LLM Providers**: Model availability, quota checks
  - **Gmail**: OAuth token freshness, API quota
  - **Calendar**: Permission scope validation
  - **Slack**: Workspace connectivity, channel access
  - **Miniflux**: Feed count, last sync status
  - **n8n**: Workflow count, execution history
  - **Docker**: Container status, resource usage

#### Health Dashboard Enhancement
- **File**: `src/health/dashboard.ts`
- **Purpose**: Enhanced web dashboard with detailed diagnostics
- **Features**:
  - Real-time integration status
  - Configuration health indicators
  - Historical health trends
  - Troubleshooting guidance
  - Quick-fix suggestions

#### Proactive Health Monitoring
- **File**: `src/health/monitor.ts`
- **Purpose**: Intelligent health monitoring with smart alerts
- **Features**:
  - Configurable health check intervals
  - Alert fatigue prevention
  - Integration-specific monitoring rules
  - Automatic recovery suggestions

### 3. Setup Verification & Troubleshooting

#### Verification Suite
- **File**: `src/setup/verify.ts`
- **Purpose**: Post-setup verification and testing
- **Features**:
  - End-to-end integration testing
  - Permission validation
  - Configuration completeness check
  - Performance baseline establishment

#### Troubleshooting Assistant
- **File**: `src/setup/troubleshoot.ts`
- **Purpose**: Interactive problem diagnosis and resolution
- **Features**:
  - Common problem detection
  - Step-by-step resolution guides
  - Automated fix application where safe
  - Support information collection

#### Configuration Backup & Recovery
- **File**: `src/setup/backup.ts`
- **Purpose**: Safe configuration management
- **Features**:
  - Automatic configuration backups
  - Configuration versioning
  - Easy rollback capability
  - Export/import functionality

### 4. CLI Commands

#### Setup Commands
- `pnpm setup` - Full interactive wizard
- `pnpm setup --minimal` - Only required configurations
- `pnpm setup --integration=gmail` - Configure specific integration
- `pnpm setup --verify` - Verify existing configuration
- `pnpm setup --reset` - Reset configuration (with backup)

#### Health Commands
- `pnpm health` - Quick health check
- `pnpm health --detailed` - Comprehensive diagnostics
- `pnpm health --fix` - Attempt automatic fixes
- `pnpm health --export` - Export health report

#### Troubleshooting Commands
- `pnpm troubleshoot` - Interactive problem solver
- `pnpm troubleshoot --integration=gmail` - Specific integration help
- `pnpm doctor` - Comprehensive system check with fixes

## Technical Requirements

### Dependencies
- **inquirer**: Interactive CLI prompts
- **chalk**: Colored terminal output
- **ora**: Loading spinners and progress indicators
- **boxen**: Formatted message boxes
- **fs-extra**: Enhanced file system operations

### Integration Points
- Extend existing health server (`src/gateway/server.ts`)
- Enhance Docker monitor (`src/inbox/docker-monitor.ts`)
- Integrate with existing dashboard (`src/dashboard/`)
- Use existing OAuth flows (`src/gmail/auth.ts`)

### Configuration Schema
- Define TypeScript interfaces for all configuration options
- JSON schema for validation
- Default value definitions
- Backward compatibility with existing `.env` files

## Success Criteria

### Onboarding Wizard Success
- [ ] Complete setup possible without manual `.env` editing
- [ ] All integrations testable during setup
- [ ] Clear error messages with resolution guidance
- [ ] Resume capability for interrupted setups
- [ ] Backup and recovery mechanisms working

### Health Check Enhancement Success
- [ ] Comprehensive health status for all integrations
- [ ] Proactive problem detection before failures
- [ ] Clear troubleshooting guidance
- [ ] Historical health trend tracking
- [ ] Automated fix application where appropriate

### User Experience Success
- [ ] Setup time reduced by 70% compared to manual process
- [ ] 90%+ of configuration issues caught during setup
- [ ] Clear documentation and help throughout process
- [ ] No technical expertise required for basic setup

## Implementation Order

1. **Core wizard engine and configuration management**
2. **Basic integration validators (Telegram, LLM)**
3. **Enhanced health check system foundation**
4. **Optional integration setup (Gmail, Slack, etc.)**
5. **Troubleshooting and verification tools**
6. **Dashboard enhancements and monitoring**
7. **Documentation and help system**

## Risks and Mitigation

### Risk: Breaking existing configurations
- **Mitigation**: Always backup before modifications, extensive testing

### Risk: Complex OAuth flows in CLI
- **Mitigation**: Clear instructions, fallback to web-based flows

### Risk: Over-engineering the wizard
- **Mitigation**: Start minimal, iterate based on user feedback

### Risk: Platform compatibility issues
- **Mitigation**: Test on macOS primary, document Linux differences

## Testing Strategy

- Unit tests for all validators and configuration managers
- Integration tests for each setup flow
- End-to-end testing of complete setup process
- Manual testing on fresh environments
- Backward compatibility testing with existing installations

## Documentation Updates

- Update README.md to reference `pnpm setup`
- Create detailed setup troubleshooting guide
- Document all new CLI commands
- Update DEPLOYMENT.md with wizard instructions
- Create video walkthrough for complex integrations